"""
Combine all results into final mega JSON structure
"""
import json
import os
import boto3
import traceback

def lambda_handler(event, context):
    """
    Combine English results and translations into final mega JSON.
    Creates a comprehensive structure with all analysis and translation data.
    """
    print(f"CombineResults handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        target_languages = event.get('target_languages', [])
        
        # Get all results from DynamoDB via centralized DDB service
        lambda_client = boto3.client('lambda')
        ddb_service_name = os.environ.get('DDB_SERVICE_FUNCTION_NAME', 'DDBService')
        
        # Initialize final result structure (same format as API expects)
        final_result = {
            'summaries': {},
            'sections': {},
            'document_index': {},
            'abbreviations': {},
            'missingInfo': {}  # Changed to map with lang codes as keys
        }
        
        # 1. Get English parsing result
        english_payload = {
            'operation': 'get_analysis_data',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'data_type': 'english_result'
            }
        }
        
        english_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(english_payload)
        )
        
        # Handle Lambda invoke response safely
        english_payload_response = english_response['Payload'].read()
        
        if not english_payload_response:
            print("Empty response from DDB service for English result")
            english_ddb_result = {'statusCode': 404}
        else:
            try:
                english_ddb_result = json.loads(english_payload_response)
            except json.JSONDecodeError as e:
                print(f"Failed to parse English DDB service response as JSON: {e}. Response: {english_payload_response}")
                english_ddb_result = {'statusCode': 500}
        
        if english_ddb_result.get('statusCode') == 200:
            english_result = json.loads(english_ddb_result['body'])['data']
            
            # Extract and store in API-compatible format (note: parsing agent returns 'summary' not 'summaries')
            final_result['summaries']['en'] = english_result.get('summary', '')  # Fixed: was 'summaries', now 'summary'
            final_result['sections']['en'] = english_result.get('sections', [])
            final_result['document_index']['en'] = english_result.get('document_index', '')
            final_result['abbreviations']['en'] = english_result.get('abbreviations', [])
            
            print("Added English parsing result to final result")
        else:
            print("English parsing result not found")
            final_result['summaries']['en'] = ''
            final_result['sections']['en'] = []
            final_result['document_index']['en'] = ''
            final_result['abbreviations']['en'] = []
        
        # 2. Get English missing info result
        missing_info_payload = {
            'operation': 'get_analysis_data',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'data_type': 'missing_info_result'
            }
        }
        
        missing_info_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(missing_info_payload)
        )
        
        # Handle Lambda invoke response safely
        missing_info_payload_response = missing_info_response['Payload'].read()
        
        if not missing_info_payload_response:
            print("Empty response from DDB service for missing info result")
            missing_info_ddb_result = {'statusCode': 404}
        else:
            try:
                missing_info_ddb_result = json.loads(missing_info_payload_response)
            except json.JSONDecodeError as e:
                print(f"Failed to parse missing info DDB service response as JSON: {e}. Response: {missing_info_payload_response}")
                missing_info_ddb_result = {'statusCode': 500}
        
        if missing_info_ddb_result.get('statusCode') == 200:
            missing_info_result = json.loads(missing_info_ddb_result['body'])['data']
            
            # Debug logging for missing info
            print(f"DEBUG: Retrieved missing info result from DDB: {json.dumps(missing_info_result, indent=2)[:500]}")
            
            # Extract items from the missing info result (it's structured as {'iepId': x, 'items': [...]})
            if isinstance(missing_info_result, dict) and 'items' in missing_info_result:
                final_result['missingInfo']['en'] = missing_info_result['items']
            elif isinstance(missing_info_result, list):
                final_result['missingInfo']['en'] = missing_info_result
            else:
                final_result['missingInfo']['en'] = []
            
            print(f"DEBUG: Final missing info stored: {len(final_result['missingInfo']['en'])} items")
            print("Added English missing info result to final result")
        else:
            print("English missing info result not found")
            final_result['missingInfo']['en'] = []
        
        # 3. Get parsing translations if they exist
        if target_languages:
            parsing_translations_payload = {
                'operation': 'get_analysis_data',
                'params': {
                    'iep_id': iep_id,
                    'user_id': user_id,
                    'child_id': child_id,
                    'data_type': 'parsing_translations'
                }
            }
            
            parsing_translations_response = lambda_client.invoke(
                FunctionName=ddb_service_name,
                InvocationType='RequestResponse',
                Payload=json.dumps(parsing_translations_payload)
            )
            
            # Handle Lambda invoke response safely  
            parsing_translations_payload_response = parsing_translations_response['Payload'].read()
            
            if not parsing_translations_payload_response:
                print("Empty response from DDB service for parsing translations")
                parsing_translations_result = {'statusCode': 404}
            else:
                try:
                    parsing_translations_result = json.loads(parsing_translations_payload_response)
                except json.JSONDecodeError as e:
                    print(f"Failed to parse parsing translations DDB service response as JSON: {e}. Response: {parsing_translations_payload_response}")
                    parsing_translations_result = {'statusCode': 500}
            
            if parsing_translations_result.get('statusCode') == 200:
                parsing_translations = json.loads(parsing_translations_result['body'])['data']
                
                for lang, content in parsing_translations.items():
                    # Add translated parsing data to API-compatible format
                    final_result['summaries'][lang] = content.get('summaries', '')
                    final_result['sections'][lang] = content.get('sections', [])
                    final_result['document_index'][lang] = content.get('document_index', '')
                    final_result['abbreviations'][lang] = content.get('abbreviations', [])
                    
                print(f"Added parsing translations for {list(parsing_translations.keys())}")
            else:
                print("Parsing translations not found")
        
        # 4. Get missing info translations if they exist
        if target_languages:
            missing_info_translations_payload = {
                'operation': 'get_analysis_data',
                'params': {
                    'iep_id': iep_id,
                    'user_id': user_id,
                    'child_id': child_id,
                    'data_type': 'missing_info_translations'
                }
            }
            
            missing_info_translations_response = lambda_client.invoke(
                FunctionName=ddb_service_name,
                InvocationType='RequestResponse',
                Payload=json.dumps(missing_info_translations_payload)
            )
            
            # Handle Lambda invoke response safely
            missing_info_translations_payload_response = missing_info_translations_response['Payload'].read()
            
            if not missing_info_translations_payload_response:
                print("Empty response from DDB service for missing info translations")
                missing_info_translations_result = {'statusCode': 404}
            else:
                try:
                    missing_info_translations_result = json.loads(missing_info_translations_payload_response)
                except json.JSONDecodeError as e:
                    print(f"Failed to parse missing info translations DDB service response as JSON: {e}. Response: {missing_info_translations_payload_response}")
                    missing_info_translations_result = {'statusCode': 500}
            
            if missing_info_translations_result.get('statusCode') == 200:
                missing_info_translations = json.loads(missing_info_translations_result['body'])['data']
                
                # Add translated missing info to language map
                for lang, content in missing_info_translations.items():
                    final_result['missingInfo'][lang] = content if isinstance(content, list) else []
                    
                print(f"Added missing info translations for {list(missing_info_translations.keys())}")
            else:
                print("Missing info translations not found")
        
        print(f"Final result created with summaries in {len(final_result['summaries'])} languages, sections in {len(final_result['sections'])} languages, and missing info in {len(final_result['missingInfo'])} languages")
        
        # Don't pass through progress/current_step as they're managed by state machine
        event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
        return {
            **event_copy,
            'final_result': final_result,
            'combine_completed': True
        }
        
    except Exception as e:
        print(f"CombineResults error: {str(e)}")
        print(traceback.format_exc())
        raise
