"""
Minimal translation handler for both parsing results and missing info
"""
import json
import os
import boto3
import traceback
from translation_agent import OptimizedTranslationAgent

def lambda_handler(event, context):
    """
    Unified translation handler that can translate both parsing results and missing info.
    
    Expected event parameters:
    - content_type: 'parsing_result' or 'missing_info'
    - target_languages: list of language codes
    - Other standard parameters (iep_id, user_id, child_id)
    """
    print(f"TranslateContent handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id'] 
        child_id = event['child_id']
        target_languages = event['target_languages']
        content_type = event.get('content_type', 'parsing_result')
        
        if not target_languages:
            print("No target languages provided, skipping translation")
            event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
            return {
                **event_copy,
                f'{content_type}_translations': {},
                'translation_skipped': True
            }
        
        print(f"Translating {content_type} to languages: {target_languages}")
        
        # Get source data from DynamoDB
        lambda_client = boto3.client('lambda')
        ddb_service_name = os.environ.get('DDB_SERVICE_FUNCTION_NAME', 'DDBService')
        
        # Configure data retrieval based on content type
        if content_type == 'parsing_result':
            data_type = 'english_result'
            result_key = 'parsing_translations'
            result_type = 'parsing_translations'  # Field name in DDB
        elif content_type == 'missing_info':
            data_type = 'missing_info_result'
            result_key = 'missing_info_translations'
            result_type = 'missing_info_translations'  # Field name in DDB
        else:
            raise ValueError(f"Unsupported content_type: {content_type}")
        
        source_payload = {
            'operation': 'get_analysis_data',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'data_type': data_type
            }
        }
        
        source_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(source_payload)
        )
        
        source_payload_response = source_response['Payload'].read()
        
        if not source_payload_response:
            if content_type == 'missing_info':
                print("Missing info result not found, skipping translation")
                event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
                return {
                    **event_copy,
                    result_key: {},
                    f'{content_type}_translation_skipped': True
                }
            else:
                raise Exception("Empty response from DDB service")
        
        try:
            source_ddb_result = json.loads(source_payload_response)
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse DDB service response as JSON: {e}")
        
        if source_ddb_result.get('statusCode') != 200:
            if content_type == 'missing_info':
                print("Missing info result not found, skipping translation")
                event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
                return {
                    **event_copy,
                    result_key: {},
                    f'{content_type}_translation_skipped': True
                }
            else:
                raise Exception(f"Failed to get {content_type} data from DDB: {source_ddb_result}")
        
        source_result = json.loads(source_ddb_result['body'])['data']
        print(f"Retrieved {content_type} data for translation")
        
        # Create optimized agent for translation with SSM fallback
        api_key = os.environ.get('OPENAI_API_KEY')
        
        # If encrypted or missing, fetch from SSM
        if not api_key or api_key.startswith('AQICA'):
            param_name = os.environ.get('OPENAI_API_KEY_PARAMETER_NAME')
            if param_name:
                try:
                    ssm = boto3.client('ssm')
                    response = ssm.get_parameter(Name=param_name, WithDecryption=True)
                    api_key = response['Parameter']['Value']
                    # Cache in environment for future use
                    os.environ['OPENAI_API_KEY'] = api_key
                    print("Successfully retrieved OPENAI_API_KEY from SSM")
                except Exception as e:
                    print(f"Error retrieving OPENAI_API_KEY from SSM: {str(e)}")
                    raise Exception("Failed to retrieve OPENAI_API_KEY from SSM")
        
        if not api_key:
            raise Exception("OPENAI_API_KEY not available from environment or SSM")
        
        optimized_agent = OptimizedTranslationAgent(api_key=api_key)
        
        # Translate content to target languages using agent framework
        translations = {}
        
        for lang in target_languages:
            print(f"Translating {content_type} to {lang} using optimized agent framework")
            
            # Use optimized agent-based translation for better quality and tool usage
            translated_content = optimized_agent.translate_content_with_agent(
                source_result, 
                lang, 
                content_type=content_type
            )
            
            if "error" in translated_content:
                print(f"Translation to {lang} failed: {translated_content['error']}")
                continue
            
            translations[lang] = translated_content
            print(f"Translation to {lang} completed successfully using optimized agent framework")
        
        print(f"{content_type} translation completed for {len(translations)} languages")
        
        # Save translations to DynamoDB
        save_payload = {
            'operation': 'save_results',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'results': translations,
                'result_type': result_type
            }
        }
        
        save_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(save_payload)
        )
        
        save_payload_response = save_response['Payload'].read()
        
        if not save_payload_response:
            raise Exception("Empty response from DDB service during save")
        
        try:
            save_result = json.loads(save_payload_response)
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse save DDB service response as JSON: {e}")
        
        if not save_result or save_result.get('statusCode') != 200:
            raise Exception(f"Failed to save {result_type} to DDB: {save_result}")
        
        print(f"{result_type} saved successfully")
        
        # Return result
        event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
        return {
            **event_copy,
            result_key: translations,
            f'{content_type}_translation_completed': True,
            'languages_processed': list(translations.keys())
        }
        
    except Exception as e:
        print(f"TranslateContent error: {str(e)}")
        print(traceback.format_exc())
        raise
