"""
Translate content based on user language preferences
"""
import json
import traceback
import boto3
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))
from shared_utils import update_progress, create_step_function_response, handle_step_error
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
            
            # If no languages specified or only English, return empty list (no translation needed)
            if not target_languages:
                print("No non-English languages specified in user profile, skipping translation")
                return []
            
            print(f"User {user_id} target languages for translation: {target_languages}")
            return target_languages
            
        except Exception as db_error:
            print(f"Error accessing user profile: {str(db_error)}")
            return ['zh', 'es', 'vi']  # All non-English languages as fallback
            
    except Exception as e:
        print(f"Error getting user language preferences: {str(e)}")
        print("Defaulting to all languages")
        return ['zh', 'es', 'vi']  # All non-English languages as fallback

def lambda_handler(event, context):
    """
    Translate content based on user language preferences.
    Updates progress=85, current_step="translations"
    """
    print(f"TransformAgent handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        english_result = event.get('english_result')
        missing_info = event.get('missing_info', [])
        
        print(f"Starting translation for iepId: {iep_id}")
        
        # Update progress to translations stage
        update_progress(
            iep_id=iep_id,
            child_id=child_id,
            progress=85,
            current_step="translations"
        )
        
        # Get user's language preferences for efficient translation
        target_languages = get_user_language_preferences(user_id)
        
        if not target_languages:
            print("No translation needed - user only requires English")
            # Skip translation and prepare English-only result
            final_result = {
                "summaries": {"en": english_result.get('summary', '')},
                "sections": {"en": english_result.get('sections', [])},
                "document_index": {"en": english_result.get('document_index', '')},
                "abbreviations": {"en": english_result.get('abbreviations', [])}
            }
        else:
            print(f"Starting translations to user's preferred languages: {target_languages}")
            
            # Create OpenAI Agent for translation (no OCR data needed for translation)
            agent = OpenAIAgent()
            
            # Translate the English data to user's preferred languages
            translation_result = agent.translate_document(english_result, target_languages=target_languages)
            
            # Check for error in the translation
            if "error" in translation_result:
                error_message = f"Translation failed: {translation_result.get('error')}"
                print(error_message)
                raise Exception(error_message)
            
            final_result = translation_result
        
        # Add missing info to the final result if available
        if missing_info:
            final_result['missing_info'] = missing_info
        
        print(f"Translation completed for iepId: {iep_id}")
        
        # Return event with final translation results
        response = create_step_function_response(event)
        response['final_result'] = final_result
        response['progress'] = 85
        response['current_step'] = "translations"
        
        return response
        
    except Exception as e:
        print(f"Error in TransformAgent: {str(e)}")
        print(traceback.format_exc())
        
        iep_id = event.get('iep_id', 'unknown')
        child_id = event.get('child_id', 'unknown')
        
        return handle_step_error(iep_id, child_id, "TransformAgent", e, 85)
