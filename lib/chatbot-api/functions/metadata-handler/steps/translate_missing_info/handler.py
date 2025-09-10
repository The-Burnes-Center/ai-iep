"""
Translate missing info agent results to target languages
"""
import json
import os
import boto3
import traceback
from open_ai_agent import OpenAIAgent

def lambda_handler(event, context):
    """
    Translate missing info agent results to target languages.
    """
    print(f"TranslateMissingInfo handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        target_languages = event['target_languages']
        
        if not target_languages:
            print("No target languages provided, skipping translation")
            event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
            return {
                **event_copy,
                'missing_info_translations': {},
                'translation_skipped': True
            }
        
        print(f"Translating missing info result to languages: {target_languages}")
        
        # Get missing info result from DynamoDB via centralized DDB service
        lambda_client = boto3.client('lambda')
        ddb_service_name = os.environ.get('DDB_SERVICE_FUNCTION_NAME', 'DDBService')
        
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
        
        # Missing info might not exist, handle gracefully
        if missing_info_ddb_result.get('statusCode') != 200:
            print("Missing info result not found, skipping translation")
            event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
            return {
                **event_copy,
                'missing_info_translations': {},
                'missing_info_translation_skipped': True
            }
        
        missing_info_result = json.loads(missing_info_ddb_result['body'])['data']
        print(f"Retrieved missing info result")
        
        # Create OpenAI agent for translation
        agent = OpenAIAgent()
        
        # Translate missing info result to target languages
        missing_info_translations = {}
        
        for lang in target_languages:
            print(f"Translating missing info result to {lang}")
            
            translated_content = agent.translate_content(missing_info_result, lang)
            
            if "error" in translated_content:
                print(f"Translation to {lang} failed: {translated_content['error']}")
                # Continue with other languages instead of failing completely
                continue
            
            missing_info_translations[lang] = translated_content
            print(f"Translation to {lang} completed successfully")
        
        print(f"Missing info translation completed for {len(missing_info_translations)} languages")
        
        # Save missing info translations to DynamoDB
        save_payload = {
            'operation': 'save_results',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'results': missing_info_translations,
                'result_type': 'missing_info_translations'
            }
        }
        
        save_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(save_payload)
        )
        
        save_result = json.loads(save_response['Payload'].read())
        if save_result.get('statusCode') != 200:
            raise Exception(f"Failed to save missing info translations to DDB: {save_result}")
        
        print("Missing info translations saved successfully")
        
        # Don't pass through progress/current_step as they're managed by state machine
        event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
        return {
            **event_copy,
            'missing_info_translations': missing_info_translations,
            'missing_info_translation_completed': True,
            'languages_processed': list(missing_info_translations.keys())
        }
        
    except Exception as e:
        print(f"TranslateMissingInfo error: {str(e)}")
        print(traceback.format_exc())
        raise
