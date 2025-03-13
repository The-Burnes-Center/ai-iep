import os
import json
import boto3
import traceback
import urllib.parse
from document_processor import summarize_and_analyze_document
from database import update_iep_document_status, get_user_profile, get_document_metadata_by_id
import uuid

# Initialize AWS clients
s3 = boto3.client('s3')

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

def handle_s3_upload_event(event):
    """Handle S3 event for document processing"""
    # Initialize variables that will be used in the exception handler
    iep_id = None
    child_id = None
    user_id = None
    key = None
    
    try:
        # Extract information from the event
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
            error_message = analysis_result.get('error', 'Unknown error')
            print(f"Error processing document: {error_message}")
            
            # Update the document status as FAILED
            update_iep_document_status(
                iep_id=iep_id,
                status='FAILED',
                error_message=error_message,
                child_id=child_id,
                user_id=user_id,
                object_key=key
            )
            
            print(f"Updated document status to FAILED in database for iepId: {iep_id}")
            
            return {
                'statusCode': 500,
                'body': json.dumps({
                    'message': f"Error processing document: {error_message}"
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
                'childId': child_id
            })
        }
    except Exception as e:
        error_message = f"Unhandled exception during document processing: {str(e)}"
        print(error_message)
        traceback.print_exc()
        
        # Update document status as FAILED if we have enough information
        if iep_id:
            try:
                update_iep_document_status(
                    iep_id=iep_id,
                    status='FAILED',
                    error_message=error_message,
                    child_id=child_id,
                    user_id=user_id,
                    object_key=key
                )
                print(f"Updated document status to FAILED in database for iepId: {iep_id}")
            except Exception as db_error:
                print(f"Error updating document status in database: {str(db_error)}")
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': error_message
            })
        } 