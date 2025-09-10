"""
Translate content based on user language preferences - Core business logic only
"""
import json
import traceback
import boto3
from open_ai_agent import OpenAIAgent

def get_user_language_preferences(user_id):
    """
    Get user's language preferences from their profile.
    Returns list of language codes to translate to (excluding English)
    """
    if not user_id:
        print("No user_id provided, defaulting to all languages")
        return ['zh', 'es', 'vi']  # All non-English languages
    
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ['USER_PROFILES_TABLE'])
        
        try:
            response = table.get_item(Key={'userId': user_id})
            
            if 'Item' not in response:
                print(f"No user profile found for {user_id}, defaulting to all languages")
                return ['zh', 'es', 'vi']  # All non-English languages
            
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
            
            # If no non-English languages found, default to all
            if not target_languages:
                print(f"No non-English languages found for user {user_id}, defaulting to all")
                return ['zh', 'es', 'vi']
            
            print(f"User {user_id} target languages: {target_languages}")
            return target_languages
            
        except Exception as e:
            print(f"Error accessing user profile for {user_id}: {str(e)}")
            return ['zh', 'es', 'vi']  # Default to all languages on error
            
    except Exception as e:
        print(f"Error setting up DynamoDB connection: {str(e)}")
        return ['zh', 'es', 'vi']  # Default to all languages on error

def lambda_handler(event, context):
    """
    Translate content based on user language preferences.
    Core translation logic only - DDB operations handled by centralized service.
    """
    print(f"TransformAgent handler received: {json.dumps(event)}")
    
    try:
        user_id = event['user_id']
        english_result = event['english_result']
        missing_info_result = event.get('missing_info_result', {})
        
        print("Starting translation process")
        
        # Get user's language preferences
        target_languages = get_user_language_preferences(user_id)
        
        if not target_languages:
            print("No target languages found, returning English-only result")
            return {
                **event,
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
        
        return {
            **event,  # Pass through all input data
            'final_result': final_result
        }
        
    except Exception as e:
        print(f"TransformAgent error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error