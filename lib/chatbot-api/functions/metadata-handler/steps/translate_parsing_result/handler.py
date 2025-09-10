"""
Translate parsing agent results to target languages
"""
import json
import os
import boto3
import traceback
from open_ai_agent import OpenAIAgent

def lambda_handler(event, context):
    """
    Translate parsing agent results to target languages.
    """
    print(f"TranslateParsingResult handler received: {json.dumps(event)}")
    
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
                'parsing_translations': {},
                'translation_skipped': True
            }
        
        print(f"Translating parsing result to languages: {target_languages}")
        
        # Get English parsing result from DynamoDB via centralized DDB service
        lambda_client = boto3.client('lambda')
        ddb_service_name = os.environ.get('DDB_SERVICE_FUNCTION_NAME', 'DDBService')
        
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
        if english_ddb_result.get('statusCode') != 200:
            raise Exception(f"Failed to get English analysis data from DDB: {english_ddb_result}")
        
        english_result = json.loads(english_ddb_result['body'])['data']
        print(f"Retrieved English parsing result with {len(english_result.get('sections', []))} sections")
        
        # Create OpenAI agent for translation
        agent = OpenAIAgent()
        
        # Translate parsing result to target languages
        parsing_translations = {}
        
        for lang in target_languages:
            print(f"Translating parsing result to {lang}")
            
            translated_content = agent.translate_content(english_result, lang)
            
            if "error" in translated_content:
                print(f"Translation to {lang} failed: {translated_content['error']}")
                # Continue with other languages instead of failing completely
                continue
            
            parsing_translations[lang] = translated_content
            print(f"Translation to {lang} completed successfully")
        
        print(f"Parsing translation completed for {len(parsing_translations)} languages")
        
        # Save parsing translations to DynamoDB
        save_payload = {
            'operation': 'save_results',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'results': parsing_translations,
                'result_type': 'parsing_translations'
            }
        }
        
        save_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(save_payload)
        )
        
        save_result = json.loads(save_response['Payload'].read())
        if save_result.get('statusCode') != 200:
            raise Exception(f"Failed to save parsing translations to DDB: {save_result}")
        
        print("Parsing translations saved successfully")
        
        # Don't pass through progress/current_step as they're managed by state machine
        event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
        return {
            **event_copy,
            'parsing_translations': parsing_translations,
            'parsing_translation_completed': True,
            'languages_processed': list(parsing_translations.keys())
        }
        
    except Exception as e:
        print(f"TranslateParsingResult error: {str(e)}")
        print(traceback.format_exc())
        raise
