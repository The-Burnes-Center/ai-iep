import json
import re

# Define IEP sections and their descriptions
IEP_SECTIONS = {
    'Present Levels': 'Present levels of academic achievement and functional performance',
    'Eligibility': 'Student eligibility determination and documentation',
    'Placement': 'Educational placement and least restrictive environment',
    'Goals': 'Measurable annual goals and objectives',
    'Services': 'Special education and related services to be provided',
    'Informed Consent': 'Parent/Guardian informed consent and participation',
    'Accommodations': 'Accommodations and modifications'
}

# Section-specific key points to extract
SECTION_KEY_POINTS = {
    'Present Levels': [
        'Current academic performance in each subject',
        'Social and behavioral skills',
        'Physical and health status',
        'Communication skills',
        'Life and self-help skills',
        "Teacher observations and input"  # Added to capture teacher feedback
    ],
    'Eligibility': [
        'Primary disability category',
        'How disability affects learning',
        'Evaluation results and dates',
        'Eligibility criteria met',
        'Team decisions and recommendations'
    ],
    'Placement': [
        'Type of classroom setting',
        'Percentage of time in regular classes',
        'Reasons for placement decision',
        'Transportation needs',
        'Extended school year services'
    ],
    'Goals': [
        'Academic goals for each subject',
        'Behavioral/social goals',
        'Life skills goals',
        'How progress will be measured',
        'Timeline for achievement'
    ],
    'Services': [
        'Types of special education services',
        'Related services (speech, OT, PT, etc.)',
        'Frequency and duration of services',
        'Who will provide services',
        'When services begin and end',
        'ALWAYS show the original duration in minutes as mentioned in the IEP, In parentheses, include the conversion to hours. Format as: "X min/week (Y hrs/week) if the duration is more than 60 minutes" Example: "300 min/week (5 hrs/week)" or "100 min/week (1 hr 40 min/week)"'
    ],
    'Informed Consent': [
        'Parent rights and responsibilities',
        'Consent given or refused',
        'Parent concerns and input',  # Ensures parent concerns are captured
        'Team meeting participants',
        'Important dates and deadlines'
    ],
    'Accommodations': [
        'Classroom accommodations',
        'Testing accommodations',
        'Behavioral supports',
        'Assistive technology needs',
        'Environmental modifications',
    ]
}

# (Optional) Document categories if needed for classification
CATEGORIES = ["IEP"]

# Language codes mapping for reference (if needed for external translation APIs)
LANGUAGE_CODES = {
    'english': 'en',
    'chinese': 'zh',
    'spanish': 'es',
    'vietnamese': 'vi'
}

def get_language_context(target_language):
    """Get the language context for the target language."""
    return {
        'es' or 'spanish': 'Use Latin American Spanish. Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.',
        'vi' or 'vietnamese': 'Use standard Vietnamese. Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.',
        'zh' or 'chinese': 'Use Simplified Chinese (Mandarin). Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.'
    }.get(target_language, '')

def get_translation_prompt():
    """Generate a prompt for translating content to the target language in a parent-friendly manner."""

    return f"""

After processing the document in english, please use the translation tool to translate each part of the final output in all the languages we need. use the tool get_language_context to get the language context for translation.
"""

def get_all_tags():
    """Compile all sections into a single list for reference."""
    return {
        'sections': list(IEP_SECTIONS.keys())
    }

def get_full_prompt(key):
    """
    Generate a prompt for document analysis.
    
    Args:
        key (str): Document type key
    """
    section_points = {section: points for section, points in SECTION_KEY_POINTS.items()}
    
    # Build the JSON structure example
    json_structure = {
        "summaries": {
            "en": "English summary text - must not be empty",
            "es": "Spanish summary text - must not be empty",
            "vi": "Vietnamese summary text - must not be empty",
            "zh": "Chinese summary text - must not be empty"
        },
        "sections": {
            "en": [
                {
                    "title": "Section name",  # Must be one of the IEP_SECTIONS keys
                    "content": "English section content in markdown format",
                    "ocr_text_used": "Original text of the document used for drafting this section",
                    "page_numbers": "Page numbers where this section was found in the document"
                },
                # All required sections must be present:
                # - Present Levels
                # - Eligibility
                # - Placement
                # - Goals
                # - Services
                # - Informed Consent
                # - Accommodations
            ],
            "es": [
                {
                    "title": "Section name",  # Must match English section names
                    "content": "Spanish section content in markdown format",
                    "ocr_text_used": "Original text of the document used for drafting this section",
                    "page_numbers": "Page numbers where this section was found"
                }
                # All sections must be present in Spanish
            ],
            "vi": [
                {
                    "title": "Section name",  # Must match English section names
                    "content": "Vietnamese section content in markdown format",
                    "ocr_text_used": "Original text of the document used for drafting this section",
                    "page_numbers": "Page numbers where this section was found"
                }
                # All sections must be present in Vietnamese
            ],
            "zh": [
                {
                    "title": "Section name",  # Must match English section names
                    "content": "Chinese section content in markdown format",
                    "ocr_text_used": "Original text of the document used for drafting this section",
                    "page_numbers": "Page numbers where this section was found"
                }
                # All sections must be present in Chinese
            ]
        },
        "document_index": {
            "en": "English document index with page numbers and content breakdown - must not be empty",
            "es": "Spanish document index with page numbers and content breakdown - must not be empty",
            "vi": "Vietnamese document index with page numbers and content breakdown - must not be empty",
            "zh": "Chinese document index with page numbers and content breakdown - must not be empty"
        }
    }
    
    prompt = f"""
You are an expert IEP document analyzer and translator. Analyze the following student IEP document and extract the key information.

Tasks:
1. Analyze the document in english and generate first an index of the document based on the page numbers and the content of the page.
2. Summarize the document in english where you are trying to explain the document in a way that is easy to understand for a parent whose child is in the school system. Mention the strengths and weaknesses of the student in the summary, and the goals and accommodations of the student.
3. For each section, use the get_section_info tool to understand what information to extract, then use the index to find and extract that information from the document.
4. Translate ALL extracted information to ALL the languages we need {', '.join(LANGUAGE_CODES.keys())}. DO NOT use placeholders like "..." or "Translated sections" - you must provide COMPLETE translations for every field.
5. For EACH language, translate ALL sections with the SAME level of detail as the English version.
6. Use the tool get_language_context to get the language specific context for translation of each language.
7. Make sure the final output has the same structure as the example format below and has the same section titles and keys, and make sure we have all the sections, summary and needed translations.
8. Only once you have validated the output using the validate_output tool, return the final output.

Tools:
- get_all_ocr_text: to extract the text from the document and prepare an index of the document based on the page numbers and the content of the page.
- get_ocr_text_for_page: to retrieve specific information about each section based on the page number of the document.
- get_language_context: to get the language specific context for translation. Use this tool for EACH language before translating.
- get_section_info: to get the key points and description for each section. Use this tool for each section to understand what information to extract.
- validate_output: to validate the output structure, use this tool to check if the output is valid and has all the sections, summary and needed translations. Only return the final output after validation.

Important Guidelines:
- Make sure to include ALL the sections and key points.
- Keep the section titles consistent.
- Ensure all sections are present in all languages.
- Keep the reading level at 8th grade.
- NEVER use placeholder text like "..." or "// Translated sections" - all sections must be fully translated.
- The content in all languages should have the SAME level of detail.
- For each section, use get_section_info to understand what information to look for.
- For the 'services' section specifically:
    * ALWAYS show the original duration in minutes as mentioned in the IEP
    * In parentheses, include the conversion to hours per week
    * Format as: "X min/week (Y hrs/week)" if the duration is more than 60 minutes
    * Example: "300 min/week (5 hrs/week)" or "100 min/week (1 hr 40 min/week)"
- Only once you have validated the output, return the final output.

Validation Requirements:
1. All summaries must be non-empty and present in all languages
2. All sections must:
   - Have a title that matches one of: {', '.join(IEP_SECTIONS.keys())}
   - Have non-empty content in markdown format
   - Include the original OCR text used
   - Include the page numbers where found
3. All required sections must be present in all languages
4. Document index must be non-empty and present in all languages

Output Structure: Format your response as a JSON object with the following structure: 
```json
{json.dumps(json_structure, indent=2)}
```
"""
    return prompt
