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
        'Environmental modifications'
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

    
# You are a direct translator for educational documents, particularly IEPs (Individualized Education Programs).

# Translate the following IEP document content.

# Translation Guidelines:
# 1. Translate directly without adding any introductory text, explanations of your process, or JSON formatting
# 2. Do not include phrases like "Here's the translation" or "Here's the content in {target_language}"
# 3. Write at an 8th-grade reading level while preserving all important information
# 4. For technical terms, keep the official term and add a simple explanation in parentheses once
# 5. Keep numbers, dates, and measurements in their original format
# 6. Return ONLY the translated text without any wrapper or metadata
# 7. Maintain the exact same structure and sections as the English version
# 8. Keep all section titles exactly the same as in English


# IMPORTANT: 
# 1. Return ONLY the translated JSON object with the exact same structure
# 2. Keep all section titles and keys exactly the same as in English
# 3. Only translate the text content within the "S" fields
# 4. Keep all numbers, dates, and measurements in their original format
# 5. For the 'services' section, maintain the exact same format for durations (e.g., "300 min/week (5 hrs/week)")

# Return the complete translated JSON object with the same structure but translated content.

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
            "en": "English summary text",
            "es": "Spanish summary text",
            "vi": "Vietnamese summary text",
            "zh": "Chinese summary text"
        },
        "sections": {
            "en": [
                {
                    "title": "Section Name 1 - should be an enum from the list of sections",
                    "content": "English section content (use the markdown format for better readability)",
                    "ocr_text_used": "All the original text from the iep document used to extract the section content",
                    "page_numbers": "Page numbers used to extract the section content"
                }
            ],
            "es": [
                {
                    "title": "Section Name 1 in spanish",
                    "content": "Spanish section content (use the markdown format for better readability)",
                    "ocr_text_used": "All the original text from the iep document used to extract the section content in english",
                    "page_numbers": "Page numbers used to extract the section content in spanish"
                }
            ],
            "vi": [
                {
                    "title": "Section Name 1 in vietnamese",
                    "content": "Vietnamese section content (use the markdown format for better readability)",
                    "ocr_text_used": "All the original text from the iep document used to extract the section content in english",
                    "page_numbers": "Page numbers used to extract the section content in vietnamese"
                }
            ],
            "zh": [
                {
                    "title": "Section Name 1 in chinese",
                    "content": "Chinese section content (use the markdown format for better readability)",
                    "ocr_text_used": "All the original text from the iep document used to extract the section content in english",
                    "page_numbers": "Page numbers used to extract the section content in chinese"
                }
            ]
        },
        "document_index": {
            "en": "English document index, page numbers and content of the page, break down the content of the document into sections based on the content of the page",
            "es": "Spanish document index, page numbers and content of the page, break down the content of the document into sections based on the content of the page",
            "vi": "Vietnamese document index, page numbers and content of the page, break down the content of the document into sections based on the content of the page",
            "zh": "Chinese document index, page numbers and content of the page, break down the content of the document into sections based on the content of the page"
        }
    }

#     You are an expert IEP document summarizer. Analyze the following student IEP document and extract the key information.

# First, use the tool "get_all_ocr_text_with_page_numbers" to extract the text from the document and prepare an index of the document based on the page numbers and the content of the page.

# Extract the following:
# 1. A concise summary of the entire document. Remember to use the index to help you. and use the page numbers to help me find key sections in the document.
# 2. Before porcessing each section if necessary use the tool "get_ocr_text_for_page" to retrive specific information about each section based on the index you created, Structured sections based on the document's content, always only include the following sections: {', '.join(IEP_SECTIONS.keys())}.

# When analyzing the document, pay special attention to these important sections:
# {', '.join(IEP_SECTIONS.keys())}

# For each section, cover these key points where applicable:
# {json.dumps(section_points, indent=4)}

# Special instructions:
# - For the 'services' section specifically:
#   * ALWAYS show the original duration in minutes as mentioned in the IEP
#   * In parentheses, include the conversion to hours per week
#   * Format as: "X min/week (Y hrs/week) if the duration is more than 60 minutes"
#   * Example: "300 min/week (5 hrs/week)" or "100 min/week (1 hr 40 min/week)"
# - For "Goals", "Accommodations", and "Services", always return the original text from the document.

# - Use simple language (8th-grade reading level)
# - Explain technical terms in parentheses
# - Include all specific services, accommodations, and important dates
# - Always return the original text from the document.
# - Always return the page numbers of the document for each section.
# - Always return the ocr data used to extract the section content.
# - use the translation agent the data to desired language.

# Format your response as a JSON object with the following structure:
# ```json
# {json.dumps(json_structure, indent=2)}
# ```

# IMPORTANT: 
# 1. Your response MUST be valid JSON only. No introduction, explanation, or markdown outside the JSON.
# 2. Make sure to include all the sections and key points.
# 3. Keep the section titles consistent.
# 4. Ensure all sections are present.
# 5. The structure must exactly match the example format above.
    
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

Tools:
- get_all_ocr_text: to extract the text from the document and prepare an index of the document based on the page numbers and the content of the page.
- get_ocr_text_for_page: to retrieve specific information about each section based on the page number of the document.
- get_language_context: to get the language specific context for translation. Use this tool for EACH language before translating.
- get_section_info: to get the key points and description for each section. Use this tool for each section to understand what information to extract.

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


Make sure the output has the following data:
- summary in all languages
- make sure all the section are present in the final list of section, i.e. {', '.join(IEP_SECTIONS.keys())}
- all sections - title, content, ocr_text_used, page_numbers in all languages, i.e. {', '.join(LANGUAGE_CODES.keys())}
- document index in all languages
- all translations are complete and accurate
- final ouput should be just the JSON object with no other text or comments.

Output Structure: Format your response as a JSON object with the following structure: 
```json
{json.dumps(json_structure, indent=2)}
```
"""
    return prompt

# def clean_translation(text):
#     """Clean up translation output to remove any JSON structure or explanatory text"""
#     # Remove any JSON structure markers
#     text = text.replace('```json', '').replace('```', '')
    
#     # Remove any explanatory text
#     text = re.sub(r'^.*?(?=\w)', '', text, flags=re.MULTILINE)
    
#     # Remove any trailing whitespace or newlines
#     text = text.strip()
    
#     return text