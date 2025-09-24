# Minimal config for translate_content Lambda function
# This Lambda only does simple translation, not full IEP analysis

import json

def get_en_to_es_translations():
    """Load the English to Spanish translation dictionary."""
    with open('en_es_translations.json', 'r') as f:
        return json.load(f)

def get_language_context(target_language):
    """Get the complete language context including translation guidelines."""
    if target_language in ['es', 'spanish']:
        translations = get_en_to_es_translations()
        return f'Use Latin American Spanish. Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning. Use the following json of english to spanish translations: {translations}'
    elif target_language in ['vi', 'vietnamese']:
        return 'Use standard Vietnamese. Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.'
    elif target_language in ['zh', 'chinese']:
        return 'Use Simplified Chinese (Mandarin). Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.'
    else:
        return f'target language {target_language} not supported. Please use one of the following: "es", "vi", "zh"'

def get_translation_prompt(target_language, content_type="parsing_result"):
    """Generate a unified translation prompt for both IEP parsing results and missing info."""
    language_context = get_language_context(target_language)
    
    # Content-specific context
    if content_type == 'missing_info':
        content_description = "missing information items that help parents understand what's needed for their child's IEP"
        tone_guidance = "- Be supportive and encouraging (never judgmental)\n- Emphasize collaboration between parents and school\n- Use reassuring language that helps parents feel empowered"
    else:  # parsing_result or default
        content_description = "IEP document content including summaries, sections, document index, and abbreviations"
        tone_guidance = "- Use warm, supportive tone appropriate for parents reading about their child's IEP\n- For abbreviations: translate full forms, keep abbreviation codes in English"
    
    return f'''
You are a professional translator specializing in educational documents.
Your input is a JSON object with English {content_description}.

Translation Task: Translate all English text content to {target_language} while preserving the JSON structure.

Guidelines:
- Do not translate JSON key names, field names, or section titles
- Maintain the exact same data structure and field hierarchy
- Preserve all page numbers, dates, numerical values, and IDs unchanged
- Keep all structural elements (arrays, objects) in the same format
{tone_guidance}
- Do not include extra keys or commentary—output only the valid JSON

{language_context}
'''
