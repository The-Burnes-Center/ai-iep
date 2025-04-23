import os
import time
import datetime
from datetime import datetime, timezone

import json
import urllib.parse
import boto3
from botocore.exceptions import ClientError
from config import get_full_prompt, IEP_SECTIONS, LANGUAGE_CODES
import io
import base64
import logging
import uuid
import traceback
import re
from mistral_ocr import process_document_with_mistral_ocr
from open_ai_agent import OpenAIAgent
from comprehend_redactor import redact_pii_from_texts
from decimal import Decimal

# AWS clients
s3 = boto3.client('s3')
bedrock_retrieve = boto3.client('bedrock-agent-runtime', region_name='us-east-1')  # for knowledge base retrieval
dynamodb = boto3.client('dynamodb')  # for document status updates
ssm = boto3.client('ssm')  # for accessing parameter store

# Retrieve MISTRAL_API_KEY from Parameter Store
mistral_api_key_param_name = os.environ.get('MISTRAL_API_KEY_PARAMETER_NAME')
try:
    mistral_api_key = ssm.get_parameter(Name=mistral_api_key_param_name, WithDecryption=True)['Parameter']['Value']
    print(f"Successfully retrieved Mistral API key from parameter store")
    # Set it in environment for the mistral_ocr module
    os.environ['MISTRAL_API_KEY'] = mistral_api_key
    print("Mistral API key set in environment")
except Exception as e:
    print(f"Error retrieving Mistral API key: {str(e)}")
    mistral_api_key = None

# Retrieve OPENAI_API_KEY from Parameter Store
openai_api_key_param_name = os.environ.get('OPENAI_API_KEY_PARAMETER_NAME')
try:
    openai_api_key = ssm.get_parameter(Name=openai_api_key_param_name, WithDecryption=True)['Parameter']['Value']
    print(f"Successfully retrieved OpenAI API key from parameter store")
    # Set it in environment for the open_ai_agent module
    os.environ['OPENAI_API_KEY'] = openai_api_key
    print("OpenAI API key set in environment for agents")
except Exception as e:
    print(f"Error retrieving OpenAI API key: {str(e)}")
    openai_api_key = None

def format_data_for_dynamodb(section_data):
    """
    Format section data for DynamoDB by converting Python dictionaries to proper DynamoDB attribute formats.
    DynamoDB requires specific attribute type designations (M for maps, S for strings, etc.)
    
    Args:
        section_data: Dictionary containing section data
        
    Returns:
        Dictionary with properly formatted DynamoDB attribute values
    """
    if isinstance(section_data, dict):
        # Convert dictionary to DynamoDB map format
        result = {"M": {}}
        for key, value in section_data.items():
            result["M"][key] = format_data_for_dynamodb(value)
        return result
    elif isinstance(section_data, list):
        # Convert list to DynamoDB list format
        result = {"L": []}
        for item in section_data:
            result["L"].append(format_data_for_dynamodb(item))
        return result
    elif isinstance(section_data, str):
        # String type
        return {"S": section_data}
    elif isinstance(section_data, bool):
        # Boolean type
        return {"BOOL": section_data}
    elif isinstance(section_data, (int, float)):
        # Number type
        return {"N": str(section_data)}
    elif section_data is None:
        # Null type
        return {"NULL": True}
    else:
        # Convert anything else to string as fallback
        return {"S": str(section_data)}

def convert_dict_floats_to_decimal(d):
    """
    Convert all float values in a dictionary to Decimal type for DynamoDB compatibility.
    This is a simple, non-recursive implementation that just handles top-level floats.
    
    Args:
        d (dict): Dictionary with possible float values
    
    Returns:
        dict: Dictionary with float values converted to Decimal
    """
    result = {}
    for k, v in d.items():
        if isinstance(v, float):
            result[k] = Decimal(str(v))
        elif isinstance(v, dict):
            result[k] = convert_dict_floats_to_decimal(v)
        elif isinstance(v, list):
            result[k] = [
                convert_dict_floats_to_decimal(item) if isinstance(item, dict) 
                else (Decimal(str(item)) if isinstance(item, float) else item)
                for item in v
            ]
        else:
            result[k] = v
    return result

def update_iep_document_status(iep_id, status, error_message=None, child_id=None, summaries=None, user_id=None, object_key=None, ocr_data=None):
    """
    Update the status of a document in the DynamoDB table.
    
    Args:
        iep_id (str): The IEP document ID
        status (str): The processing status (e.g., 'PROCESSING', 'PROCESSED', 'FAILED')
        error_message (str, optional): Error message if status is 'FAILED'
        child_id (str, optional): The child ID associated with the document
        summaries (dict, optional): Document summaries to store
        user_id (str, optional): The user ID associated with the document
        object_key (str, optional): The S3 object key for extracting user_id if not provided directly
        ocr_data (dict, optional): OCR data from Mistral to store
    """
    try:
        # Check if iep_id is valid
        if not iep_id or not isinstance(iep_id, str):
            print(f"Invalid iep_id: {iep_id}. Cannot update document status.")
            return
            
        # Convert any float values in ocr_data to Decimal for DynamoDB compatibility
        if ocr_data and isinstance(ocr_data, dict):
            ocr_data = convert_dict_floats_to_decimal(ocr_data)
            
        # Print the values we're using for debugging
        print(f"Updating document status for iep_id: {iep_id}, status: {status}")
        
        # Extract userId from the S3 object path if not provided directly
        if not user_id and object_key:
            # Extract userId from path (usually first segment)
            path_parts = object_key.split('/')
            if len(path_parts) >= 1:
                user_id = path_parts[0]
        
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ['IEP_DOCUMENTS_TABLE'])
        
        # Define the correct key structure - IEP Documents table has iepId as the partition key
        # and childId as the sort key
        key = {'iepId': iep_id}
        if child_id:
            key['childId'] = child_id
        
        # Get the current timestamp
        current_time = datetime.now().isoformat()
        
        # Try to get the item first
        try:
            response = table.get_item(Key=key)
            item_exists = 'Item' in response
        except ClientError as e:
            if 'ValidationException' in str(e):
                print(f"DynamoDB schema validation error: {str(e)}")
                item_exists = False
            else:
                raise
        
        # Convert timestamp to epoch time (integer) for DynamoDB GSI
        # Convert ISO string timestamp to datetime object then to epoch timestamp
        dt = datetime.fromisoformat(current_time)
        epoch_time = int(dt.timestamp() * 1000)  # milliseconds since epoch
        
        try:
            if item_exists:
                # Update existing item
                update_expr = "SET #status = :status, updatedAt = :updated_at"
                expr_attr_names = {
                    '#status': 'status'
                }
                expr_attr_values = {
                    ':status': status,
                    ':updated_at': current_time
                }
                
                # Don't update childId if it's part of the key
                
                if user_id:
                    update_expr += ", userId = :user_id"
                    expr_attr_values[':user_id'] = user_id
                
                if error_message:
                    update_expr += ", errorMessage = :error_message"
                    expr_attr_values[':error_message'] = error_message
                
                # Add OCR data if provided
                if ocr_data:
                    update_expr += ", ocrData = :ocr_data, ocrCompletedAt = :ocr_completed_at"
                    expr_attr_values[':ocr_data'] = ocr_data
                    expr_attr_values[':ocr_completed_at'] = current_time
                    print(f"Adding OCR data to document")
                
                if status == 'PROCESSED' and summaries:
                    # The data from LLM is already in DynamoDB format, so we can use it directly
                    formatted_summaries = summaries.get('summaries', {})
                    formatted_sections = summaries.get('sections', {})
                    formatted_document_index = summaries.get('document_index', {})
                    
                    update_expr += ", summaries = :summaries, sections = :sections, document_index = :document_index"
                    expr_attr_values[':summaries'] = formatted_summaries
                    expr_attr_values[':sections'] = formatted_sections
                    expr_attr_values[':document_index'] = formatted_document_index
                    
                    print(f"Updating document with formatted summaries, sections, and document_index")
                    # Add detailed logging for troubleshooting
                    print(f"Formatted summaries structure: {json.dumps(formatted_summaries, default=str)}")
                    print(f"Formatted sections structure: {json.dumps(formatted_sections, default=str)}")
                    print(f"Formatted document_index structure: {json.dumps(formatted_document_index, default=str)}")
                
                # Update the item
                update_params = {
                    'Key': key,
                    'UpdateExpression': update_expr,
                    'ExpressionAttributeNames': expr_attr_names,
                    'ExpressionAttributeValues': expr_attr_values,
                    'ReturnValues': 'ALL_NEW'  # Changed from NONE to ALL_NEW to see what's actually being saved
                }
                
                print(f"Final update expression: {update_expr}")
                print(f"Final expression attribute names: {expr_attr_names}")
                print(f"Final expression attribute values keys: {list(expr_attr_values.keys())}")
                
                try:
                    response = table.update_item(**update_params)
                    print(f"Successfully updated status for iepId: {iep_id} to {status}")
                except Exception as update_error:
                    print(f"Error during update_item operation: {str(update_error)}")
                    raise
            else:
                # Create new item
                item = {
                    'iepId': iep_id,
                    'status': status,
                    'createdAt': current_time,
                    'updatedAt': current_time
                }
                
                if child_id:
                    item['childId'] = child_id
                
                if user_id:
                    item['userId'] = user_id
                
                # Add OCR data if provided
                if ocr_data:
                    item['ocrData'] = ocr_data
                    item['ocrCompletedAt'] = current_time
                    print(f"Adding OCR data to new document")
                    
                # Add document URL field
                bucket_name = os.environ.get('BUCKET', '')
                filename = object_key.split('/')[-1] if object_key else iep_id
                item['documentUrl'] = f"s3://{bucket_name}/{user_id}/{child_id}/{iep_id}/{filename}"
                    
                if error_message:
                    item['errorMessage'] = error_message
                    
                if status == 'PROCESSED' and summaries:
                    # The data from LLM is already in DynamoDB format, so we can use it directly
                    item['summaries'] = summaries.get('summaries', {})
                    item['sections'] = summaries.get('sections', {})
                    item['document_index'] = summaries.get('document_index', {})
                
                # Use numeric timestamp for createdAt to match expected GSI key type
                item['createdAt'] = epoch_time
                
                try:
                    # Try PutItem first
                    print(f"Attempting to create new item for iepId: {iep_id} using PutItem")
                    print(f"Item structure: {json.dumps(item, default=str)}")
                    table.put_item(Item=item)
                    print(f"Successfully created new item for iepId: {iep_id}")
                except ClientError as e:
                    if 'AccessDeniedException' in str(e) and 'dynamodb:PutItem' in str(e):
                        # If PutItem permission is denied, try using UpdateItem (conditional create) as fallback
                        print(f"PutItem permission denied, attempting to use UpdateItem as fallback")
                        
                        # For UpdateItem, we need to use the DynamoDB-formatted attributes
                        update_expr = "SET #status = :status, createdAt = :created_at, updatedAt = :updated_at"
                        expr_attr_names = {
                            '#status': 'status'
                        }
                        expr_attr_values = {
                            ':status': status,
                            ':created_at': epoch_time,  # Use numeric timestamp here
                            ':updated_at': current_time
                        }
                        
                        # Don't update childId if it's part of the key in fallback either
                        
                        if user_id:
                            update_expr += ", userId = :user_id"
                            expr_attr_values[':user_id'] = user_id
                            
                        # Add document URL field
                        bucket_name = os.environ.get('BUCKET', '')
                        filename = object_key.split('/')[-1] if object_key else iep_id
                        update_expr += ", documentUrl = :doc_url"
                        expr_attr_values[':doc_url'] = f"s3://{bucket_name}/{user_id}/{child_id}/{iep_id}/{filename}"
                            
                        if error_message:
                            update_expr += ", errorMessage = :error_message"
                            expr_attr_values[':error_message'] = error_message
                            
                        if status == 'PROCESSED' and summaries:
                            # The data from LLM is already in DynamoDB format, so we can use it directly
                            formatted_summaries_update = summaries.get('summaries', {})
                            formatted_sections_update = summaries.get('sections', {})
                            formatted_document_index_update = summaries.get('document_index', {})
                            
                            update_expr += ", summaries = :summaries, sections = :sections, document_index = :document_index"
                            expr_attr_values[':summaries'] = formatted_summaries_update
                            expr_attr_values[':sections'] = formatted_sections_update
                            expr_attr_values[':document_index'] = formatted_document_index_update
                            
                            # Removed tags handling from fallback path
                            
                            # Add detailed logging for debugging
                            print(f"Fallback update expression: {update_expr}")
                            print(f"Fallback attribute values: {json.dumps(expr_attr_values, default=str)}")
                        
                        try:
                            # Use UpdateItem with the correct key
                            update_params = {
                                'Key': key,
                                'UpdateExpression': update_expr,
                                'ExpressionAttributeNames': expr_attr_names,
                                'ExpressionAttributeValues': expr_attr_values,
                                'ReturnValues': 'ALL_NEW'  # Changed from NONE to ALL_NEW to see what's actually saved
                            }
                            
                            response = table.update_item(**update_params)
                            print(f"Successfully created item with UpdateItem fallback for iepId: {iep_id}")
                        except Exception as update_error:
                            print(f"UpdateItem fallback also failed: {str(update_error)}")
                            raise
                    else:
                        # If it's another type of error, re-raise it
                        raise
                
            print(f"Successfully updated document status to {status}")
        except ClientError as e:
            if 'AccessDeniedException' in str(e):
                # Handle permission errors gracefully
                print(f"DynamoDB permission error: {str(e)}")
                
                # Continue processing the document even if we can't update the status
                if status == 'PROCESSING':
                    print("Continuing with document processing despite permission error")
                    return
                else:
                    # For terminal statuses (PROCESSED, FAILED), we should stop
                    raise
        
        # If document was successfully processed and we have a child ID, update the user profile
        if status == 'PROCESSED' and child_id and summaries:
            try:
                update_user_profile_with_summary(child_id, iep_id, summaries, user_id, object_key)
            except Exception as profile_error:
                print(f"Error updating user profile with summary: {str(profile_error)}")
                # Even if profile update fails, document processing is still considered successful
                
    except Exception as e:
        print(f"Failed to update document status: {str(e)}")
    
    # Return True or False based on whether the function succeeded
    return True


def update_user_profile_with_summary(child_id, iep_id, document_summary, user_id, object_key=None):
    """
    Update the user profile with a reference to the IEP document.
    No longer stores the full summary and sections in the user profile.
    
    Args:
        child_id (str): The child ID
        iep_id (str): The IEP document ID
        document_summary (dict): The document summary information (not stored in profile)
        user_id (str): The user ID to directly look up the profile
        object_key (str, optional): The S3 object key for extracting user_id if not provided directly
    """
    try:
        if not user_id or not iep_id or not child_id:
            print(f"Invalid user_id or iep_id or child_id: {user_id}, {iep_id}, {child_id}. Cannot update user profile.")
            return
            
        print(f"Updating user profile for user_id: {user_id} with reference to document: {iep_id} and child_id: {child_id}")
        
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ['USER_PROFILES_TABLE'])
        
        # Extract userId from the S3 object path if not provided directly
        if not user_id and object_key:
            # Extract userId from path (usually first segment)
            path_parts = object_key.split('/')
            if len(path_parts) >= 1:
                user_id = path_parts[0]
                print(f"Extracted userId {user_id} from object key path")
        
        # If we have user_id, get the profile directly - this is the most efficient approach
        if user_id:
            print(f"Looking up user profile with userId: {user_id}")
            try:
                response = table.get_item(Key={'userId': user_id})
                
                if 'Item' in response:
                    user_profile = response['Item']
                    print(f"Found user profile for userId: {user_id}")
                    
                    # Initialize document reference structure
                    doc_reference = {
                        'iepId': iep_id,
                        'updatedAt': datetime.now().isoformat()
                    }
                    
                    # Add documentUrl directly
                    filename = object_key.split('/')[-1] if object_key else iep_id
                    doc_reference['documentUrl'] = f"s3://{os.environ['BUCKET']}/{user_id}/{child_id}/{iep_id}/{filename}"
                    
                    # Find the child in the user's children array
                    children = user_profile.get('children', [])
                    child_index = None
                    
                    for i, child in enumerate(children):
                        if child.get('childId') == child_id:
                            child_index = i
                            break
                    
                    if child_index is not None:
                        print(f"Child found at index {child_index}, updating document references")
                        
                        # Update the user profile - store as a single document object instead of an array
                        try:
                            update_expr = f"SET children[{child_index}].iepDocument = :doc_ref"
                            expr_attr_values = {
                                ':doc_ref': doc_reference  # Single document object, not in an array
                            }
                            
                            table.update_item(
                                Key={'userId': user_profile['userId']},
                                UpdateExpression=update_expr,
                                ExpressionAttributeValues=expr_attr_values
                            )
                            
                            print(f"Successfully updated user profile for child {child_id} with reference to document {iep_id}")
                            # Successfully updated, so return early
                            return
                        except ClientError as e:
                            if 'AccessDeniedException' in str(e):
                                print(f"WARNING: Cannot update user profile due to permission restrictions: {e}")
                                # Permission issue, so return early
                                return
                            else:
                                print(f"Error updating user profile: {e}")
                                traceback.print_exc()
                                raise
                    else:
                        print(f"Child ID {child_id} not found in user profile for user {user_id}")
                        print(f"Available children in profile: {[child.get('childId') for child in children]}")
                        # Child not found in this user's profile, don't fall back to scan
                        return
                else:
                    print(f"No user profile found with userId: {user_id}")
            except Exception as e:
                print(f"Error getting user profile by userId: {e}")
                traceback.print_exc()
        else:
            print("No userId available to look up profile directly")
        
        # Only reach here if:
        # 1. We didn't have a userId at all, or
        # 2. We couldn't find a user profile with the userId we had
        
        # Fallback to scan if direct lookup failed or if we don't have a user_id
        print(f"Falling back to scan operation to find profile with child_id: {child_id}")
        # Import Attr at function level to avoid global import issues
        from boto3.dynamodb.conditions import Attr
        
        try:
            response = table.scan(
                FilterExpression=Attr('children').contains(child_id)
            )
            user_profiles = response.get('Items', [])
            
            if not user_profiles:
                print(f"No user profile found with child ID: {child_id}")
                return
            
            user_profile = user_profiles[0]
            print(f"Found user profile through scan: {user_profile.get('userId')}")
            
            # Initialize document reference structure - only store the necessary reference information
            doc_reference = {
                'iepId': iep_id,
                'updatedAt': datetime.now().isoformat()
            }
            
            # Add documentUrl directly 
            filename = object_key.split('/')[-1] if object_key else iep_id
            doc_reference['documentUrl'] = f"s3://{os.environ['BUCKET']}/{user_id}/{child_id}/{iep_id}/{filename}"
            
            # Find the child in the user's children array
            children = user_profile.get('children', [])
            child_index = None
            
            for i, child in enumerate(children):
                if child.get('childId') == child_id:
                    child_index = i
                    break
            
            if child_index is None:
                print(f"Child ID {child_id} not found in user profile {user_profile.get('userId')}")
                return
            
            print(f"Child found at index {child_index}, updating document references")
            
            # Update the user profile - store as a single document object instead of an array
            try:
                update_expr = f"SET children[{child_index}].iepDocument = :doc_ref"
                expr_attr_values = {
                    ':doc_ref': doc_reference  # Single document object, not in an array
                }
                
                table.update_item(
                    Key={'userId': user_profile['userId']},
                    UpdateExpression=update_expr,
                    ExpressionAttributeValues=expr_attr_values
                )
                
                print(f"Successfully updated user profile for child {child_id} with reference to document {iep_id}")
            except ClientError as e:
                if 'AccessDeniedException' in str(e):
                    print(f"WARNING: Cannot update user profile due to permission restrictions: {e}")
                    return
                else:
                    print(f"Error updating user profile via scan: {e}")
                    traceback.print_exc()
                    raise
        except ClientError as e:
            if 'AccessDeniedException' in str(e):
                print(f"WARNING: Cannot scan user profiles table due to permission restrictions: {e}")
                print(f"User profile update for child {child_id} skipped")
                return
            else:
                print(f"Error during scan operation: {e}")
                traceback.print_exc()
                raise
                
    except Exception as e:
        print(f"Error updating user profile with document reference: {e}")
        traceback.print_exc()
        # Don't re-raise the exception - log it but don't fail completely
    
    return


def get_user_profile(user_id):
    """
    Get user profile for a given user ID.
    
    Args:
        user_id (str): The user ID
        
    Returns:
        dict: User profile data or None if not found
    """
    if not user_id:
        return None
        
    try:
        print(f"Getting user profile for userId: {user_id}")
        
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ['USER_PROFILES_TABLE'])
        
        try:
            response = table.get_item(Key={'userId': user_id})
            
            if 'Item' in response:
                user_profile = response['Item']
                print(f"Found user profile for userId: {user_id}")
                
                # Check if languages array already exists in the profile
                if 'languages' in user_profile:
                    print(f"User profile already has languages: {user_profile['languages']}")
                else:
                    # Only if languages array doesn't exist, create one from primary/secondary languages
                    languages = []
                    
                    # Always include 'en' (English) as a base language
                    if 'en' not in languages:
                        languages.append('en')
                    
                    # Check for primary language
                    primary_lang = user_profile.get('primaryLanguage')
                    if primary_lang and primary_lang not in languages:
                        languages.append(primary_lang)
                        print(f"Added primary language: {primary_lang}")
                    
                    # Check for secondary language
                    secondary_lang = user_profile.get('secondaryLanguage')
                    if secondary_lang and secondary_lang not in languages:
                        languages.append(secondary_lang)
                        print(f"Added secondary language: {secondary_lang}")
                    
                    # Add languages array to profile
                    user_profile['languages'] = languages
                    print(f"Created languages array from profile: {languages}")
                
                return user_profile
            else:
                print(f"No user profile found for userId: {user_id}")
                return None
                
        except ClientError as e:
            if 'AccessDeniedException' in str(e):
                print(f"WARNING: Cannot access user profiles table due to permission restrictions: {e}")
                return None
            else:
                raise
                
    except Exception as e:
        print(f"Error getting user profile: {str(e)}")
        return None


def lambda_handler(event, context):
    """
    Lambda function handler for document handling API. This function processes S3 events for document uploads.
    """
    print("Event received:", json.dumps(event))
    
    # This is an S3 event
    return iep_processing_pipeline(event)

def delete_s3_object(bucket, key):
    try:
        s3 = boto3.client('s3')
        s3.delete_object(Bucket=bucket, Key=key)
        print(f"Deleted S3 object: {bucket}/{key}")
    except Exception as e:
        print(f"Failed to delete S3 object: {bucket}/{key} - {e}")

def iep_processing_pipeline(event):
    """Handle S3 event for document processing"""
    try:
        record = event['Records'][0]
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']
        key = urllib.parse.unquote_plus(key)
        
        print(f"Processing document: {key}")
        
        # Extract user ID, child ID, and IEP ID from the key
        key_parts = key.split('/')
        user_id = None
        child_id = None
        iep_id = None
        
        if len(key_parts) >= 3:
            user_id = key_parts[0]
            child_id = key_parts[1]
            iep_id = key_parts[2]
        
        # Process the document using Mistral OCR API
        ocr_result = process_document_with_mistral_ocr(bucket, key)
        
        # Check if OCR was successful
        if "error" in ocr_result:
            print(f"OCR processing failed: {ocr_result['error']}")
            update_iep_document_status(
                iep_id=iep_id,
                status="FAILED",
                error_message=f"OCR processing failed: {ocr_result['error']}",
                child_id=child_id,
                user_id=user_id,
                object_key=key
            )
            delete_s3_object(bucket, key)
            return {
                'statusCode': 500,
                'body': json.dumps({
                    'message': f"OCR processing failed: {ocr_result['error']}"
                })
            }
        
        # Redact PII (except names) from OCR result using AWS Comprehend
        if ocr_result and 'pages' in ocr_result and isinstance(ocr_result['pages'], list):
            print(f"Processing OCR result with {len(ocr_result['pages'])} pages")
            
            # Get text content from each page (checking for different possible field names)
            page_contents = []
            for page in ocr_result['pages']:
                if 'content' in page and page.get('content'):
                    page_contents.append(page.get('content', ''))
                elif 'text' in page and page.get('text'):
                    page_contents.append(page.get('text', ''))
                elif 'markdown' in page and page.get('markdown'):
                    page_contents.append(page.get('markdown', ''))
                else:
                    # Try to find any string field that could contain text
                    text_fields = [v for k, v in page.items() 
                                  if isinstance(v, str) and len(v) > 20]
                    if text_fields:
                        page_contents.append(text_fields[0])
                    else:
                        page_contents.append('')
            
            print(f"Beginning PII redaction on {sum(1 for c in page_contents if c)} non-empty pages")
            
            redacted_pages, pii_stats = redact_pii_from_texts(page_contents)
            
            # Update the content in the original structure
            for i, page in enumerate(ocr_result['pages']):
                if 'content' in page:
                    page['content'] = redacted_pages[i]
                elif 'text' in page:
                    page['text'] = redacted_pages[i]
                elif 'markdown' in page:
                    page['markdown'] = redacted_pages[i]
            
            # Add PII redaction stats to OCR result for tracking
            ocr_result['pii_redaction_stats'] = pii_stats
            print(f"PII redaction complete - redacted {pii_stats.get('redacted_entities', 0)} entities")
            
            # Convert any floats to Decimal to avoid DynamoDB errors
            ocr_data = convert_dict_floats_to_decimal(ocr_result)
        
        # Store the redacted OCR results in DynamoDB
        update_iep_document_status(
            iep_id=iep_id,
            status="PROCESSING",
            child_id=child_id,
            user_id=user_id,
            object_key=key,
            ocr_data=ocr_data
        )
        delete_s3_object(bucket, key)
        
        # Get user profile for language preferences
        user_profile = get_user_profile(user_id) if user_id else None
        
        # Create OpenAIAgent instance with redacted OCR data
        agent = OpenAIAgent(ocr_data=ocr_data)
        
        try:
            # Analyze the document - this now includes translations
            result = agent.analyze_document()
            
            if "error" in result:
                error_message = f"Document analysis failed: {result.get('error')}"
                print(error_message)
                update_iep_document_status(
                    iep_id=iep_id,
                    status="FAILED",
                    error_message=error_message,
                    child_id=child_id,
                    user_id=user_id,
                    object_key=key
                )
                return {
                    'statusCode': 500,
                    'body': json.dumps({
                        'message': error_message
                    })
                }
            
            # Format the result for DynamoDB - convert the raw result into proper DynamoDB format
            formatted_result = {
                'summaries': {},
                'sections': {},
                'document_index': {}
            }
            
            # Format summaries for DynamoDB
            if result.get('summaries'):
                formatted_result['summaries'] = {
                    lang: {'S': summary} for lang, summary in result['summaries'].items()
                }
            
            # Format sections for DynamoDB
            if result.get('sections'):
                formatted_result['sections'] = {
                    lang: {'L': [
                        {
                            'M': {
                                'title': {'S': section.get('title', '')},
                                'content': {'S': section.get('content', '')},
                                'page_numbers': {'L': [{'N': str(num)} for num in (section.get('page_numbers', []) or [])]}
                            }
                        } for section in result['sections'][lang]
                    ]} for lang, sections in result['sections'].items()
                }
            
            # Format document index for DynamoDB
            if result.get('document_index'):
                formatted_result['document_index'] = {
                    lang: {'S': index} for lang, index in result['document_index'].items()
                }
            
            # Clean up any timestamps or log markers in the data
            def clean_json_values(data):
                if isinstance(data, dict):
                    for key, value in list(data.items()):
                        if isinstance(value, str):
                            # Remove timestamp patterns
                            value = re.sub(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', '', value)
                            # Remove text indicating missing values or placeholders
                            value = value.replace('...', '').replace('// Translated sections', '')
                            # Remove other placeholder indicators
                            value = re.sub(r'//.*', '', value)
                            value = value.strip()
                            data[key] = value
                        else:
                            data[key] = clean_json_values(value)
                elif isinstance(data, list):
                    return [clean_json_values(item) for item in data]
                return data
            
            # Apply cleaning to the formatted result
            formatted_result = clean_json_values(formatted_result)
            
            # Verify all required languages are present
            required_languages = LANGUAGE_CODES.values()
            for lang in required_languages:
                # Check summaries
                if lang not in formatted_result.get('summaries', {}):
                    print(f"WARNING: Missing summary for language {lang} - using English summary")
                    if 'en' in formatted_result.get('summaries', {}):
                        formatted_result['summaries'][lang] = formatted_result['summaries']['en']
                    else:
                        formatted_result['summaries'][lang] = ''
                
                # Check sections
                if lang not in formatted_result.get('sections', {}):
                    print(f"WARNING: Missing sections for language {lang} - creating empty array")
                    formatted_result['sections'][lang] = []
                
                # Check document index
                if lang not in formatted_result.get('document_index', {}):
                    print(f"WARNING: Missing document index for language {lang} - using English index")
                    if 'en' in formatted_result.get('document_index', {}):
                        formatted_result['document_index'][lang] = formatted_result['document_index']['en']
                    else:
                        formatted_result['document_index'][lang] = ''
            
            # Save to DynamoDB
            update_iep_document_status(
                iep_id=iep_id, 
                status='PROCESSED', 
                child_id=child_id, 
                summaries=formatted_result,
                user_id=user_id,
                object_key=key,
                ocr_data=ocr_data
            )
            
            print(f"Document processed successfully: {iep_id}")
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Document processed successfully',
                    'iepId': iep_id
                })
            }
            
        except Exception as e:
            error_message = f"Error processing document: {str(e)}"
            print(error_message)
            traceback.print_exc()
            
            if iep_id:
                update_iep_document_status(
                    iep_id=iep_id,
                    status="FAILED",
                    error_message=error_message,
                    child_id=child_id,
                    user_id=user_id,
                    object_key=key
                )
            
            return {
                'statusCode': 500, 
                'body': json.dumps({
                    'message': f"Error processing document: {str(e)}"
                })
            }
        
    except Exception as e:
        print(f"Error processing document: {str(e)}")
        traceback.print_exc()
        
        if iep_id:
            update_iep_document_status(
                iep_id=iep_id,
                status="FAILED",
                error_message=f"Error processing document: {str(e)}",
                child_id=child_id,
                user_id=user_id,
                object_key=key
            )
        
        return {
            'statusCode': 500, 
            'body': json.dumps({
                'message': f"Error processing document: {str(e)}"
            })
        }