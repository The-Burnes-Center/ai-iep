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
    'Key People': 'Key people involved in the IEP process',
    'Strengths': 'Summary of students academic, social, emotional, and physical strengths based on teacher, therapist, and parent observations.',
}

# Section-specific key points to extract
SECTION_KEY_POINTS = {
    'Present Levels': """Analyze and describe the student's current academic performance across all subjects. Include details about their social and behavioral skills, physical health status, and communication abilities. Document their life and self-help skills. Be sure to incorporate teacher observations and input about the student's performance and behavior in the classroom.  Also include parent concerns. Make sure to include the student's preferences, and interests. Include a summary of where the student is at in terms of reading skills, math skills, and so on. Clearly separate information coming from teachers, parents, and the student where possible. Include any observable trends over time. If possible, note changes since the previous IEP.""",
    
    'Eligibility': """Identify and document the student's primary as well as secondary disability category and explain how this disability affects their learning process. Include all relevant evaluation results with their dates. List the specific eligibility criteria that were met. Document the evaluation team's decisions and recommendations regarding the student's eligibility for special education services.""",
    
    'Placement': """Specify the type of classroom setting recommended for the student. Calculate and state the percentage of time the student will spend in regular education classes. Provide a clear explanation of why this placement decision was made. Address any specialized transportation needs. Document whether extended school year services are necessary and why. Extract the rationale for placement decisions, particularly in terms of the Least Restrictive Environment (LRE). List any supplementary supports or participation in non-academic activities if mentioned.""",
    
    'Goals': """Detail the specific academic goals for each subject area where the student needs support. For each goal, summarize the baseline goal, the measurable annual goals and any short-term objectives and explain how progress will be measured and tracked. Provide clear dates and timelines for when each goal should be achieved. Include the objectives listed for each goal. For each goal, if progress reports are available, include the summary of progress as well as any additional comments listed in that section. Include behavioral and social goals that address any identified challenges. Specify life skills goals where applicable. Break out short-term objectives from annual goals.Mention the list of persons responsible for each area. Specify how frequently progress is reported.
    For goals: Ensure that every sentence is clear and complete. For example, instead of saying "baseline: 50% accuracy," provide a complete sentence, such as "Student X is responding to literal questions about an independent level text with a baseline of 50% accuracy.""",
    
    'Services': """List all types of special education services the student will receive. Include any related services such as speech therapy, occupational therapy, or physical therapy. For each service, specify the frequency and duration using the following format: show the original duration in minutes as mentioned in the IEP, followed by the conversion to hours in parentheses (e.g., "300 min/week (5 hrs/week)" or "100 min/week (1 hr 40 min/week)"). Also mention the frequency clearly (e.g. 25 minutes sessions, 4 times per week). Identify who will provide each service and document the specific dates when each services will begin and end. Indicate whether services are delivered in a group or 1:1, and whether they are direct or consultative. Include the setting of service delivery. If available, note whether the provider is school-based or external. Make sure to mention any aditional comments from the team about the service. Use tables to organize the information of services.""",
    
    'Informed Consent': """Document all parent rights and responsibilities regarding the IEP process. Note whether consent was given or refused for each aspect of the IEP. Record any concerns or input provided by the parents. List all team meeting participants and their roles. Include all important dates and deadlines related to the IEP process. Note any partial consents or formal disagreements. Include mention of prior written notices (PWNs) if included. Document whether interpretation or translation services were offered.""",
    
    'Accommodations': """Detail all classroom accommodations that will be provided to support the student's learning. Specify any testing accommodations needed for assessments. Document behavioral supports and intervention strategies. List any assistive technology needs and how they will be met. Include all necessary environmental modifications to support the student's learning. Differentiate between testing and instructional accommodations. Include frequency or situations in which each accommodation should be applied. Specify whether accommodations are to be used in all or only certain subjects.""",

    'Key People': """List all key people involved in the IEP process. Include the names of the parents, teachers, and other professionals who are involved in the IEP process. Note their roles and responsibilities. Where available, extract the names of the Administrator, General Education Teacher, Special Education Teacher, Speech or language Therapist, Occupational Therapist, School Psychologist and Physical therapist. Mention which page number the contact information for the key people is located.""",

    'Strengths': """Provide a comprehensive overview of the student's strengths across multiple domains, including academic, social-emotional, communication, physical, and daily living skills. Incorporate observations and input from teachers, therapists, parents, and the student to create a holistic picture. Highlight positive attributes such as persistence, creativity, empathy, motor skills, and effective use of communication tools like AAC devices. Emphasize areas where the student excels, such as problem-solving abilities, cooperative behavior, adaptability, and specific academic subjects. This section should serve as a foundation for a strengths-based approach to the IEP, ensuring that the student's abilities are recognized and leveraged to support their educational growth."""
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
    required_sections = list(IEP_SECTIONS.keys())
    sections_list = "', '".join(required_sections)
    
    return f'''
You are an expert IEP document analyzer using GPT-4.1. 
Your goal is to produce a complete, valid JSON output with the following structure:

{{
"summaries": {{ "en": "<English summary>" }},
"sections": {{ "en": [{{ "title": "<Section name>", "content": "<Markdown content>", "page_numbers": [<list of pages> ] }} ... ] }},
"document_index": {{ "en": "<English index with pages>" }}
}}

### CRITICAL REQUIREMENTS:
You MUST extract information for ALL {len(required_sections)} required sections: '{sections_list}'

If a section is not explicitly present in the document:
- Still create an entry for that section with title matching exactly one of the required section names
- Set content to indicate that this information was not found in the document
- Use the get_section_info tool to understand what each section should contain

### Instructions:
1. **Retrieve the Full OCR Text**: Use `get_all_ocr_text` to retrieve and index the full OCR text by page.

2. **Section Discovery**: For each required section ('{sections_list}'):
   - Use `get_section_info` to understand what the section should contain
   - Search for this information using `get_ocr_text_for_page` or `get_ocr_text_for_pages`
   - If found, extract the content
   - If not found, create an entry stating "This section was not found in the provided IEP document"

3. **English-Only Summary and Analysis**:
   - Extract and summarize the IEP in **English only**.
   - Populate `summaries.en`, `sections.en`, and `document_index.en` with the results.
   - **ENSURE ALL {len(required_sections)} SECTIONS ARE PRESENT** in `sections.en` array
   - Format the **content** for each section in **Markdown**, ensuring:
     - Break down big paragraphs into **smaller ones**.
     - Add a **short introductory paragraph** summarizing the content of the section.
     - Use **bullet points**, **lists**, **tables**, **bold**, **italic**, and **underline** where appropriate to enhance readability.
     - Maintain a **friendly and warm tone** throughout.
     - If abbreviations are used in the section, provide a **table of legends** at the end of the section. The table should include:
       - Abbreviation: The abbreviation or acronym used in the section.
       - Full Form: The full form or meaning of the abbreviation.
     - The table should only be displayed if abbreviations are present in the section. If no abbreviations are used, skip the table for that section.
     - The table should be formatted in **Markdown** as follows:
        Abbreviation\tFull Form
        IEP\tIndividualized Education Program
        OCR\tOptical Character Recognition
        ...\t...

4. **Validation**:
- Ensure that the English JSON matches the required schema (no missing keys, correct types).
- VERIFY that sections.en contains exactly these {len(required_sections)} sections: '{sections_list}'

5. **Translation**: 
- Call the `translate_text` tool, passing the entire English JSON as input.
- The tool will return a **JSON object containing translations** into **Spanish (es)**, **Vietnamese (vi)**, and **Chinese (zh)**, preserving the same structure:

{{
"summaries": {{ "es": ..., "vi": ..., "zh": ... }},
"sections": {{ "es": [...], "vi": [...], "zh": [...] }},
"document_index": {{ "es": ..., "vi": ..., "zh": ... }}
}}

6. **Merging Translations**:
- Merge the returned translations into your final output, resulting in:

{{
"summaries": {{ "en": ..., "es": ..., "vi": ..., "zh": ... }},
"sections": {{ "en": [...], "es": [...], "vi": [...], "zh": [...] }},
"document_index": {{ "en": ..., "es": ..., "vi": ..., "zh": ... }}
}}

7. **Return the Final JSON**: Return the completed JSON with all sections, summaries, and document index in all languages, without additional commentary or explanations.

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

def get_english_only_prompt() -> str:
    """
    Generate the instruction prompt for IEP analysis using GPT-4.1.
    This will produce a SingleLanguageIEP output structure.
    """
    required_sections = list(IEP_SECTIONS.keys())
    sections_list = "', '".join(required_sections)
    
    return f'''
You are an expert IEP document analyzer using GPT-4.1. 
Your goal is to produce a complete analysis of an IEP document with the following structure for the parent of the student:

{{
"summary": "<Summary>",
"sections": [{{ "title": "<Section name>", "content": "<Markdown content>", "page_numbers": [<list of pages>] }} ... ],
"document_index": "<Index with pages>"
}}

### CRITICAL REQUIREMENTS:
You MUST extract information for ALL {len(required_sections)} required sections: '{sections_list}'

If a section is not explicitly present in the document:
- Still create an entry for that section with title matching exactly one of the required section names
- Set content to indicate that this information was not found in the document
- Use the get_section_info tool to understand what each section should contain

### Summary Extraction Instructions:
For the "summary" field, generate a fully factual, student-specific summary of this IEP document. Do not hallucinate or generalize. Only include information explicitly present in the document. Target 1-2 paragraphs.

### Instructions for Sections:
1. **Retrieve the Full OCR Text**: Use `get_all_ocr_text` to retrieve and index the full OCR text by page.

2. **Section Discovery**: For each required section ('{sections_list}'):
   - Use `get_section_info` to understand what the section should contain
   - Search for this information using `get_ocr_text_for_page` or `get_ocr_text_for_pages`
   - If found, extract the content
   - If not found, create an entry stating "This section was not found in the provided IEP document"

3. **Section Formatting**:
   - Format the **content** for each section in **Markdown**, ensuring:
     - Start each section with a short introductory paragraph.
     - Break large paragraphs into smaller ones.
     - Use **bullet points**, **lists**, **tables**, **bold**, **italic**, and **underline** where appropriate.
     - If abbreviations are used in the section, *always* include an abbreviation legend table in Markdown format.

### Validation:
- Ensure that the JSON matches the required schema (no missing keys, correct types).
- VERIFY that `sections` contains exactly these {len(required_sections)} sections: '{sections_list}'

### Tools available:
- `get_all_ocr_text`
- `get_ocr_text_for_page`
- `get_ocr_text_for_pages`
- `get_section_info`

### Formatting Guidelines:
- Use Markdown formatting throughout.
- Use **bullet points** and **tables** generously to organize information.
- Highlight important facts with **bold headings**.
- Maintain a friendly and warm tone suitable for parents, but always strictly factual.
    '''
