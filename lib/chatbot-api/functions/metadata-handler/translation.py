import os
import json
import boto3
import traceback
import re
from config import TRANSLATION_SYSTEM_MSG, get_translation_prompt, LANGUAGE_CODES

def translate_content(content, target_languages):
    """
    Translate content to the specified target languages using Claude with custom prompts
    
    Args:
        content (str or dict): The content to translate. Either a string or a dict with text fields
        target_languages (list): List of language codes to translate to
        
    Returns:
        dict: Dictionary with original content and translations
    """
    if not target_languages or not content:
        print("No target languages specified or empty content, skipping translation")
        return {"original": content}
    
    print(f"Starting translation of content to languages: {target_languages}")
    
    # Debug: Log content type and length to better understand what we're translating
    content_type = type(content).__name__
    content_length = len(content) if isinstance(content, str) else "N/A (not a string)"
    print(f"Content type: {content_type}, length: {content_length}")
    
    # Debug: Print LANGUAGE_CODES to check available languages
    print(f"Available language codes: {json.dumps(LANGUAGE_CODES, indent=2)}")
    
    # Initialize bedrock runtime client for Claude
    bedrock_runtime = boto3.client('bedrock-runtime')
    result = {"original": content}
    
    # Use Claude 3.5 Sonnet for better translation quality
    model_id = os.environ.get('CLAUDE_MODEL_ID', 'anthropic.claude-3-5-sonnet-20240620-v1:0')
    print(f"Using Claude model: {model_id} for translation")
    
    for lang_code in target_languages:
        try:
            print(f"Translating content to {lang_code}...")
            
            # Find the language name from language code for the prompt
            language_name = next((name for name, code in LANGUAGE_CODES.items() 
                               if code == lang_code), lang_code)
            
            print(f"Found language name: {language_name} for code: {lang_code}")
            
            if isinstance(content, str):
                # Get the translation prompt for the specific language
                prompt = get_translation_prompt(content, language_name)
                print(f"Generated translation prompt for string content (length: {len(prompt)})")
                
                # Debug: Log the first 100 chars of the prompt
                print(f"Prompt start: {prompt[:100]}...")
                
                # Call Claude to translate
                print(f"Calling Claude to translate to {language_name}...")
                response = bedrock_runtime.invoke_model(
                    modelId=model_id,
                    body=json.dumps({
                        'anthropic_version': 'bedrock-2023-05-31',
                        'max_tokens': 4000,
                        'temperature': 0,
                        'system': TRANSLATION_SYSTEM_MSG,
                        'messages': [
                            {'role': 'user', 'content': prompt}
                        ]
                    })
                )
                
                # Parse the response
                response_body = json.loads(response['body'].read().decode('utf-8'))
                print(f"Received response from Claude for {language_name} translation")
                
                # Log the response structure
                print(f"Response structure keys: {list(response_body.keys())}")
                
                # Extract translated text
                translated_text = ""
                if 'content' in response_body:
                    if isinstance(response_body['content'], list):
                        for block in response_body['content']:
                            if 'text' in block:
                                translated_text += block['text']
                    else:
                        translated_text = response_body['content']
                elif 'completion' in response_body:
                    translated_text = response_body['completion']
                
                # Clean up the translation to remove any JSON structure or explanatory text
                translated_text = clean_translation(translated_text)
                
                # Log the length of translated text
                print(f"Translated text length: {len(translated_text) if translated_text else 0}")
                
                result[lang_code] = translated_text.strip()
                print(f"Successfully added {lang_code} translation to result (length: {len(translated_text.strip())})")
                
            elif isinstance(content, dict):
                # Translate each field in the dictionary
                translated_dict = {}
                print(f"Content is a dictionary with {len(content)} fields, translating each field...")
                for key, value in content.items():
                    if isinstance(value, str) and value.strip():
                        prompt = get_translation_prompt(value, language_name)
                        print(f"Translating field '{key}' to {language_name}...")
                        
                        # Call Claude to translate
                        response = bedrock_runtime.invoke_model(
                            modelId=model_id,
                            body=json.dumps({
                                'anthropic_version': 'bedrock-2023-05-31',
                                'max_tokens': 2000,
                                'temperature': 0.1,
                                'system': TRANSLATION_SYSTEM_MSG,
                                'messages': [
                                    {'role': 'user', 'content': prompt}
                                ]
                            })
                        )
                        
                        # Parse the response
                        response_body = json.loads(response['body'].read().decode('utf-8'))
                        
                        # Extract translated text
                        translated_text = ""
                        if 'content' in response_body:
                            if isinstance(response_body['content'], list):
                                for block in response_body['content']:
                                    if 'text' in block:
                                        translated_text += block['text']
                            else:
                                translated_text = response_body['content']
                        elif 'completion' in response_body:
                            translated_text = response_body['completion']
                        
                        # Clean the translation
                        translated_text = clean_translation(translated_text)
                        
                        translated_dict[key] = translated_text.strip()
                        print(f"Translated field '{key}' to {language_name} (length: {len(translated_text.strip())})")
                    else:
                        # Keep non-string values or empty strings as is
                        translated_dict[key] = value
                        print(f"Skipped translation for field '{key}' (not a string or empty)")
                        
                result[lang_code] = translated_dict
                print(f"Successfully added dictionary translation for {lang_code} with {len(translated_dict)} fields")
                
            print(f"Successfully translated content to {lang_code}")
            
        except Exception as e:
            print(f"Error translating to {lang_code}: {str(e)}")
            traceback.print_exc()
            # Skip this language if translation fails
            continue
    
    # Log the final result structure
    result_languages = list(result.keys())
    print(f"Translation complete. Result contains languages: {result_languages}")
    
    return result

def clean_translation(translated_text):
    """
    Clean translation output by removing any JSON formatting or explanatory text
    that might still be present in Claude's response.
    
    Args:
        translated_text (str): Raw translated text from Claude
        
    Returns:
        str: Cleaned translation text
    """
    if not translated_text:
        return ""
        
    # Remove JSON-like formatting 
    json_pattern = r'```(?:json)?\s*\{[\s\S]*?\}\s*```'
    cleaned_text = re.sub(json_pattern, '', translated_text)
    
    # Remove introductory sentences
    intro_patterns = [
        r'^here\'s the translation.*?:\s*', 
        r'^here\'s the content in.*?:\s*',
        r'^translation:\s*',
        r'^here is the.*?translation:?\s*',
        r'^the translation is:?\s*'
    ]
    
    for pattern in intro_patterns:
        cleaned_text = re.sub(pattern, '', cleaned_text, flags=re.IGNORECASE)
    
    # Remove any remaining JSON structure
    cleaned_text = re.sub(r'^\s*\{\s*"[^"]+"\s*:\s*"([\s\S]*?)"\s*\}\s*$', r'\1', cleaned_text)
    cleaned_text = re.sub(r'^\s*\{\s*"[^"]+"\s*:\s*\{\s*"[^"]+"\s*:\s*"([\s\S]*?)"\s*\}\s*\}\s*$', r'\1', cleaned_text)
    
    # Unescape any escaped quotes that might be inside the JSON strings
    cleaned_text = cleaned_text.replace('\\"', '"')
    
    return cleaned_text.strip() 