"""
Save final multilingual results and mark as PROCESSED
"""
import json
import traceback
import boto3
import re
import sys
import os
from datetime import datetime
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_utils import update_progress, create_step_function_response, handle_step_error

def update_user_profile_with_summary(child_id, iep_id, user_id, s3_bucket):
    """
    Update the user profile with a reference to the IEP document.
    """
    try:
        if not user_id or not iep_id or not child_id:
            print(f"Invalid user_id or iep_id or child_id: {user_id}, {iep_id}, {child_id}. Cannot update user profile.")
            return
            
        print(f"Updating user profile for user_id: {user_id} with reference to document: {iep_id} and child_id: {child_id}")
        
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ['USER_PROFILES_TABLE'])
        
        # Get the profile directly
        response = table.get_item(Key={'userId': user_id})
        
        if 'Item' in response:
            user_profile = response['Item']
            print(f"Found user profile for userId: {user_id}")
            
            # Initialize document reference structure
            doc_reference = {
                'iepId': iep_id,
                'updatedAt': datetime.now().isoformat()
            }
            
            # Add documentUrl
            filename = f"{iep_id}"  # Use iep_id as filename since original is deleted
            doc_reference['documentUrl'] = f"s3://{s3_bucket}/{user_id}/{child_id}/{iep_id}/{filename}"
            
            # Find the child in the user's children array
            children = user_profile.get('children', [])
            child_index = None
            
            for i, child in enumerate(children):
                if child.get('childId') == child_id:
                    child_index = i
                    break
            
            if child_index is not None:
                print(f"Child found at index {child_index}, updating document references")
                
                # Update the user profile - store as a single document object
                try:
                    update_expr = f"SET children[{child_index}].iepDocument = :doc_ref"
                    expr_attr_values = {
                        ':doc_ref': doc_reference
                    }
                    
                    table.update_item(
                        Key={'userId': user_profile['userId']},
                        UpdateExpression=update_expr,
                        ExpressionAttributeValues=expr_attr_values
                    )
                    
                    print(f"Successfully updated user profile for child {child_id} with reference to document {iep_id}")
                    
                except Exception as e:
                    print(f"Error updating user profile: {e}")
                    # Not critical, continue
            else:
                print(f"Child ID {child_id} not found in user profile for user {user_id}")
                
    except Exception as e:
        print(f"Error updating user profile with document reference: {e}")
        # Not critical, continue

def lambda_handler(event, context):
    """
    Save final multilingual results and mark as PROCESSED.
    Updates progress=100, current_step="done", status="PROCESSED"
    """
    print(f"SaveFinal handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        s3_bucket = event['s3_bucket']
        final_result = event.get('final_result')
        
        if not final_result:
            raise Exception("No final results found to save")
        
        print(f"Saving final results for iepId: {iep_id}")
        
        # Format the complete result for DynamoDB
        print("Formatting complete multilingual data for DynamoDB...")
        formatted_result = {
            'summaries': {},
            'sections': {},
            'document_index': {},
            'abbreviations': {}
        }
        
        # Format summaries for DynamoDB
        if final_result.get('summaries'):
            formatted_result['summaries'] = {
                lang: {'S': summary} for lang, summary in final_result['summaries'].items()
            }
        
        # Format sections for DynamoDB
        if final_result.get('sections'):
            formatted_result['sections'] = {
                lang: {'L': [
                    {
                        'M': {
                            'title': {'S': section.get('title', '')},
                            'content': {'S': section.get('content', '')},
                            'page_numbers': {'L': [{'N': str(num)} for num in (section.get('page_numbers', []) or [])]}
                        }
                    } for section in final_result['sections'][lang]
                ]} for lang, sections in final_result['sections'].items()
            }
        
        # Format document index for DynamoDB
        if final_result.get('document_index'):
            formatted_result['document_index'] = {
                lang: {'S': index} for lang, index in final_result['document_index'].items()
            }
        
        # Format abbreviations for DynamoDB
        if final_result.get('abbreviations'):
            formatted_result['abbreviations'] = {
                lang: {'L': [
                    {
                        'M': {
                            'abbreviation': {'S': abbrev.get('abbreviation', '')},
                            'full_form': {'S': abbrev.get('full_form', '')}
                        }
                    } for abbrev in final_result['abbreviations'][lang]
                ]} for lang, abbreviations in final_result['abbreviations'].items()
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
        
        # Add missing info if available
        additional_fields = {}
        if final_result.get('missing_info'):
            additional_fields['missingInfo'] = final_result['missing_info']
        
        # Update progress to final stage and save complete data
        update_progress(
            iep_id=iep_id,
            child_id=child_id,
            progress=100,
            current_step="done",
            status="PROCESSED",
            additional_fields={
                'summaries': formatted_result['summaries'],
                'sections': formatted_result['sections'],
                'document_index': formatted_result['document_index'],
                'abbreviations': formatted_result['abbreviations'],
                **additional_fields
            }
        )
        
        # Update user profile with document reference
        try:
            update_user_profile_with_summary(child_id, iep_id, user_id, s3_bucket)
        except Exception as profile_error:
            print(f"Error updating user profile with summary: {str(profile_error)}")
            # Even if profile update fails, document processing is still successful
        
        print(f"Successfully saved final results for iepId: {iep_id} - processing complete!")
        
        # Return final response
        response = create_step_function_response(event)
        response['final_result'] = final_result
        response['progress'] = 100
        response['current_step'] = "done"
        response['status'] = "PROCESSED"
        
        return response
        
    except Exception as e:
        print(f"Error in SaveFinal: {str(e)}")
        print(traceback.format_exc())
        
        iep_id = event.get('iep_id', 'unknown')
        child_id = event.get('child_id', 'unknown')
        
        return handle_step_error(iep_id, child_id, "SaveFinal", e, 100)
