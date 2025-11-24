"""
Check user language preferences to determine if translations are needed
"""
import json
import os
import boto3

def lambda_handler(event, context):
    """
    Check user language preferences and determine if translations are needed.
    Returns the target languages for translation.
    """
    print(f"CheckLanguagePrefs handler received: {json.dumps(event)}")
    
    try:
        user_id = event['user_id']
        
        # Get user language preferences from their profile
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ['USER_PROFILES_TABLE'])
        
        try:
            response = table.get_item(Key={'userId': user_id})
            
            if 'Item' not in response:
                print(f"No user profile found for {user_id}, no translation needed")
                target_languages = []
            else:
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
                
                if not target_languages:
                    print(f"No non-English languages found for user {user_id}")
                
        except Exception as e:
            print(f"Error accessing user profile for {user_id}: {str(e)}")
            target_languages = []  # Default to no translation on error
        
        print(f"User {user_id} needs translation for: {target_languages}")
        
        # Preserve progress/current_step/status values in state machine state
        # These are managed by the state machine but need to be preserved through this step
        result = {
            **event,  # Preserve all input including progress tracking
            'translation_needed': len(target_languages) > 0,
            'target_languages': target_languages
        }
        return result
        
    except Exception as e:
        print(f"CheckLanguagePrefs error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise
