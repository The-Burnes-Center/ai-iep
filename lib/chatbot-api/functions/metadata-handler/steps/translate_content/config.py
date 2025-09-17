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
