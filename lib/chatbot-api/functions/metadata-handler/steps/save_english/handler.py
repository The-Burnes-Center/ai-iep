"""
Save English analysis results and update status to PROCESSING_TRANSLATIONS
"""
import json
import traceback
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_utils import update_progress, create_step_function_response, handle_step_error, format_dynamodb_attribute

def lambda_handler(event, context):
    """
    Save English results and update status to PROCESSING_TRANSLATIONS.
    Updates progress=70, current_step="english_saved"
    """
    print(f"SaveEnglish handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        
        # Get results from parallel execution
        parallel_results = event.get('parallel_results', [])
        
        # Find parsing agent results (should be first branch)
        english_result = None
        missing_info = []
        
        for result in parallel_results:
            if 'english_result' in result:
                english_result = result['english_result']
            if 'missing_info' in result:
                missing_info = result['missing_info']
        
        if not english_result:
            raise Exception("No English analysis results found from parallel execution")
        
        print(f"Saving English results for iepId: {iep_id}")
        
        # Format English result for DynamoDB
        print("Formatting English data for DynamoDB...")
        english_formatted = {
            'summaries': {'en': {'S': english_result.get('summary', '')}},
            'sections': {
                'en': {'L': [
                    {
                        'M': {
                            'title': {'S': section.get('title', '')},
                            'content': {'S': section.get('content', '')},
                            'page_numbers': {'L': [{'N': str(num)} for num in (section.get('page_numbers', []) or [])]}
                        }
                    } for section in english_result.get('sections', [])
                ]}
            },
            'document_index': {'en': {'S': english_result.get('document_index', '')}},
            'abbreviations': {
                'en': {'L': [
                    {
                        'M': {
                            'abbreviation': {'S': abbrev.get('abbreviation', '')},
                            'full_form': {'S': abbrev.get('full_form', '')}
                        }
                    } for abbrev in english_result.get('abbreviations', [])
                ]}
            }
        }
        
        # Add missing info if available
        additional_fields = {}
        if missing_info:
            additional_fields['missingInfo'] = missing_info
        
        # Update progress to English saved stage and save data
        update_progress(
            iep_id=iep_id,
            child_id=child_id,
            progress=70,
            current_step="english_saved",
            status="PROCESSING_TRANSLATIONS",
            additional_fields={
                'summaries': english_formatted['summaries'],
                'sections': english_formatted['sections'], 
                'document_index': english_formatted['document_index'],
                'abbreviations': english_formatted['abbreviations'],
                **additional_fields
            }
        )
        
        print(f"Successfully saved English results for iepId: {iep_id}")
        
        # Return event with saved English results
        response = create_step_function_response(event)
        response['english_result'] = english_result
        response['missing_info'] = missing_info
        response['progress'] = 70
        response['current_step'] = "english_saved"
        
        return response
        
    except Exception as e:
        print(f"Error in SaveEnglish: {str(e)}")
        print(traceback.format_exc())
        
        iep_id = event.get('iep_id', 'unknown')
        child_id = event.get('child_id', 'unknown')
        
        return handle_step_error(iep_id, child_id, "SaveEnglish", e, 70)
