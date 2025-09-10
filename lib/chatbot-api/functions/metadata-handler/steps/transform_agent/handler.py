"""
Translate content based on user language preferences - Core business logic only
"""
import json
import os
import traceback
import boto3
from open_ai_agent import OpenAIAgent

def get_user_language_preferences(user_id):
    """
    Get user's language preferences from their profile.
    Returns list of language codes to translate to (excluding English)
    """
    if not user_id:
        print("No user_id provided, skipping translation")
        return []  # Skip translation if no user_id
    
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ['USER_PROFILES_TABLE'])
        
        try:
            response = table.get_item(Key={'userId': user_id})
            
            if 'Item' not in response:
                print(f"No user profile found for {user_id}, skipping translation")
                return []  # Skip translation if no user profile
            
            user_profile = response['Item']
            target_languages = set()  # Use set to avoid duplicates
            
            # Add primary language if it exists and is not English
            primary_lang = user_profile.get('primaryLanguage')
            if primary_lang and primary_lang != 'en':
                target_languages.add(primary_lang)
                print(f"Added primary language: {primary_lang}")
            
            # Add secondary language if it exists and is not English
            secondary_lang = user_profile.get('secondaryLanguage')
            if secondary_lang and secondary_lang != 'en':
                target_languages.add(secondary_lang)
                print(f"Added secondary language: {secondary_lang}")
            
            # Convert set to list
            target_languages = list(target_languages)
            
            # If no non-English languages found, return empty list (skip translation)
            if not target_languages:
                print(f"No non-English languages found for user {user_id}, skipping translation")
                return []
            
            print(f"User {user_id} target languages: {target_languages}")
            return target_languages
            
        except Exception as e:
            print(f"Error accessing user profile for {user_id}: {str(e)}")
            return []  # Skip translation on error
            
    except Exception as e:
        print(f"Error setting up DynamoDB connection: {str(e)}")
        return []  # Skip translation on error

def lambda_handler(event, context):
    """
    Translate content based on user language preferences.
    Core translation logic only - DDB operations handled by centralized service.
    """
    print(f"TransformAgent handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        
        print("Retrieving analysis results from DynamoDB...")
        
        # Get English analysis result from DynamoDB via centralized DDB service
        import boto3
        
        lambda_client = boto3.client('lambda')
        ddb_service_name = os.environ.get('DDB_SERVICE_FUNCTION_NAME', 'DDBService')
        
        # Get English analysis result
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
        
        # Get missing info result 
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
        missing_info_result = {}
        if missing_info_ddb_result.get('statusCode') == 200:
            missing_info_result = json.loads(missing_info_ddb_result['body'])['data']
        else:
            print("Missing info result not found, proceeding without it")
        
        print("Starting translation process")
        
        # Get user's language preferences
        target_languages = get_user_language_preferences(user_id)
        
        if not target_languages:
            print("No target languages found, skipping translation and returning English-only result")
            
            # Save English-only final result directly to DynamoDB
            final_result_payload = {
                'operation': 'save_results',
                'params': {
                    'iep_id': iep_id,
                    'user_id': user_id,
                    'child_id': child_id,
                    'results': {
                        'en': english_result,
                        'missing_info': missing_info_result
                    },
                    'result_type': 'final_multilingual'
                }
            }
            
            final_result_response = lambda_client.invoke(
                FunctionName=ddb_service_name,
                InvocationType='RequestResponse',
                Payload=json.dumps(final_result_payload)
            )
            
            final_result_ddb_result = json.loads(final_result_response['Payload'].read())
            if final_result_ddb_result.get('statusCode') != 200:
                raise Exception(f"Failed to save English-only result to DDB: {final_result_ddb_result}")
            
            print("English-only result saved successfully")
            
            # Don't pass through progress/current_step as they're managed by state machine
            event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
            return {
                **event_copy,
                'translation_skipped': True,
                'languages_processed': ['en'],
                'final_result': {
                    'en': english_result,
                    'missing_info': missing_info_result
                }
            }
        
        print(f"Translating to languages: {target_languages}")
        
        # Create OpenAI agent for translation
        agent = OpenAIAgent()
        
        # Translate English result to target languages
        translated_results = {'en': english_result}  # Always include English
        
        for lang in target_languages:
            print(f"Translating content to {lang}")
            
            translated_content = agent.translate_content(english_result, lang)
            
            if "error" in translated_content:
                print(f"Translation to {lang} failed: {translated_content['error']}")
                # Continue with other languages instead of failing completely
                continue
            
            translated_results[lang] = translated_content
            print(f"Translation to {lang} completed successfully")
        
        print(f"Translation completed for {len(translated_results)} languages")
        
        # Combine with missing info results
        final_result = {
            **translated_results,
            'missing_info': missing_info_result
        }
        
        # Save final multilingual result to DynamoDB
        final_result_payload = {
            'operation': 'save_results',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'results': final_result,
                'result_type': 'final_multilingual'
            }
        }
        
        final_result_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(final_result_payload)
        )
        
        final_result_ddb_result = json.loads(final_result_response['Payload'].read())
        if final_result_ddb_result.get('statusCode') != 200:
            raise Exception(f"Failed to save final multilingual result to DDB: {final_result_ddb_result}")
            
        print("Final multilingual result saved successfully")
        
        # Don't pass through progress/current_step as they're managed by state machine
        event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
        return {
            **event_copy,  # Pass through input data except progress tracking
            'translation_completed': True,
            'languages_processed': list(translated_results.keys()),
            'final_result': final_result
        }
        
    except Exception as e:
        print(f"TransformAgent error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error