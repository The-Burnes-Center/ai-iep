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
    'Accommodations': 'Accommodations and modifications',
    'Key People': 'Key people involved in the IEP process'
}

# Section-specific key points to extract
SECTION_KEY_POINTS = {
    'Present Levels': """Analyze and describe the student's current academic performance across all subjects. Include details about their social and behavioral skills, physical health status, and communication abilities. Document their life and self-help skills. Be sure to incorporate teacher observations and input about the student's performance and behavior in the classroom.  Also include parent concerns. Make sure to include the student's strengths, preferences, and interests. Include a summary of where the student is at in terms of reading skills, math skills, and so on. Clearly separate information coming from teachers, parents, and the student where possible. Include any observable trends over time. If possible, note changes since the previous IEP.""",
    
    'Eligibility': """Identify and document the student's primary as well as secondary disability category and explain how this disability affects their learning process. Include all relevant evaluation results with their dates. List the specific eligibility criteria that were met. Document the evaluation team's decisions and recommendations regarding the student's eligibility for special education services.""",
    
    'Placement': """Specify the type of classroom setting recommended for the student. Calculate and state the percentage of time the student will spend in regular education classes. Provide a clear explanation of why this placement decision was made. Address any specialized transportation needs. Document whether extended school year services are necessary and why. Extract the rationale for placement decisions, particularly in terms of the Least Restrictive Environment (LRE). List any supplementary supports or participation in non-academic activities if mentioned.""",
    
    'Goals': """Detail the specific academic goals for each subject area where the student needs support.  For each goal, explain how progress will be measured and tracked. Provide clear dates and timelines for when each goal should be achieved. Include the objectives listed for each goal. For each goal, if progress reports are available, include the summary of progress as well as any additional comments listed in that section. Include behavioral and social goals that address any identified challenges. Specify life skills goals where applicable. Break out short-term objectives from annual goals. Specify who is responsible for monitoring each goal and how frequently progress is reported.""",
    
    'Services': """List all types of special education services the student will receive. Include any related services such as speech therapy, occupational therapy, or physical therapy. For each service, specify the frequency and duration using the following format: show the original duration in minutes as mentioned in the IEP, followed by the conversion to hours in parentheses (e.g., "300 min/week (5 hrs/week)" or "100 min/week (1 hr 40 min/week)"). Identify who will provide each service and document the specific dates when each services will begin and end. Indicate whether services are delivered in a group or 1:1, and whether they are direct or consultative. Include the setting of service delivery. If available, note whether the provider is school-based or external.""",
    
    'Informed Consent': """Document all parent rights and responsibilities regarding the IEP process. Note whether consent was given or refused for each aspect of the IEP. Record any concerns or input provided by the parents. List all team meeting participants and their roles. Include all important dates and deadlines related to the IEP process. Note any partial consents or formal disagreements. Include mention of prior written notices (PWNs) if included. Document whether interpretation or translation services were offered.""",
    
    'Accommodations': """Detail all classroom accommodations that will be provided to support the student's learning. Specify any testing accommodations needed for assessments. Document behavioral supports and intervention strategies. List any assistive technology needs and how they will be met. Include all necessary environmental modifications to support the student's learning. Differentiate between testing and instructional accommodations. Include frequency or situations in which each accommodation should be applied. Specify whether accommodations are to be used in all or only certain subjects.""",

    'Key People': """List all key people involved in the IEP process. Include the names of the parents, teachers, and other professionals who are involved in the IEP process. Note their roles and responsibilities. Where available, extract the names of the Administrator, General Education Teacher, Special Education Teacher, Speech or language Therapist, Occupational Therapist, School Psychologist and Physical therapist. Mention which page number the contact information for the key people is located."""
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

def get_en_to_es_translations():
    with open('en_es_translations.json', 'r') as f:
        return json.load(f)

def get_english_to_spanish_context():
    translations = get_en_to_es_translations()
    return f'Use Latin American Spanish. Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning. Use the following json of english to spanish translations: {translations}'

def get_english_to_vietnamese_context():
    return 'Use standard Vietnamese. Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.'    

def get_english_to_chinese_context():
    return 'Use Simplified Chinese (Mandarin). Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.'


def get_language_context(target_language):
    """Get the language context for the target language."""
    if target_language in ['es', 'spanish']:
        return get_english_to_spanish_context()
    elif target_language in ['vi', 'vietnamese']:
        return get_english_to_vietnamese_context()
    elif target_language in ['zh', 'chinese']:
        return get_english_to_chinese_context()
    else:
        return f'target language {target_language} not supported. Please use one of the following: "es", "vi", "zh"'


def get_translation_prompt() -> str:
    """
    Generate the instruction prompt for multi-language translation using GPT-4.1.
    Takes an English-structured JSON and outputs translations for es, vi, zh in one call.
    Uses the `get_language_context_for_translation` tool to fetch language-specific guidelines.
    """
    return '''
You are a multi-language translation agent using GPT-4.1.
Your input is a JSON object with English content under keys:
- `summaries.en`
- `sections.en`
- `document_index.en`

Translation Workflow:
1. For each target language code (`es`, `vi`, `zh`):
   a. Invoke the `get_language_context_for_translation` tool with the language code to retrieve guidelines (reading level, tone, terminology rules).
   b. Apply those guidelines when translating the English content.
2. Translate **all** English fields into Spanish (`es`), Vietnamese (`vi`), and Simplified Chinese (`zh`), preserving the overall JSON structure. Do not translate the keys in the JSON. i.e. the keys should be the same as the original English keys. Section titles should not be translated.
3. Organize your translation output in this exact JSON format:
```
{
  "summaries": { "es": "<Spanish summary>", "vi": "<Vietnamese summary>", "zh": "<Chinese summary>" },
  "sections": {
    "es": [ { "title": "<Section name>", "content": "<Spanish content>", "page_numbers": [...] }, ... ],
    "vi": [ ... ],
    "zh": [ ... ]
  },
  "document_index": { "es": "<Spanish index>", "vi": "<Vietnamese index>", "zh": "<Chinese index>" }
}
```
Guidelines:
- Use the language-specific context from the tool for tone and clarity.
- When calling guidelines, use the tool named `get_language_context_for_translation(language_code)`.
- Maintain an 8th-grade reading level.
- Do not include extra keys or commentary—output only the valid JSON.
'''


def get_all_tags():
    """Compile all sections into a single list for reference."""
    return {
        'sections': list(IEP_SECTIONS.keys())
    }

def get_full_prompt() -> str:
    """
    Generate the main instruction prompt for IEP analysis and translation.
    This prompt directs the agent to perform English-only analysis first,
    then invoke the translate_text tool once to translate all content into multiple languages.
    """
    return f'''
You are an expert IEP document analyzer using GPT-4.1. 
Your goal is to produce a complete, valid JSON output with the following structure:

{{
"summaries": {{ "en": "<English summary>" }},
"sections": {{ "en": [{{ "title": "<Section name>", "content": "<Markdown content>", "page_numbers": [<list of pages> ] }} ... ] }},
"document_index": {{ "en": "<English index with pages>" }}
}}

### Instructions:
1. **Retrieve the Full OCR Text**: Use `get_all_ocr_text` to retrieve and index the full OCR text by page.
2. **English-Only Summary and Analysis**:
   - Extract and summarize the IEP in **English only**.
   - Populate `summaries.en`, `sections.en`, and `document_index.en` with the results.
   - **Section Extraction**: For each section, use `get_section_info` to get the description and key points.
   - Use `get_ocr_text_for_page` or `get_ocr_text_for_pages` to locate and extract exact content for each section.
   - Format the **content** for each section in **Markdown**, ensuring:
     - Break down big paragraphs into **smaller ones**.
     - Add a **short introductory paragraph** summarizing the content of the section.
     - Use **bullet points**, **lists**, **tables**, **bold**, **italic**, and **underline** where appropriate to enhance readability.
     - Maintain a **friendly and warm tone** throughout.
3. **Validation**:
   - Ensure that the English JSON matches the required schema (no missing keys, correct types).
4. **Translation**: 
   - Call the `translate_text` tool, passing the entire English JSON as input.
   - The tool will return a **JSON object containing translations** into **Spanish (es)**, **Vietnamese (vi)**, and **Chinese (zh)**, preserving the same structure:

{{
"summaries": {{ "es": ..., "vi": ..., "zh": ... }},
"sections": {{ "es": [...], "vi": [...], "zh": [...] }},
"document_index": {{ "es": ..., "vi": ..., "zh": ... }}
}}

5. **Merging Translations**:
   - Merge the returned translations into your final output, resulting in:

{{
"summaries": {{ "en": ..., "es": ..., "vi": ..., "zh": ... }},
"sections": {{ "en": [...], "es": [...], "vi": [...], "zh": [...] }},
"document_index": {{ "en": ..., "es": ..., "vi": ..., "zh": ... }}
}}

6. **Return the Final JSON**: Return the completed JSON with all sections, summaries, and document index in all languages, without additional commentary or explanations.

### Tools available:
- `get_all_ocr_text`
- `get_ocr_text_for_page`
- `get_ocr_text_for_pages`
- `get_section_info`
- `translate_text` (for multi-language translation)

### Formatting Guidelines:
- Use **bullet points** when possible to organize information clearly.
- Use **lists** to break down complex information.
- Where appropriate, use **tables** to improve data presentation.
- Emphasize important points with **bold** and **italic** text.
- Use **underline** to highlight key information.
- Always begin each section with a short **introductory paragraph** that summarizes what the section contains.
- Keep the tone **friendly and warm**, and ensure that the language is accessible and easy to understand.
'''


# def get_full_prompt(key):
#     """
#     Generate a prompt for document analysis.
    
#     Args:
#         key (str): Document type key
#     """
#     section_points = {section: points for section, points in SECTION_KEY_POINTS.items()}
    
#     # Build the JSON structure example
#     json_structure = {
#         "summaries": {
#             "en": "English summary of the entire document - must not be empty",
#             "es": "Translation of the english summary to spanish - must not be empty",
#             "vi": "Translation of the english summary to vietnamese - must not be empty",
#             "zh": "Translation of the english summary to chinese - must not be empty"
#         },
#         "sections": {
#             "en": [
#                 {
#                     "title": "Section name",  # Must be one of the IEP_SECTIONS keys
#                     "content": "English section content in markdown format",
#                     "page_numbers": [1, 2]  # List of page numbers where this section was found in the document
#                 },
#                 # All required sections must be present:
#                 # - Present Levels
#                 # - Eligibility
#                 # - Placement
#                 # - Goals
#                 # - Services
#                 # - Informed Consent
#                 # - Accommodations
#             ],
#             "es": [
#                 {
#                     "title": "Section name - same as english section names",  # Must match English section names
#                     "content": "Spanish section content in markdown format",
#                     "page_numbers": [1, 2]  # List of page numbers where this section was found
#                 }
#                 # All sections must be present in Spanish
#             ],
#             "vi": [
#                 {
#                     "title": "Section name - same as english section names",  # Must match English section names
#                     "content": "Vietnamese section content in markdown format",
#                     "page_numbers": [1, 2]  # List of page numbers where this section was found
#                 }
#                 # All sections must be present in Vietnamese
#             ],
#             "zh": [
#                 {
#                     "title": "Section name - same as english section names",  # Must match English section names
#                     "content": "Chinese section content in markdown format",
#                     "page_numbers": [1, 2]  # List of page numbers where this section was found
#                 }
#                 # All sections must be present in Chinese
#             ]
#         },
#         "document_index": {
#             "en": "English document index with page numbers and content breakdown - must not be empty",
#             "es": "Spanish document index with page numbers and content breakdown - must not be empty",
#             "vi": "Vietnamese document index with page numbers and content breakdown - must not be empty",
#             "zh": "Chinese document index with page numbers and content breakdown - must not be empty"
#         }
#     }
    
#     prompt = f"""
# You are an expert IEP document analyzer and translator. Analyze the following student IEP document and extract the key information.

# Tasks:
# 1. Analyze the document in english and generate first an index of the document based on the page numbers and the content of the page.
# 2. Summarize the document in english where you are trying to explain the document in a way that is easy to understand for a parent whose child is in the school system. Mention the strengths and weaknesses of the student in the summary, and the goals and accommodations of the student.
# 3. For each section, use the get_section_info tool to understand what information to extract, then use the index to find and extract that information from the document.
# 4. Translate the english summary to all the languages we need {', '.join(LANGUAGE_CODES.keys())}. Use the tool translate_text to translate the text, the input will be text in english with a language code from {'es', 'vi', 'zh'}. The output will be the translated text in the target language.
# 5. Use the translate_text tool to translate the english sections and english document index to the target language.
# 6. Make sure the final output has the same structure as the example format below and has the same section titles and keys, and make sure we have all the sections, summary and needed translations.

# Tools:
# - get_all_ocr_text: to extract the text from the document and prepare an index of the document based on the page numbers and the content of the page.
# - get_ocr_text_for_page: to retrieve specific information about a single page based on the page number of the document.
# - get_ocr_text_for_pages: to retrieve specific information from multiple pages at once by providing an array of page indices. Use this when you need to extract content that spans across multiple pages for efficiency.
# - translate_text: to translate the English text to the target language. Use this tool for all parts and all languages. The input will be text in english with a language code from {'es', 'vi', 'zh'}. The output will be the translated text in the target language.
# - get_section_info: to get the key points and description for each section. Use this tool for each section to understand what information to extract.

# Important Guidelines:
# - Make sure to include ALL the sections and key points.
# - Keep the section titles consistent.
# - Ensure all sections are present in all languages.
# - Keep the reading level at 8th grade.
# - NEVER use placeholder text like "..." or "// Translated sections" - all sections must be fully translated.
# - The content in all languages should have the SAME level of detail.
# - For each section, use get_section_info to understand what information to look for.
# - When content for a section spans multiple pages, use get_ocr_text_for_pages with an array of relevant page indices for more efficient extraction.
# - For the 'services' section specifically:
#     * ALWAYS show the original duration in minutes as mentioned in the IEP
#     * In parentheses, include the conversion to hours per week
#     * Format as: "X min/week (Y hrs/week)" if the duration is more than 60 minutes
#     * Example: "300 min/week (5 hrs/week)" or "100 min/week (1 hr 40 min/week)"
# - Only once you have validated the output, return the final output.
# - Format all the output in markdown format, break down big paragraphs into smaller ones.
# - use bullet points when possible.
# - use lists when possible.
# - use tables when possible.
# - use bold when possible.
# - use italic when possible.
# - use underline when possible.


# Validation Requirements:
# 1. All summaries must be non-empty and present in all languages
# 2. All sections must:
#    - Have a title that matches one of: {', '.join(IEP_SECTIONS.keys())}
#    - Have non-empty content in markdown format
#    - Include the page numbers where found (as a list of integers)
# 3. All required sections must be present in all languages
# 4. Document index must be non-empty and present in all languages

# Output Structure: Format your response as a JSON object with the following structure: 
# ```json
# {json.dumps(json_structure, indent=2)}
# ```
# """
#     return prompt
