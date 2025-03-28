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
        'When services begin and end'
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

Translate the following IEP document content into {target_language}. {language_context}

Translation Guidelines:
1. Translate directly without adding any introductory text, explanations of your process, or JSON formatting
2. Do not include phrases like "Here's the translation" or "Here's the content in {target_language}"
3. Write at an 8th-grade reading level while preserving all important information
4. For technical terms, keep the official term and add a simple explanation in parentheses once
5. Keep numbers, dates, and measurements in their original format
6. Return ONLY the translated text without any wrapper or metadata
7. Maintain the exact same structure and sections as the English version
8. Keep all section titles exactly the same as in English

The content to translate is a JSON object with the following structure:
```json
{json.dumps(content, indent=2)}
```

IMPORTANT: 
1. Return ONLY the translated JSON object with the exact same structure
2. Keep all section titles and keys exactly the same as in English
3. Only translate the text content within the "S" fields
4. Keep all numbers, dates, and measurements in their original format
5. For the 'services' section, maintain the exact same format for durations (e.g., "300 min/week (5 hrs/week)")

Return the complete translated JSON object with the same structure but translated content.
"""

def get_all_tags():
    """Compile all sections into a single list for reference."""
    return {
        'sections': list(IEP_SECTIONS.keys())
    }

def get_full_prompt(key, content):
    """
    Generate a prompt for document analysis.
    
    Args:
        key (str): Document type key
        content (str): Document content
    """
    section_points = {section: points for section, points in SECTION_KEY_POINTS.items()}
    
    # Build the JSON structure example
    json_structure = {
        "summaries": {
            "M": {
                "en": {"S": "English summary text"}
            }
        },
        "sections": {
            "M": {
                "en": {
                    "M": {
                        "Section Name": {
                            "M": {
                                "S": {"S": "English section content"}
                            }
                        }
                    }
                }
            }
        }
    }
    
    prompt = f"""
You are an expert IEP document summarizer. Analyze the following student IEP document and extract the key information.

Extract the following:
1. A concise summary of the entire document focusing on the student's needs, goals, and accommodations
2. Structured sections based on the document's content, always only include the following sections: {', '.join(IEP_SECTIONS.keys())}.

When analyzing the document, pay special attention to these important sections:
{', '.join(IEP_SECTIONS.keys())}

For each section, cover these key points where applicable:
{json.dumps(section_points, indent=4)}

Special instructions:
- For the 'services' section specifically:
  * ALWAYS show the original duration in minutes as mentioned in the IEP
  * In parentheses, include the conversion to hours per week
  * Format as: "X min/week (Y hrs/week) if the duration is more than 60 minutes"
  * Example: "300 min/week (5 hrs/week)" or "100 min/week (1 hr 40 min/week)"

- Use simple language (8th-grade reading level)
- Explain technical terms in parentheses
- Include all specific services, accommodations, and important dates

Format your response as a JSON object with the following structure:
```json
{json.dumps(json_structure, indent=2)}
```

IMPORTANT: 
1. Your response MUST be valid JSON only. No introduction, explanation, or markdown outside the JSON.
2. Make sure to include all the sections and key points.
3. Keep the section titles consistent.
4. Ensure all sections are present.
5. The structure must exactly match the example format above.

Document content:
{content}
"""
    return prompt

def clean_translation(text):
    """Clean up translation output to remove any JSON structure or explanatory text"""
    # Remove any JSON structure markers
    text = text.replace('```json', '').replace('```', '')
    
    # Remove any explanatory text
    text = re.sub(r'^.*?(?=\w)', '', text, flags=re.MULTILINE)
    
    # Remove any trailing whitespace or newlines
    text = text.strip()
    
    return text