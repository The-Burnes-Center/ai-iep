import os
import json
import boto3
import traceback
import re
import logging
import time
from config import get_translation_prompt
from llm_service import invoke_claude_3_5, CLAUDE_MODELS

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Boto3 client for Bedrock
bedrock_runtime = boto3.client('bedrock-runtime')

# No need to configure a separate translation model as we'll use Claude 3.5 Sonnet

def translate_content(content, target_languages):
    """
    Translate content into specified target languages.
    
    Args:
        content: The content to translate (string or dict)
        target_languages: List of ISO language codes to translate into
    
    Returns:
        If content is string: dict with original and translations
        If content is dict: same dict with translated fields
    """
    # If no translation needed or content is empty, return as is
    if not target_languages or not content:
        logger.info(f"No translation needed: target_languages={target_languages}, content_length={len(content) if content and isinstance(content, str) else 'N/A'}")
        return content
    
    # Log the translation request
    logger.info(f"Translating content to {target_languages}, content type: {type(content)}, length: {len(content) if isinstance(content, str) else 'N/A'}")
    logger.info(f"Content preview: {content[:100] if isinstance(content, str) else 'Not a string'}")
    
    try:
        # Handle different content types appropriately
        if isinstance(content, str):
            # For simple string content, translate directly
            result = {"original": content}
            logger.info(f"Created translation result with original content length: {len(content)}")
            
            # Translate to each language
            for lang in target_languages:
                logger.info(f"------ Translating string content to {lang} ------")
                translated_text = translate_text(content, lang)
                logger.info(f"Received translation result for {lang}, type: {type(translated_text)}")
                
                if translated_text and len(translated_text.strip()) > 0:
                    result[lang] = translated_text
                    logger.info(f"Successfully added translation for {lang}, length: {len(translated_text)}")
                    logger.info(f"Preview of {lang} translation: {translated_text[:100]}")
                else:
                    logger.warning(f"Got empty or invalid translation result for {lang}: {translated_text}")
                
            # Log the final result structure    
            logger.info(f"Completed string translation with result keys: {list(result.keys())}")
            logger.info(f"Result contains translations for: {[k for k in result.keys() if k != 'original']}")
            for lang in result.keys():
                if lang != 'original':
                    logger.info(f"Final translation for {lang} preview: {result[lang][:50]}...")
            return result
        
        elif isinstance(content, dict):
            # If this is already a translated content dict with 'original' key
            if "original" in content:
                # Add any missing languages
                missing_langs = [lang for lang in target_languages if lang not in content]
                
                # Only translate missing languages
                if missing_langs:
                    original_text = content["original"]
                    for lang in missing_langs:
                        content[lang] = translate_text(original_text, lang)
                        
                return content
            
            # For other dictionaries, recursively translate each value
            result = {}
            for key, value in content.items():
                if isinstance(value, str) and value.strip():
                    # Translate string values
                    translated_dict = translate_content(value, target_languages)
                    result[key] = translated_dict
                elif isinstance(value, dict):
                    # Recursively translate nested dictionaries
                    result[key] = translate_content(value, target_languages)
                elif isinstance(value, list):
                    # Translate list items if they're strings
                    translated_list = []
                    for item in value:
                        if isinstance(item, str) and item.strip():
                            translated_item = translate_content(item, target_languages)
                            translated_list.append(translated_item)
                        else:
                            translated_list.append(item)
                    result[key] = translated_list
                else:
                    # Keep non-string values as they are
                    result[key] = value
                    
            return result
        
        else:
            # For other types (lists, etc.), return as is
            return content
    
    except Exception as e:
        logger.error(f"Error in translate_content: {str(e)}")
        traceback.print_exc()
        
        # Return original content in case of error
        return content

def translate_text(text, target_language):
    """
    Translate a specific text to a target language using Claude.
    
    Args:
        text: Text to translate
        target_language: ISO language code to translate into
    
    Returns:
        str: Translated text
    """
    if not text or not text.strip():
        logger.warning(f"Empty text provided for translation to {target_language}")
        return ""
    
    try:
        # Map language code to language name
        language_map = {
            'es': 'Spanish',
            'fr': 'French',
            'zh': 'Chinese',
            'de': 'German',
            'it': 'Italian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'vi': 'Vietnamese',
            'tl': 'Tagalog',
            'ht': 'Haitian Creole'
            # Add more languages as needed
        }
        
        # Get full language name from code
        language_name = language_map.get(target_language, target_language)
        logger.info(f"Translating to {target_language} ({language_name}), text length: {len(text)}")
        logger.info(f"First 100 chars of text to translate: {text[:100]}...")
        
        # Create translation prompt using the main get_translation_prompt function
        prompt = get_translation_prompt(text, language_name)
        logger.info(f"Created translation prompt of length: {len(prompt)}")
        
        # Call Claude 3.5 Sonnet for translation
        start_time = time.time()
        logger.info(f"Sending translation request to Claude 3.5 Sonnet for {target_language}")
        content = invoke_claude_3_5(
            prompt=prompt,
            temperature=0,
            max_tokens=8000
        )
        end_time = time.time()
        
        logger.info(f"Received translation response in {end_time - start_time:.2f} seconds, length: {len(content) if content else 0}")
        if content:
            logger.info(f"Raw translation response preview: {content[:100]}...")
        else:
            logger.warning(f"Received empty response from translation model")
            
        # Clean the translation output
        cleaned_translation = clean_translation_output(content)
        logger.info(f"Cleaned translation length: {len(cleaned_translation)}")
        logger.info(f"Cleaned translation preview: {cleaned_translation[:100]}...")
        
        return cleaned_translation
    
    except Exception as e:
        logger.error(f"Error translating to {target_language}: {str(e)}")
        traceback.print_exc()
        
        # Return a placeholder in case of error
        return f"[Translation to {target_language} failed]"

def clean_translation_output(text):
    """
    Clean the translation output by removing any introductory text or explanations.
    
    Args:
        text: Raw translation output
    
    Returns:
        str: Cleaned translation
    """
    # Remove common introductory phrases
    cleaned = text
    
    # Remove any "here's the translation" type text
    intros = [
        r"^(Here'?s the translation:?)\s*",
        r"^(The translation is:?)\s*",
        r"^(Translated to \w+:?)\s*",
        r"^(In \w+:?)\s*",
        r"^(Translation:?)\s*"
    ]
    
    for pattern in intros:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    
    # Remove any "I hope this helps" type conclusions
    outros = [
        r"\s*(I hope this helps\.?)\s*$",
        r"\s*(Let me know if you need anything else\.?)\s*$",
        r"\s*(This is the \w+ translation\.?)\s*$"
    ]
    
    for pattern in outros:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    
    # Remove triple backticks if present (from code blocks)
    cleaned = re.sub(r"```\w*", "", cleaned)
    cleaned = re.sub(r"```", "", cleaned)
    
    # Trim whitespace
    cleaned = cleaned.strip()
    
    return cleaned 