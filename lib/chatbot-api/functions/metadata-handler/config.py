import json

# Define IEP sections and their descriptions
IEP_SECTIONS = {
    'present_levels': 'Present levels of academic achievement and functional performance',
    'eligibility': 'Student eligibility determination and documentation',
    'placement': 'Educational placement and least restrictive environment',
    'goals': 'Measurable annual goals and objectives',
    'services': 'Special education and related services to be provided',
    'informed_consent': 'Parent/Guardian informed consent and participation',
    'accommodations': 'Accommodations and modifications'
}

# Section-specific key points to extract
SECTION_KEY_POINTS = {
    'present_levels': [
        'Current academic performance in each subject',
        'Social and behavioral skills',
        'Physical and health status',
        'Communication skills',
        'Life and self-help skills',
        "Teacher observations and input"  # Added to capture teacher feedback
    ],
    'eligibility': [
        'Primary disability category',
        'How disability affects learning',
        'Evaluation results and dates',
        'Eligibility criteria met',
        'Team decisions and recommendations'
    ],
    'placement': [
        'Type of classroom setting',
        'Percentage of time in regular classes',
        'Reasons for placement decision',
        'Transportation needs',
        'Extended school year services'
    ],
    'goals': [
        'Academic goals for each subject',
        'Behavioral/social goals',
        'Life skills goals',
        'How progress will be measured',
        'Timeline for achievement'
    ],
    'services': [
        'Types of special education services',
        'Related services (speech, OT, PT, etc.)',
        'Frequency and duration of services',
        'Who will provide services',
        'When services begin and end'
    ],
    'informed_consent': [
        'Parent rights and responsibilities',
        'Consent given or refused',
        'Parent concerns and input',  # Ensures parent concerns are captured
        'Team meeting participants',
        'Important dates and deadlines'
    ],
    'accommodations': [
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

def get_translation_prompt(content, target_language):
    """Generate a prompt for translating content to the target language in a parent-friendly manner."""
    # Context guidelines for specific languages
    language_context = {
        'spanish': 'Use Latin American Spanish. Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.',
        'vietnamese': 'Use standard Vietnamese. Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.',
        'chinese': 'Use Simplified Chinese (Mandarin). Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.'
    }.get(target_language, '')
    
    return f"""
You are a direct translator for educational documents, particularly IEPs (Individualized Education Programs).

Translate the following content into {target_language}. {language_context}

Translation Guidelines:
1. Translate directly without adding any introductory text, explanations of your process, or JSON formatting
2. Do not include phrases like "Here's the translation" or "Here's the content in Spanish"
3. Write at an 8th-grade reading level while preserving all important information
4. For technical terms, keep the official term and add a simple explanation in parentheses once
5. Keep numbers, dates, and measurements in their original format
6. Return ONLY the translated text without any wrapper or metadata

Content to translate:
{content}

IMPORTANT: Only provide the direct translation with no additional text, formatting, or explanation.
""".strip()

def get_all_tags():
    """Compile all sections into a single list for reference."""
    return {
        'sections': list(IEP_SECTIONS.keys())
    }

def get_full_prompt(key, content):
    """
    Generate the full analysis prompt for the AI model, instructing it to summarize the IEP and extract structured data.
    """
    section_points = {section: points for section, points in SECTION_KEY_POINTS.items()}
    
    prompt = f"""
You are a helpful education expert who makes IEPs (Individualized Education Programs) easy for parents to understand. Your task is to create a thorough yet clear summary of this IEP document.

Please analyze this IEP document and provide:

1. A comprehensive parent-friendly summary that:
   - Covers all major decisions and services in the IEP
   - Uses simple language (8th-grade reading level)
   - Explains what the plan means for the child's daily school life
   - Highlights any important dates, changes, or actions needed
   - Incorporates any significant concerns or input from parents or teachers
   - Has a warm, supportive tone

2. For each of these sections found in the document:
   {', '.join(IEP_SECTIONS.keys())}

   Provide:
   - Location in document (beginning, middle, or end)
   - A clear, detailed summary covering these key points:
{json.dumps(section_points, indent=8)}
   - Any specific numbers, hours, or measurements mentioned
   - Important dates or deadlines in that section
   - Required parent actions or decisions noted
   - If any service duration is given in minutes per week/year, convert it to hours per week/year for clarity.

Please format your response as JSON with the following structure:
{{
    "summary": "Comprehensive parent-friendly summary of the IEP",
    "sections": {{
        "section_name": {{
            "present": true/false,
            "summary": "Detailed explanation covering all key points for this section",
            "key_points": {{
                "point_category": "Specific details found for this category",
                ...
            }},
            "important_dates": ["List of any important dates mentioned"],
            "parent_actions": ["List of any required parent actions"],
            "location": "beginning/middle/end"
        }},
        ...
    }}
}}

Critical Requirements:
- Do not omit any important details or measurements.
- Keep all specific services, hours, and accommodations in the summary.
- If any service duration is given in minutes per week/year, convert it to hours per week/year for clarity.
- Explain technical terms while preserving their official names.
- Include all dates, deadlines, and required actions.
- Write in clear language at an 8th-grade reading level.
- Organize information so it's easy to reference.
- Highlight anything that needs parent attention or decisions.

Document Name: {key}
Document Content: {content}"""
    return prompt