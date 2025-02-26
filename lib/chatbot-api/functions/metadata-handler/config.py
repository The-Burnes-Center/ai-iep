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
        'Life and self-help skills'
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
        'Parent concerns and input',
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

# Define custom tags for additional IEP metadata
CUSTOM_TAGS = {
    'language': ['english', 'chinese', 'spanish', 'vietnamese'],  # Primary language of the document
    'school_year': [],  # Will be extracted from content
    'review_date': []   # Will be extracted from content
}

# Descriptions for each tag to guide their use and selection
TAG_DESCRIPTIONS = {
    'sections': 'The IEP sections present in the document',
    'language': 'Primary language of the IEP document',
    'school_year': 'Academic year for which the IEP is written',
    'review_date': 'Next scheduled review date for the IEP'
}

# Language codes mapping
LANGUAGE_CODES = {
    'english': 'en',
    'chinese': 'zh',
    'spanish': 'es',
    'vietnamese': 'vi'
}

def get_translation_prompt(content, target_language):
    """Generate a prompt for translating content to the target language"""
    language_context = {
        'spanish': 'Use Latin American Spanish. Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.',
        'vietnamese': 'Use standard Vietnamese. Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.',
        'chinese': 'Use Simplified Chinese (Mandarin). Write at an 8th-grade reading level. Explain technical terms in simple words while preserving their legal/educational meaning.'
    }.get(target_language, '')

    return f"""You are a helpful translator who specializes in making educational documents, particularly IEPs (Individualized Education Programs), easy for parents to understand. Your goal is to help parents understand every important aspect of their child's education plan.

Please translate the following content into {target_language}. {language_context}

Key Guidelines:
1. Write at an 8th-grade reading level while preserving all important information
2. Use clear, everyday language that parents can understand
3. For technical terms:
   - Keep the official term
   - Add a simple explanation in parentheses
   - Ensure the legal meaning is preserved
4. Keep the tone warm and supportive
5. Maintain all specific details about services, accommodations, and goals
6. Preserve all JSON keys in English
7. Keep numbers, dates, and measurements in their original format
8. Ensure no critical information is lost in translation

Remember: Parents need to understand both the overall plan AND all specific details about their child's education.

Content to translate:
{content}

Please provide the translated content in valid JSON format."""

# Function to compile all tags into a dictionary for easy access
def get_all_tags():
    return {
        'sections': list(IEP_SECTIONS.keys()),
        **CUSTOM_TAGS
    }

# Function to generate a prompt that directs the AI to analyze an IEP document
def get_full_prompt(key, content):
    all_tags = get_all_tags()
    section_points = {section: points for section, points in SECTION_KEY_POINTS.items()}

    prompt = f"""You are a helpful education expert who makes IEPs (Individualized Education Programs) easy for parents to understand. Your task is to create a thorough yet clear summary of this 150-page IEP document.

Please analyze this IEP document and provide:

1. A comprehensive parent-friendly summary (200-250 words) that:
   - Covers all major decisions and services in the IEP
   - Uses simple language (8th-grade reading level)
   - Explains what the plan means for their child's daily school life
   - Highlights any important dates, changes, or actions needed
   - Has a warm, supportive tone

2. For each of these sections found in the document:
   {', '.join(IEP_SECTIONS.keys())}

   Please provide:
   - Location in document (beginning, middle, or end)
   - A thorough yet clear summary covering these key points:
     {json.dumps(section_points, indent=2)}
   - Any specific numbers, hours, or measurements
   - Important dates or deadlines
   - Required parent actions or decisions

3. Extract the following information:
"""

    for tag, values in CUSTOM_TAGS.items():
        if values:
            prompt += f"{tag}: {', '.join(values)}\n"
        else:
            prompt += f"{tag}: Extract from content\n"
        if tag in TAG_DESCRIPTIONS:
            prompt += f"   Description: {TAG_DESCRIPTIONS[tag]}\n"

    prompt += f"""
Please format your response as JSON with this structure:
{{
    "summary": "Comprehensive parent-friendly summary of the IEP",
    "sections": {{
        "section_name": {{
            "present": true/false,
            "summary": "Thorough explanation covering all key points",
            "key_points": {{
                "point_category": "Specific details found",
                ...
            }},
            "important_dates": ["List of any important dates"],
            "parent_actions": ["List of required parent actions"],
            "location": "beginning/middle/end"
        }},
        ...
    }},
    "tags": {{
        "language": "english/chinese/spanish/vietnamese",
        "school_year": "extracted year",
        "review_date": "extracted date"
    }}
}}

Critical Requirements:
- Do not omit any important details or measurements
- Keep all specific services, hours, and accommodations
- Explain technical terms while preserving their official names
- Include all dates, deadlines, and required actions
- Write in clear language at an 8th-grade reading level
- Organize information in a way that's easy to reference
- Highlight anything that needs parent attention or decisions

Document Name: {key}
Document Content: {content}"""

    return prompt