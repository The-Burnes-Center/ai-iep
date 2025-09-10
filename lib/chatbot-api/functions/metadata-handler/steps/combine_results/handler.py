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
        
        # Initialize final mega JSON structure
        mega_json = {
            'iep_id': iep_id,
            'user_id': user_id,
            'child_id': child_id,
            'languages_available': ['en'] + target_languages,
            'analysis': {},
            'missing_info': {}
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
        
        english_ddb_result = json.loads(english_response['Payload'].read())
        if english_ddb_result.get('statusCode') == 200:
            english_result = json.loads(english_ddb_result['body'])['data']
            mega_json['analysis']['en'] = english_result
            print("Added English parsing result to mega JSON")
        else:
            print("English parsing result not found")
            mega_json['analysis']['en'] = {}
        
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
        
        missing_info_ddb_result = json.loads(missing_info_response['Payload'].read())
        if missing_info_ddb_result.get('statusCode') == 200:
            missing_info_result = json.loads(missing_info_ddb_result['body'])['data']
            mega_json['missing_info']['en'] = missing_info_result
            print("Added English missing info result to mega JSON")
        else:
            print("English missing info result not found")
            mega_json['missing_info']['en'] = {}
        
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
            
            parsing_translations_result = json.loads(parsing_translations_response['Payload'].read())
            if parsing_translations_result.get('statusCode') == 200:
                parsing_translations = json.loads(parsing_translations_result['body'])['data']
                for lang, content in parsing_translations.items():
                    mega_json['analysis'][lang] = content
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
            
            missing_info_translations_result = json.loads(missing_info_translations_response['Payload'].read())
            if missing_info_translations_result.get('statusCode') == 200:
                missing_info_translations = json.loads(missing_info_translations_result['body'])['data']
                for lang, content in missing_info_translations.items():
                    mega_json['missing_info'][lang] = content
                print(f"Added missing info translations for {list(missing_info_translations.keys())}")
            else:
                print("Missing info translations not found")
        
        print(f"Mega JSON created with analysis in {len(mega_json['analysis'])} languages and missing info in {len(mega_json['missing_info'])} languages")
        
        # Don't pass through progress/current_step as they're managed by state machine
        event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
        return {
            **event_copy,
            'mega_json': mega_json,
            'final_result': mega_json,
            'combine_completed': True
        }
        
    except Exception as e:
        print(f"CombineResults error: {str(e)}")
        print(traceback.format_exc())
        raise
