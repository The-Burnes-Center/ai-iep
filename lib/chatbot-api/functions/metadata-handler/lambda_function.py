import os
import time
import datetime
from datetime import datetime, timezone

import json
import urllib.parse
import boto3
from botocore.exceptions import ClientError
from config import get_full_prompt, IEP_SECTIONS, get_translation_prompt, LANGUAGE_CODES
import io
import base64
import logging
import uuid
import traceback
import re
from mistral_ocr import process_document_with_mistral_ocr
from open_ai_agent import get_openai_api_key, analyze_document_with_agent, translate_with_agent

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
            
        # Print the values we're using for debugging
        print(f"Updating document status for iep_id: {iep_id}, status: {status}, child_id: {child_id}")
        
        # Print summaries structure for debugging
        if summaries:
            print(f"Summaries structure keys: {list(summaries.keys())}")
            if 'summaries' in summaries:
                print(f"Languages in summaries: {list(summaries['summaries'].get('M', {}).keys())}")
            if 'sections' in summaries:
                print(f"Languages in sections: {list(summaries['sections'].get('M', {}).keys())}")
        
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
            print(f"Item exists check result: {item_exists}")
        except ClientError as e:
            if 'ValidationException' in str(e):
                print(f"DynamoDB schema validation error: {e}. The key structure does not match the table schema.")
                item_exists = False
            else:
                raise
        
        # Convert timestamp to epoch time (integer) for DynamoDB GSI
        # Convert ISO string timestamp to datetime object then to epoch timestamp
        dt = datetime.fromisoformat(current_time)
        epoch_time = int(dt.timestamp() * 1000)  # milliseconds since epoch
        
        # Extract userId from the S3 object path if not provided directly
        if not user_id and object_key:
            # Extract userId from path (usually first segment)
            path_parts = object_key.split('/')
            if len(path_parts) >= 1:
                user_id = path_parts[0]
                print(f"Extracted userId {user_id} from object key path")
        
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
                    
                    update_expr += ", summaries = :summaries, sections = :sections"
                    expr_attr_values[':summaries'] = formatted_summaries
                    expr_attr_values[':sections'] = formatted_sections
                    
                    print(f"Updating document with formatted summaries and sections")
                    # Add detailed logging for troubleshooting
                    print(f"Formatted summaries structure: {json.dumps(formatted_summaries, default=str)}")
                    print(f"Formatted sections structure: {json.dumps(formatted_sections, default=str)}")
                
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
                    print(f"Update response: {json.dumps(response, default=str)}")
                    print(f"Successfully updated existing item for iepId: {iep_id}")
                except Exception as update_error:
                    print(f"Error during update_item operation: {update_error}")
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
                
                # Use numeric timestamp for createdAt to match expected GSI key type
                item['createdAt'] = epoch_time
                
                try:
                    # Try PutItem first
                    print(f"Attempting to create new item for iepId: {iep_id} using PutItem")
                    print(f"Item structure: {json.dumps(item, default=str)}")
                    table.put_item(Item=item)
                    print(f"Successfully created new item with PutItem")
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
                            
                            update_expr += ", summaries = :summaries, sections = :sections"
                            expr_attr_values[':summaries'] = formatted_summaries_update
                            expr_attr_values[':sections'] = formatted_sections_update
                            
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
                            print(f"Fallback update response: {json.dumps(response, default=str)}")
                            print(f"Successfully created item with UpdateItem fallback for iepId: {iep_id}")
                        except Exception as update_error:
                            print(f"UpdateItem fallback also failed: {update_error}")
                            raise
                    else:
                        # If it's another type of error, re-raise it
                        raise
                
            print(f"Successfully updated document status to {status}")
        except ClientError as e:
            if 'AccessDeniedException' in str(e):
                # Handle permission errors gracefully
                print(f"WARNING: DynamoDB permission error: {e}")
                print(f"Document status update for {iep_id} could not be completed due to permission restrictions")
                
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
                print(f"Error updating user profile with summary: {profile_error}")
                # Even if profile update fails, document processing is still considered successful
                
    except Exception as e:
        print(f"Failed to update document status: {e}")
        # Don't re-raise the exception here - log it but don't fail completely
        # This allows processing to continue even if status updates fail
    
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


def retrieve_knowledge_base_documents(file_name, knowledge_base_id):
    """Retrieve document content from Bedrock knowledge base by file name."""
    try:
        query = os.path.splitext(file_name)[0]
        print(f"Searching knowledge base for document: {query}")
        response = bedrock_retrieve.retrieve(
            knowledgeBaseId=knowledge_base_id,
            retrievalQuery={
                'text': query
            },
            # Use the correct parameter structure with vectorSearchConfiguration
            retrievalConfiguration={
                'vectorSearchConfiguration': {
                    'numberOfResults': 20
                }
            }
        )
        full_content = []
        file_uri = None
        if response.get('retrievalResults'):
            for result in response['retrievalResults']:
                uri = result['location']['s3Location']['uri']
                if file_name in uri:
                    # Collect all content segments that belong to this file
                    full_content.append(result['content']['text'])
                    file_uri = uri
            if full_content:
                return {'content': "\n".join(full_content), 'uri': file_uri}
        # If no results or no matching file content found:
        return {'content': None, 'uri': None}
    except ClientError as e:
        print(f"Error fetching knowledge base docs: {e}")
        return {'content': None, 'uri': None, 'error': str(e)}


def translate_content(content, target_languages):
    """
    Translate content to the specified target languages using OpenAI Agent
    
    Args:
        content (str or dict): The content to translate. Either a string or a dict with text fields
        target_languages (list): List of language codes to translate to
        
    Returns:
        dict: Dictionary with original content and translations
    """
    if not target_languages or not content:
        print("No target languages specified or empty content, skipping translation")
        return {"original": content}
    
    print(f"Starting translation to languages: {target_languages}")
    result = {"original": content}
    
    for lang_code in target_languages:
        try:
            # Find the language name from language code for the prompt
            language_name = next((name for name, code in LANGUAGE_CODES.items() 
                               if code == lang_code), lang_code)
            
            if isinstance(content, str):
                # Use OpenAI Agent for translation
                translated_text = translate_with_agent(content, language_name)
                
                if isinstance(translated_text, dict) and "error" in translated_text:
                    print(f"Error translating to {lang_code}: {translated_text['error']}")
                    continue
                    
                result[lang_code] = translated_text
                
            elif isinstance(content, dict):
                # Translate each field in the dictionary
                translated_dict = {}
                
                for key, value in content.items():
                    if isinstance(value, str) and value.strip():
                        # Use OpenAI Agent for translation
                        translated_text = translate_with_agent(value, language_name)
                        
                        if isinstance(translated_text, dict) and "error" in translated_text:
                            print(f"Error translating field '{key}' to {lang_code}: {translated_text['error']}")
                            translated_dict[key] = value  # Keep original value on error
                        else:
                            translated_dict[key] = translated_text
                    else:
                        # Keep non-string values or empty strings as is
                        translated_dict[key] = value
                        
                result[lang_code] = translated_dict
            
        except Exception as e:
            print(f"Error translating to {lang_code}: {str(e)}")
            traceback.print_exc()
            continue
    
    return result


def summarize_and_categorize(content_text):
    """
    Extract summary and sections from document content using OpenAI Agents.
    
    Args:
        content_text (str): The text content from the document
        
    Returns:
        dict: Contains summary and sections
    """
    # Ensure content is valid
    if not content_text or not content_text.strip():
        print("Empty document content, cannot summarize")
        return {
            'summary': '',
            'sections': []
        }
    
    try:
        # Use OpenAI Agent for document analysis
        print("Using OpenAI Agent to analyze document content")
        result = analyze_document_with_agent(content_text)
        
        if "error" in result:
            print(f"OpenAI Agent analysis failed: {result.get('error')}")
            return {
                'summary': "Error analyzing document content",
                'sections': []
            }
            
        return result
        
    except Exception as e:
        print(f"Error during summarize_and_categorize: {str(e)}")
        traceback.print_exc()
        return {
            'summary': "Error generating summary: " + str(e),
            'sections': []
        }


def get_document_metadata(bucket, key):
    """Retrieve the metadata of a single S3 object."""
    response = s3.head_object(Bucket=bucket, Key=key)
    return response.get('Metadata', {})


def get_all_documents_metadata(bucket):
    """Retrieve metadata for all objects in the bucket (and save to metadata.txt in the bucket)."""
    all_metadata = {}
    try:
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket):
            if 'Contents' in page:
                for obj in page['Contents']:
                    key = obj['Key']
                    try:
                        all_metadata[key] = get_document_metadata(bucket, key)
                    except Exception as e:
                        print(f"Error fetching metadata for {key}: {e}")
        # Save the collected metadata to an S3 object (for debugging or analysis)
        metadata_json = json.dumps(all_metadata, indent=4)
        s3.put_object(Bucket=bucket, Key="metadata.txt", Body=metadata_json, ContentType='application/json')
        print(f"Metadata snapshot saved to s3://{bucket}/metadata.txt")
        return all_metadata
    except Exception as e:
        print(f"Error occurred in fetching complete metadata: {e}")
        return None


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


def handle_api_request(event):
    """
    Handle API Gateway event for metadata requests.
    
    Args:
        event (dict): API Gateway event
        
    Returns:
        dict: API Gateway response
    """
    try:
        http_method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method')
        path = event.get('path') or event.get('rawPath')
        
        print(f"Handling API request: {http_method} {path}")
        
        # Get document metadata - /document/{iepId}
        if http_method == 'GET' and path and '/document/' in path:
            return get_document_metadata_by_id(event)
            
        # Not implemented
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
                            'body': json.dumps({
                'message': 'Unsupported API request'
            })
        }
    except Exception as e:
        print(f"Error handling API event: {str(e)}")
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
                    'body': json.dumps({
                'message': f'Error handling API request: {str(e)}'
            })
        }
        
def get_document_metadata_by_id(event):
    """
    Get IEP document metadata, including summaries and sections
    
    Args:
        event (dict): API Gateway event
        
    Returns:
        dict: API Gateway response with document metadata
    """
    try:
        # Extract iepId from the path
        path = event.get('path') or event.get('rawPath')
        path_parts = path.split('/')
        iep_id = path_parts[-1]  # Last part of the path should be the iepId
        
        # Optional language parameter
        query_params = event.get('queryStringParameters') or {}
        lang_code = query_params.get('lang', 'en')  # Default to English
        
        print(f"Getting document metadata for iepId: {iep_id}, language: {lang_code}")
        
        # Get the document from DynamoDB
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ['IEP_DOCUMENTS_TABLE'])
        
        response = table.get_item(Key={'iepId': iep_id})
        
        if 'Item' not in response:
                return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                    'body': json.dumps({
                    'message': 'Document not found'
                })
            }
            
        document = response['Item']
        print(f"Retrieved document from DynamoDB: {json.dumps(document, default=str)[:500]}...")
        print(f"Document keys: {list(document.keys())}")
        
        # Get the summary and sections for the requested language
        summary = None
        sections = None
        
        # Check if summaries exist in the document
        if 'summaries' in document:
            print(f"Summaries found in document with keys: {list(document['summaries'].keys()) if isinstance(document['summaries'], dict) else 'Not a dictionary'}")
            if lang_code in document['summaries']:
                summary = document['summaries'][lang_code]
                print(f"Found summary for language {lang_code}")
            elif 'M' in document['summaries'] and lang_code in document['summaries']['M']:
                # Handle DynamoDB format
                summary = document['summaries']['M'][lang_code].get('S', '')
                print(f"Found summary in DynamoDB format for language {lang_code}")
        
        # Check if sections exist in the document
        if 'sections' in document:
            print(f"Sections found in document with keys: {list(document['sections'].keys()) if isinstance(document['sections'], dict) else 'Not a dictionary'}")
            if lang_code in document['sections']:
                sections = document['sections'][lang_code]
                print(f"Found sections for language {lang_code}")
            elif 'M' in document['sections'] and lang_code in document['sections']['M']:
                # Handle DynamoDB format
                sections_map = document['sections']['M'][lang_code].get('M', {})
                sections = {}
                for section_name, section_data in sections_map.items():
                    if 'S' in section_data:
                        sections[section_name] = section_data['S']
                    elif 'M' in section_data:
                        section_content = {}
                        for k, v in section_data['M'].items():
                            if 'S' in v:
                                section_content[k] = v['S']
                        sections[section_name] = section_content
                print(f"Found sections in DynamoDB format for language {lang_code}")
            
        # If requested language is not available, fall back to English
        if (summary is None or sections is None) and lang_code != 'en':
            print(f"Language {lang_code} not available, falling back to English")
            if 'summaries' in document:
                if 'en' in document['summaries']:
                    summary = document['summaries']['en']
                elif 'M' in document['summaries'] and 'en' in document['summaries']['M']:
                    summary = document['summaries']['M']['en'].get('S', '')
                
            if 'sections' in document:
                if 'en' in document['sections']:
                    sections = document['sections']['en']
                elif 'M' in document['sections'] and 'en' in document['sections']['M']:
                    sections_map = document['sections']['M']['en'].get('M', {})
                    sections = {}
                    for section_name, section_data in sections_map.items():
                        if 'S' in section_data:
                            sections[section_name] = section_data['S']
                        elif 'M' in section_data:
                            section_content = {}
                            for k, v in section_data['M'].items():
                                if 'S' in v:
                                    section_content[k] = v['S']
                            sections[section_name] = section_content
        
        # Prepare the response
        result = {
            'iepId': document['iepId'],
            'status': document.get('status', 'UNKNOWN'),
            'documentUrl': document.get('documentUrl', ''),
            'createdAt': document.get('createdAt', ''),
            'updatedAt': document.get('updatedAt', ''),
            'summary': summary,
            'sections': sections
        }
        
        # Add childId and userId if available
        if 'childId' in document:
            result['childId'] = document['childId']
            
        if 'userId' in document:
            result['userId'] = document['userId']
            
        # Get available languages
        available_langs = []
        if 'summaries' in document:
            if isinstance(document['summaries'], dict):
                if 'M' in document['summaries']:
                    available_langs = list(document['summaries']['M'].keys())
                else:
                    available_langs = list(document['summaries'].keys())
        
        result['availableLanguages'] = available_langs
        print(f"Available languages: {available_langs}")
        
        return {
                'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
        
    except Exception as e:
        print(f"Error getting document metadata: {str(e)}")
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
                'body': json.dumps({
                'message': f'Error getting document metadata: {str(e)}'
            })
        }


def lambda_handler(event, context):
    """
    Lambda function handler for document handling API. This function processes different events:
    - S3 event: Process document from S3 bucket
    - API Gateway event: Handle API requests for metadata
    """
    print("Event received:", json.dumps(event))
    
    # Determine if this is an S3 event or an API Gateway event
    if 'Records' in event and len(event['Records']) > 0 and 'eventSource' in event['Records'][0] and event['Records'][0]['eventSource'] == 'aws:s3':
        # This is an S3 event
        return handle_s3_upload_event(event)
    else:
        # This is an API Gateway event
        return handle_api_request(event)

def get_all_ocr_text_with_page_numbers(ocr_result):
    """Extract all text content from OCR result with page numbers"""
    if not ocr_result or 'pages' not in ocr_result:
        return None
        
    text_content = []
    for i, page in enumerate(ocr_result['pages'], 1):
        if 'markdown' in page:
            text_content.append(f"Page {i}:\n{page['markdown']}")
    
    return "\n\n".join(text_content)

def get_ocr_text_for_page(ocr_result, page_index):
    """
    Extract text for a specific page from OCR result.
    
    Args:
        ocr_result (dict): OCR result from Mistral OCR API
        page_index (int): 0-based page index to retrieve
        
    Returns:
        str: Text content for the specified page or empty string if not found
    """
    if not ocr_result or not isinstance(ocr_result, dict) or 'pages' not in ocr_result:
        print(f"Invalid OCR result format or missing 'pages' field")
        return ""
    
    for page in ocr_result['pages']:
        if isinstance(page, dict) and 'index' in page and page['index'] == page_index:
            return page.get('markdown', '')
            
    print(f"Page index {page_index} not found in OCR result")
    return ""

def handle_s3_upload_event(event):
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
            return {
                'statusCode': 500,
                'body': json.dumps({
                    'message': f"OCR processing failed: {ocr_result['error']}"
                })
            }
        
        # Store the OCR results in DynamoDB
        update_iep_document_status(
            iep_id=iep_id,
            status="PROCESSING",
            child_id=child_id,
            user_id=user_id,
            object_key=key,
            ocr_data=ocr_result
        )
        
        # Get user profile for language preferences
        user_profile = get_user_profile(user_id) if user_id else None
        
        # Extract text content from the OCR result
        content_text = get_all_ocr_text_with_page_numbers(ocr_result)
        if not content_text:
            error_message = "No text content found in OCR result"
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
        
        # Process the document content
        content_text = content_text.strip()
        
        try:
            # First, analyze the document in English
            result = analyze_document_with_agent(content_text)
            
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
            
            # Get target languages from user profile
            target_languages = []
            if user_profile and 'languages' in user_profile:
                target_languages = [lang for lang in user_profile.get('languages', []) if lang != 'en']
            
            print(f"Processing document with target languages: {target_languages}")
            
            # Format the English result for translation
            formatted_result = {
                'summaries': result['summaries'],
                'sections': result['sections']
            }
            
            # Translate to each target language
            for lang_code in target_languages:
                try:
                    translated_result = translate_with_agent(formatted_result, lang_code)
                    
                    if "error" in translated_result:
                        print(f"Error translating to {lang_code}: {translated_result['error']}")
                        continue
                    
                    # Merge the translated content into the result
                    # The translated result contains the English content in the 'en' field
                    formatted_result['summaries']['M'][lang_code] = translated_result['summaries']['M']['en']
                    formatted_result['sections']['M'][lang_code] = translated_result['sections']['M']['en']
                    
                except Exception as e:
                    print(f"Error translating to {lang_code}: {str(e)}")
                    continue
            
            # Save to DynamoDB
            update_iep_document_status(
                iep_id=iep_id, 
                status='PROCESSED', 
                child_id=child_id, 
                summaries=formatted_result,
                user_id=user_id,
                object_key=key,
                ocr_data=ocr_result
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