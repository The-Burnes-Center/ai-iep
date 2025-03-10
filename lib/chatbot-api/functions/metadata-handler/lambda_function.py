import os
import time
import datetime  # Add missing datetime import
from datetime import datetime, timezone

import json
import urllib.parse
import boto3
from botocore.exceptions import ClientError
from config import get_full_prompt, IEP_SECTIONS, get_translation_prompt, LANGUAGE_CODES
from PyPDF2 import PdfReader
import io
import base64
import logging
import uuid
import traceback
import re

# AWS clients
s3 = boto3.client('s3')
# bedrock_retrieve = boto3.client('bedrock-runtime', region_name='us-east-1')  # for knowledge base retrieval
bedrock_retrieve = boto3.client('bedrock-agent-runtime', region_name='us-east-1')  # for knowledge base retrieval
bedrock_invoke = boto3.client('bedrock-runtime', region_name='us-east-1')    # for model invocation
dynamodb = boto3.client('dynamodb')  # for document status updates

# Google Document AI client import - import it later to avoid initialization issues
# from google.cloud import documentai
from google_auth import get_documentai_client

# Knowledge Base ID for retrieval (set in environment)
kb_id = os.environ.get('KB_ID')

# Import the necessary libraries for translation
import boto3

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


def update_iep_document_status(iep_id, status, error_message=None, child_id=None, summaries=None, user_id=None, object_key=None):
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
                
                if status == 'PROCESSED' and summaries:
                    # Format summaries and sections for DynamoDB storage using the new helper function
                    formatted_summaries = {"M": {}}
                    for lang, summary_content in summaries.get('summaries', {}).get('M', {}).items():
                        formatted_summaries["M"][lang] = summary_content
                    
                    formatted_sections = {"M": {}}
                    if 'sections' in summaries and 'M' in summaries['sections']:
                        for lang, sections_content in summaries['sections']['M'].items():
                            formatted_sections["M"][lang] = {"M": {}}
                            for section_name, section_data in sections_content.get('M', {}).items():
                                # Use the helper function to format each section
                                formatted_sections["M"][lang]["M"][section_name] = format_data_for_dynamodb(section_data)
                    
                    update_expr += ", summaries = :summaries, sections = :sections"
                    expr_attr_values[':summaries'] = formatted_summaries
                    expr_attr_values[':sections'] = formatted_sections
                    
                    # Removed tags handling
                    
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
                    
                # Add document URL field
                bucket_name = os.environ.get('BUCKET', '')
                filename = object_key.split('/')[-1] if object_key else iep_id
                item['documentUrl'] = f"s3://{bucket_name}/{user_id}/{child_id}/{iep_id}/{filename}"
                    
                if error_message:
                    item['errorMessage'] = error_message
                    
                if status == 'PROCESSED' and summaries:
                    # Format summaries and sections for DynamoDB storage
                    formatted_summaries = {}
                    for lang, summary_content in summaries.get('summaries', {}).get('M', {}).items():
                        formatted_summaries[lang] = summary_content.get('S', '')
                    
                    formatted_sections = {}
                    if 'sections' in summaries and 'M' in summaries['sections']:
                        formatted_sections = {}
                        for lang, sections_content in summaries['sections']['M'].items():
                            formatted_sections[lang] = {}
                            for section_name, section_data in sections_content.get('M', {}).items():
                                # Convert from DynamoDB format back to Python dict for storage
                                if isinstance(section_data, dict) and 'M' in section_data:
                                    formatted_section = {}
                                    for k, v in section_data['M'].items():
                                        if 'S' in v:
                                            formatted_section[k] = v['S']
                                        elif 'BOOL' in v:
                                            formatted_section[k] = v['BOOL']
                                        elif 'N' in v:
                                            formatted_section[k] = float(v['N'])
                                    formatted_sections[lang][section_name] = formatted_section
                
                    item['summaries'] = formatted_summaries
                    item['sections'] = formatted_sections
                
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
                            # Format summaries for UpdateItem 
                            formatted_summaries_update = {"M": {}}
                            for lang, summary_content in summaries.get('summaries', {}).get('M', {}).items():
                                formatted_summaries_update["M"][lang] = summary_content
                            
                            formatted_sections_update = {"M": {}}
                            if 'sections' in summaries and 'M' in summaries['sections']:
                                for lang, sections_content in summaries['sections']['M'].items():
                                    formatted_sections_update["M"][lang] = {"M": {}}
                                    for section_name, section_data in sections_content.get('M', {}).items():
                                        formatted_sections_update["M"][lang]["M"][section_name] = section_data
                            
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


def clean_translation(translated_text):
    """
    Clean translation output by removing any JSON formatting or explanatory text
    that might still be present in Claude's response.
    
    Args:
        translated_text (str): Raw translated text from Claude
        
    Returns:
        str: Cleaned translation text
    """
    if not translated_text:
        return ""
        
    # Remove JSON-like formatting 
    json_pattern = r'```(?:json)?\s*\{[\s\S]*?\}\s*```'
    cleaned_text = re.sub(json_pattern, '', translated_text)
    
    # Remove introductory sentences
    intro_patterns = [
        r'^here\'s the translation.*?:\s*', 
        r'^here\'s the content in.*?:\s*',
        r'^translation:\s*',
        r'^here is the.*?translation:?\s*',
        r'^the translation is:?\s*'
    ]
    
    for pattern in intro_patterns:
        cleaned_text = re.sub(pattern, '', cleaned_text, flags=re.IGNORECASE)
    
    # Remove any remaining JSON structure
    cleaned_text = re.sub(r'^\s*\{\s*"[^"]+"\s*:\s*"([\s\S]*?)"\s*\}\s*$', r'\1', cleaned_text)
    cleaned_text = re.sub(r'^\s*\{\s*"[^"]+"\s*:\s*\{\s*"[^"]+"\s*:\s*"([\s\S]*?)"\s*\}\s*\}\s*$', r'\1', cleaned_text)
    
    # Unescape any escaped quotes that might be inside the JSON strings
    cleaned_text = cleaned_text.replace('\\"', '"')
    
    return cleaned_text.strip()


def translate_content(content, target_languages):
    """
    Translate content to the specified target languages using Claude with custom prompts
    
    Args:
        content (str or dict): The content to translate. Either a string or a dict with text fields
        target_languages (list): List of language codes to translate to
        
    Returns:
        dict: Dictionary with original content and translations
    """
    if not target_languages or not content:
        print("No target languages specified or empty content, skipping translation")
        return {"original": content}
    
    print(f"Starting translation of content to languages: {target_languages}")
    
    # Debug: Log content type and length to better understand what we're translating
    content_type = type(content).__name__
    content_length = len(content) if isinstance(content, str) else "N/A (not a string)"
    print(f"Content type: {content_type}, length: {content_length}")
    
    # Debug: Print LANGUAGE_CODES to check available languages
    print(f"Available language codes: {json.dumps(LANGUAGE_CODES, indent=2)}")
    
    # Initialize bedrock runtime client for Claude
    bedrock_runtime = boto3.client('bedrock-runtime')
    result = {"original": content}
    
    # Use Claude 3.5 Sonnet for better translation quality
    model_id = os.environ.get('CLAUDE_MODEL_ID', 'anthropic.claude-3-5-sonnet-20240620-v1:0')
    print(f"Using Claude model: {model_id} for translation")
    
    for lang_code in target_languages:
        try:
            print(f"Translating content to {lang_code}...")
            
            # Find the language name from language code for the prompt
            language_name = next((name for name, code in LANGUAGE_CODES.items() 
                               if code == lang_code), lang_code)
            
            print(f"Found language name: {language_name} for code: {lang_code}")
            
            if isinstance(content, str):
                # Get the translation prompt for the specific language
                prompt = get_translation_prompt(content, language_name)
                print(f"Generated translation prompt for string content (length: {len(prompt)})")
                
                # Debug: Log the first 100 chars of the prompt
                print(f"Prompt start: {prompt[:100]}...")
                
                # Call Claude to translate
                print(f"Calling Claude to translate to {language_name}...")
                response = bedrock_runtime.invoke_model(
                    modelId=model_id,
                    body=json.dumps({
                        'anthropic_version': 'bedrock-2023-05-31',
                        'max_tokens': 4000,
                        'temperature': 0,
                        'system': 'You are an expert translator specializing in educational documents, particularly IEPs.',
                        'messages': [
                            {'role': 'user', 'content': prompt}
                        ]
                    })
                )
                
                # Parse the response
                response_body = json.loads(response['body'].read().decode('utf-8'))
                print(f"Received response from Claude for {language_name} translation")
                
                # Log the response structure
                print(f"Response structure keys: {list(response_body.keys())}")
                
                # Extract translated text
                translated_text = ""
                if 'content' in response_body:
                    if isinstance(response_body['content'], list):
                        for block in response_body['content']:
                            if 'text' in block:
                                translated_text += block['text']
                    else:
                        translated_text = response_body['content']
                elif 'completion' in response_body:
                    translated_text = response_body['completion']
                
                # Clean up the translation to remove any JSON structure or explanatory text
                translated_text = clean_translation(translated_text)
                
                # Log the length of translated text
                print(f"Translated text length: {len(translated_text) if translated_text else 0}")
                
                result[lang_code] = translated_text.strip()
                print(f"Successfully added {lang_code} translation to result (length: {len(translated_text.strip())})")
                
            elif isinstance(content, dict):
                # Translate each field in the dictionary
                translated_dict = {}
                print(f"Content is a dictionary with {len(content)} fields, translating each field...")
                for key, value in content.items():
                    if isinstance(value, str) and value.strip():
                        prompt = get_translation_prompt(value, language_name)
                        print(f"Translating field '{key}' to {language_name}...")
                        
                        # Call Claude to translate
                        response = bedrock_runtime.invoke_model(
                            modelId=model_id,
                            body=json.dumps({
                                'anthropic_version': 'bedrock-2023-05-31',
                                'max_tokens': 2000,
                                'temperature': 0.1,
                                'system': 'You are an expert translator specializing in educational documents, particularly IEPs.',
                                'messages': [
                                    {'role': 'user', 'content': prompt}
                                ]
                            })
                        )
                        
                        # Parse the response
                        response_body = json.loads(response['body'].read().decode('utf-8'))
                        
                        # Extract translated text
                        translated_text = ""
                        if 'content' in response_body:
                            if isinstance(response_body['content'], list):
                                for block in response_body['content']:
                                    if 'text' in block:
                                        translated_text += block['text']
                            else:
                                translated_text = response_body['content']
                        elif 'completion' in response_body:
                            translated_text = response_body['completion']
                        
                        # Clean the translation
                        translated_text = clean_translation(translated_text)
                        
                        translated_dict[key] = translated_text.strip()
                        print(f"Translated field '{key}' to {language_name} (length: {len(translated_text.strip())})")
                    else:
                        # Keep non-string values or empty strings as is
                        translated_dict[key] = value
                        print(f"Skipped translation for field '{key}' (not a string or empty)")
                        
                result[lang_code] = translated_dict
                print(f"Successfully added dictionary translation for {lang_code} with {len(translated_dict)} fields")
                
            print(f"Successfully translated content to {lang_code}")
            
        except Exception as e:
            print(f"Error translating to {lang_code}: {str(e)}")
            traceback.print_exc()
            # Skip this language if translation fails
            continue
    
    # Log the final result structure
    result_languages = list(result.keys())
    print(f"Translation complete. Result contains languages: {result_languages}")
    
    return result


def summarize_and_categorize(content_text):
    """
    Extract summary and sections from document content using Claude.
    
    Args:
        content_text (str): The text content from the document
        
    Returns:
        dict: Contains summary and sections
    """
    # Update to Claude 3.5 Sonnet for better performance
    model_id = 'anthropic.claude-3-5-sonnet-20240620-v1:0'
    
    # Truncate the content if it's too long
    max_content_length = 65000  # Claude has a token limit
    if len(content_text) > max_content_length:
        print(f"Content too long ({len(content_text)} chars), truncating to {max_content_length} chars")
        content_text = content_text[:max_content_length]
    
    # Ensure content is valid
    if not content_text or not content_text.strip():
        print("Empty document content, cannot summarize")
        return {
            'summary': '',
            'sections': []
        }
    
    try:
        # Create a clear and consistent prompt for Claude
        prompt = f"""
You are an expert IEP document summarizer. Analyze the following student IEP document and extract the key information.
Extract the following:
1. A short summary (3-4 sentences) of the entire document focusing on the student's needs, goals, and accommodations
2. Structured sections based on the document's content 

Format your response as a JSON object with the following structure:
```json
{{
  "summary": "A concise summary of the document",
  "sections": [
    {{
      "title": "Section title",
      "content": "Section content"
    }}
  ]
}}
```

IMPORTANT: Your response MUST be valid JSON only. No introduction, explanation, or markdown outside the JSON.

Document content:
{content_text}
"""
        
        # Call Claude
        bedrock_runtime = boto3.client('bedrock-runtime')
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 4000,
                'temperature': 0.1,
                'system': 'You are an expert in analyzing and summarizing educational documents, especially Individualized Education Programs (IEPs).',
                'messages': [
                    {'role': 'user', 'content': prompt}
                ]
            })
        )
        
        # Parse response from Claude
        response_body = json.loads(response['body'].read().decode('utf-8'))
        
        # Log the raw output for debugging
        print(f"Raw Claude output: {json.dumps(response_body)[:500]}...")
        
        # Extract text content from Claude's response
        content = ''
        if 'content' in response_body:
            if isinstance(response_body['content'], list):
                # Handle message format with content blocks
                for block in response_body['content']:
                    if 'text' in block:
                        content += block['text']
            elif isinstance(response_body['content'], str):
                # Handle direct content string
                content = response_body['content']
        elif 'completion' in response_body:
            # Handle simple completion response format
            content = response_body['completion']
        else:
            print(f"Unexpected Claude response format: {response_body.keys()}")
            # Try to find any usable text in the response
            content = str(response_body)
        
        # Extract JSON from content
        # Look for JSON in various formats (fenced code blocks, within content, etc.)
        print(f"Attempting to extract JSON from content: {content[:200]}...")
        
        # Try different regex patterns to find JSON
        json_patterns = [
            # Match JSON between ```json and ``` markers
            r'```(?:json)?\s*([\s\S]*?)\s*```',
            # Match a complete JSON object (assuming one is present)
            r'(?s)\{.*\}',
            # Match a complete JSON array (assuming one is present)
            r'(?s)\[.*\]'
        ]
        
        result_json = None
        
        for pattern in json_patterns:
            matches = re.findall(pattern, content)
            if matches:
                for match in matches:
                    try:
                        candidate = json.loads(match)
                        # Check if it has the expected structure
                        if isinstance(candidate, dict) and 'summary' in candidate:
                            result_json = candidate
                            break
                    except json.JSONDecodeError:
                        continue
                if result_json:
                    break
        
        # If no valid JSON found, create a fallback structure
        if not result_json:
            print("Could not parse JSON from the Claude response, using fallback structure")
            # Extract something that looks like a summary
            summary_match = re.search(r'summary["\s:]+([^"]*)', content, re.IGNORECASE)
            summary = summary_match.group(1).strip() if summary_match else "No summary available"
            
            # Create a default structure
            result_json = {
                'summary': summary,
                'sections': []
            }
        
        # Validate and clean up the result
        if not result_json.get('summary'):
            result_json['summary'] = "No summary available"
        
        # Ensure sections is a list of dictionaries with title and content
        if 'sections' not in result_json or not isinstance(result_json['sections'], list):
            result_json['sections'] = []
        
        # Log success
        print(f"Successfully extracted summary and sections from document")
        return result_json
        
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


def extract_text_from_pdf(file_content):
    """
    Extract text from a PDF file using PyPDF2 as a fallback.
    
    Args:
        file_content (bytes): The PDF file content as bytes
        
    Returns:
        str: The extracted text
    """
    try:
        print(f"Using PyPDF2 fallback to extract text from PDF")
        pdf_reader = PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error extracting text from PDF with PyPDF2: {e}")
        return None


def summarize_and_analyze_document(file_content, user_profile=None):
    """Analyze a document to extract text and generate a summary."""
    print("Analyzing document...")
    
    try:
        # Extract text from the document using Google Document AI with PyPDF2 fallback
        from google_auth import process_document, get_documentai_client
        
        # Get Document AI client and process the document
        documentai_client = get_documentai_client()
        project_id = os.environ.get('DOCUMENT_AI_PROJECT_ID')
        location = os.environ.get('DOCUMENT_AI_LOCATION', 'us-central1')
        processor_id = os.environ.get('DOCUMENT_AI_PROCESSOR_ID')
        
        print(f"Processing document with Google Document AI (project: {project_id}, location: {location}, processor: {processor_id})")
        
        # Create request to process document
        name = documentai_client.processor_path(project_id, location, processor_id)
        
        # Process document with Document AI
        document_result = documentai_client.process_document(
                                request={
                'name': name,
                'raw_document': {
                    'content': file_content,
                    'mime_type': 'application/pdf'
                }
            }
        )
        
        # Check if text extraction was successful
        extracted_text = None
        
        if hasattr(document_result, 'document') and hasattr(document_result.document, 'text'):
            extracted_text = document_result.document.text
            
            # Check if the result came from the fallback method
            if hasattr(document_result, 'from_fallback') and document_result.from_fallback:
                print("Text successfully extracted using PyPDF2 fallback")
            else:
                print("Text successfully extracted using Google Document AI")
        
        # If Document AI failed, try the direct PDF extraction fallback
        if not extracted_text:
            print("Document AI text extraction failed, trying direct PDF fallback")
            extracted_text = extract_text_from_pdf(file_content)
            
            if extracted_text:
                print("Text successfully extracted using direct PDF fallback")
        
        # Only proceed if we successfully extracted text
        if not extracted_text:
            return {
                "success": False,
                "error": "Failed to extract text from the document"
            }

        # Summarize and categorize the document
        result = summarize_and_categorize(extracted_text)
        
        # Handle language preferences from user profile
        target_languages = []
        
        if user_profile:
            if 'languages' in user_profile:
                # Use the existing languages array from user profile
                all_languages = user_profile.get('languages', [])
                print(f"Using languages from user profile: {all_languages}")
                
                # Only include non-English languages for translation
                target_languages = [lang for lang in all_languages if lang != 'en']
                if target_languages:
                    print(f"Target languages for translation: {target_languages}")
                else:
                    print("No non-English languages found for translation")
            else:
                print("No 'languages' field found in user profile")
        else:
            print("No user profile provided, skipping translations")
        
        # Translate summary if target languages are specified
        if target_languages:
            print(f"Translating content to: {', '.join(target_languages)}")
            if 'summary' in result:
                result['summary'] = translate_content(result['summary'], target_languages)
            
            # Translate each section
            if 'sections' in result:
                translated_sections = []
                for section in result['sections']:
                    translated_section = section.copy()
                    # Translate the content of the section
                    if 'content' in section:
                        translated_section['content'] = translate_content(section['content'], target_languages)
                    translated_sections.append(translated_section)
                result['sections'] = translated_sections
        
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


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

def handle_s3_upload_event(event):
    """Handle S3 event for document processing"""
    # Extract information from the event
    try:
        record = event['Records'][0]
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']
        
        # URL decode the key to handle special characters (spaces, +, etc.)
        key = urllib.parse.unquote_plus(key)
        
        print(f"Processing document from S3 bucket: {bucket}, key: {key}")
        
        # Extract user ID, child ID, and IEP ID from the key
        # Actual format: [userId]/[childId]/[iepId]/[fileName]
        key_parts = key.split('/')
        user_id = None
        child_id = None
        iep_id = None
        
        if len(key_parts) >= 3:
            user_id = key_parts[0]
            child_id = key_parts[1]
            # The iepId part might be prefixed with "iep-" which we want to preserve
            if len(key_parts) >= 3:
                iep_id = key_parts[2]
            
            print(f"Extracted from key: userId={user_id}, childId={child_id}, iepId={iep_id}")
        else:
            print(f"Warning: S3 key doesn't match expected format. Key: {key}")
        
        # Get the document from S3
        try:
            s3 = boto3.client('s3')
            response = s3.get_object(Bucket=bucket, Key=key)
            file_content = response['Body'].read()
        except Exception as s3_error:
            print(f"Error retrieving object from S3: {str(s3_error)}")
            # Check if we might be dealing with URL encoding issues
            if 'NoSuchKey' in str(s3_error) and '%' in key:
                try:
                    # Try a different URL decoding approach
                    alternate_key = urllib.parse.unquote(key)
                    print(f"Retrying with alternate key: {alternate_key}")
                    response = s3.get_object(Bucket=bucket, Key=alternate_key)
                    file_content = response['Body'].read()
                except Exception as retry_error:
                    print(f"Retry also failed: {str(retry_error)}")
                    raise
            else:
                raise
        
        # Get user profile for language preferences
        user_profile = None
        if user_id:
            user_profile = get_user_profile(user_id)
            
        # Log language preferences
        if user_profile and 'languages' in user_profile:
            print(f"User has language preferences: {user_profile.get('languages', [])}")
        else:
            print("No language preferences found in user profile")
        
        # Process the document using our new function with user profile for translations
        analysis_result = summarize_and_analyze_document(file_content, user_profile)
        
        if not analysis_result.get('success', False):
            print(f"Error processing document: {analysis_result.get('error', 'Unknown error')}")
            return {
                'statusCode': 500,
                'body': json.dumps({
                    'message': f"Error processing document: {analysis_result.get('error', 'Unknown error')}"
                })
            }
        
        result = analysis_result.get('result', {})
        
        # Use the IEP ID from the S3 key path if available, otherwise generate a new one
        if not iep_id:
            iep_id = str(uuid.uuid4())
            print(f"Generated new iepId: {iep_id}")
        else:
            print(f"Using iepId from path: {iep_id}")
        
        # Format summaries for DynamoDB storage - handle both original and translated content
        formatted_summaries = {"M": {}}
        
        # Format the English summary (always present)
        if isinstance(result.get('summary'), str):
            # Original summary is a simple string (no translations yet)
            formatted_summaries["M"]["en"] = {"S": result.get('summary', '')}
        elif isinstance(result.get('summary'), dict):
            # Summary includes translations
            if 'original' in result['summary']:
                # Store English as the original
                formatted_summaries["M"]["en"] = {"S": result['summary']['original']}
                
                # Add all translated versions
                for lang_code, translated_text in result['summary'].items():
                    if lang_code != 'original':
                        formatted_summaries["M"][lang_code] = {"S": translated_text}
        
        # Format sections for DynamoDB storage
        # Make sure we initialize both 'en' and any translated language entries
        formatted_sections = {"M": {}}
        sections = result.get('sections', [])
        
        # Always ensure there's an 'en' entry for sections
        formatted_sections["M"]["en"] = {"M": {}}
        
        # Get the list of all languages we'll be handling
        all_languages = ['en']  # Always include English
        if user_profile and 'languages' in user_profile:
            # Add any other languages from user profile
            for lang in user_profile.get('languages', []):
                if lang != 'en' and lang not in all_languages:
                    all_languages.append(lang)
                    # Initialize the language section if it doesn't exist
                    if lang not in formatted_sections["M"]:
                        formatted_sections["M"][lang] = {"M": {}}
        
        print(f"Preparing section data for languages: {all_languages}")
        
        # Process each section
        for section in sections:
            section_title = section.get('title', 'Untitled Section')
            section_content = section.get('content', '')
            
            # Handle case where content might be a dict with translations
            if isinstance(section_content, str):
                # Simple string content - English only
                if 'en' not in formatted_sections["M"]:
                    formatted_sections["M"]["en"] = {"M": {}}
                formatted_sections["M"]["en"]["M"][section_title] = {"S": section_content}
            elif isinstance(section_content, dict):
                # Content with translations
                if 'original' in section_content:
                    # Store English version
                    if 'en' not in formatted_sections["M"]:
                        formatted_sections["M"]["en"] = {"M": {}}
                    formatted_sections["M"]["en"]["M"][section_title] = {"S": section_content['original']}
                    
                    # Add translated versions
                    for lang_code, translated_text in section_content.items():
                        if lang_code != 'original':
                            if lang_code not in formatted_sections["M"]:
                                formatted_sections["M"][lang_code] = {"M": {}}
                            formatted_sections["M"][lang_code]["M"][section_title] = {"S": translated_text}
        
        # Print the section structure for debugging
        print(f"Formatted sections structure: {json.dumps(formatted_sections, default=str)[:500]}...")
        print(f"Section languages: {list(formatted_sections['M'].keys())}")
        print(f"English sections: {list(formatted_sections['M']['en']['M'].keys()) if 'en' in formatted_sections['M'] else 'None'}")
        
        # Prepare the summaries structure for DynamoDB
        summaries = {
            'summaries': formatted_summaries,
            'sections': formatted_sections
        }
        
        # Save the document data to DynamoDB - this now includes all language versions
        save_result = update_iep_document_status(
            iep_id=iep_id, 
            status='PROCESSED', 
            child_id=child_id, 
            summaries=summaries,
            user_id=user_id,
            object_key=key
        )
        
        print(f"Document saved to DynamoDB with iepId: {iep_id}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Document processed successfully',
                'iepId': iep_id,
                'saveResult': save_result
            })
        }
    except Exception as e:
        print(f"Error processing S3 event: {str(e)}")
        traceback.print_exc()
        return {
            'statusCode': 500, 
            'body': json.dumps({
                'message': f"Error processing S3 event: {str(e)}"
            })
        }
