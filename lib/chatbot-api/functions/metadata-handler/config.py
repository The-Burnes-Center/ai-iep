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

# System messages for different AI tasks
TRANSLATION_SYSTEM_MSG = 'You are an expert translator specializing in educational documents, particularly IEPs.'
DOCUMENT_ANALYSIS_SYSTEM_MSG = 'You are an expert in analyzing educational documents, especially IEPs.'
SUMMARY_SYSTEM_MSG = 'You are an expert in summarizing IEP documents in a parent-friendly manner that captures the essential information.'
CHUNK_ANALYSIS_SYSTEM_MSG = 'You are an expert in analyzing and summarizing educational documents, especially Individualized Education Programs (IEPs).'

# JSON formatting instructions to ensure valid parseable output
JSON_FORMATTING_INSTRUCTIONS = """
IMPORTANT JSON FORMATTING REQUIREMENTS:
1. Do NOT include any markdown backticks (```) around the JSON
2. Ensure all strings are properly escaped with double quotes
3. Avoid control characters, newlines, or tabs within JSON string values
4. For multiline text in summaries, use space characters instead of newlines
5. For bullet points in summaries, use simple dashes or asterisks without line breaks
6. Your entire response must be valid, parseable JSON with no additional text
7. Do not include any explanations or text outside the JSON structure
8. Keep string values simple with only ASCII printable characters when possible
"""

def get_document_analysis_prompt(text_content):
    """
    Create a prompt for analyzing a document.
    
    Args:
        text_content: The document text to analyze
    
    Returns:
        A formatted prompt string for the LLM
    """
    prompt = f"""
Human: I need you to analyze the following document which is an Individualized Education Program (IEP) for a student. An IEP is a legal document that outlines the special education services a student will receive, based on their needs. Please:

1. Provide a comprehensive summary of the document (1-3 paragraphs).
2. Identify and extract the key sections of the IEP.
3. For each section, provide:
   - A summary of what the section contains
   - The key points from that section
   - Any important dates mentioned
   - Any actions parents need to take
   - Location information for where this section appears in the document

The sections should include (if present in the document):
- Present Levels of Academic Achievement and Functional Performance
- Eligibility for Services
- Placement Decision
- Goals and Objectives
- Special Education and Related Services
- Accommodations and Modifications
- Information about Informed Consent
- Any other important sections you identify

Your analysis should be structured as valid JSON with the following format:
```json
{{
  "summary": "Overall comprehensive summary of the document",
  "sections": {{
    "present_levels": {{
      "present": true,
      "summary": "Summary of present levels section",
      "key_points": {{"point1": "description", "point2": "description"}},
      "important_dates": ["date1", "date2"],
      "parent_actions": ["action1", "action2"],
      "location": "Section appears on pages X-Y"
    }},
    "eligibility": {{
      "present": true,
      "summary": "Summary of eligibility section",
      "key_points": {{"point1": "description", "point2": "description"}},
      "important_dates": ["date1", "date2"],
      "parent_actions": ["action1", "action2"],
      "location": "Section appears on pages X-Y"
    }},
    ... (other sections) ...
  }}
}}
```

Make sure to only include sections that actually appear in the document, and set "present" to false if a standard section is not found.

Here is the document text:

{text_content}
"""
    return prompt

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

def get_translation_prompt_simple(text, target_language):
    """
    Create a simple translation prompt.
    
    Args:
        text: Text to translate
        target_language: Language name to translate into
    
    Returns:
        A formatted prompt string for translation
    """
    return f"""
Human: Please translate the following text into {target_language}.
Maintain the original meaning, tone, and format as closely as possible.
Only return the translation, with no explanations, introductions, or other text.

Text to translate:

{text}
"""

def get_final_json_analysis_prompt(combined_text_analysis):
    """
    Create a prompt for generating the final structured JSON from combined text analysis.
    
    Args:
        combined_text_analysis: Combined text analysis from all document chunks
    
    Returns:
        A formatted prompt string for the LLM
    """
    return f"""
Human: You are an expert at analyzing IEP (Individualized Education Program) documents. You previously analyzed a document in chunks, and I need you to generate a comprehensive structured summary from those analyses.

Here is the combined analysis:

{combined_text_analysis}

Please extract all important information and format it as a JSON object with the following structure:
{{
  "summary": "Overall comprehensive summary of the entire document in 2-3 paragraphs",
  "sections": {{
    "present_levels": {{
      "present": true/false,
      "summary": "Summary of the present levels section",
      "key_points": {{
        "point1": "description",
        "point2": "description"
      }},
      "important_dates": ["date1", "date2"],
      "parent_actions": ["action1", "action2"],
      "location": "Where this section appears in the document"
    }},
    "eligibility": {{
      "present": true/false,
      "summary": "Summary of the eligibility section",
      "key_points": {{...}},
      "important_dates": [...],
      "parent_actions": [...],
      "location": "..."
    }},
    "placement": {{...}},
    "goals": {{...}},
    "services": {{...}},
    "accommodations": {{...}},
    "informed_consent": {{...}}
  }}
}}

Important notes:
1. Only include sections that are actually present in the document
2. For each section, set "present" to true if the section exists, false otherwise
3. Include any other important sections that were found in the document but aren't listed above
4. Make sure to include all important dates, actions for parents, and any significant numbers (hours of services, etc.)
5. Return valid JSON without any additional text, explanations, or markdown formatting
"""

def get_simplified_json_analysis_prompt(combined_text_analysis):
    """
    Create a simplified fallback prompt for generating JSON from combined text analysis.
    Used when the more detailed prompt fails.
    
    Args:
        combined_text_analysis: Combined text analysis from all document chunks
    
    Returns:
        A formatted prompt string for the LLM
    """
    return f"""
Human: You need to extract a structured summary from this document analysis:

{combined_text_analysis}

Format your response as a simple JSON with:
1. An overall summary 
2. Sections found in the document

Example format:
{{
  "summary": "Comprehensive summary goes here",
  "sections": {{
    "section1_name": {{
      "present": true,
      "summary": "Section summary",
      "important_dates": ["date1", "date2"],
      "parent_actions": ["action1", "action2"]
    }}
  }}
}}

Return ONLY the JSON without explanation or commentary.
"""

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

{JSON_FORMATTING_INSTRUCTIONS}

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

def get_chunk_system_message(chunk_index, total_chunks):
    """Generate a system message for a specific chunk of a document."""
    if chunk_index == 0:
        return f"You are an expert in analyzing educational documents, especially IEPs. IMPORTANT: This is part {chunk_index+1} of {total_chunks} of a longer document. Focus on the beginning sections."
    elif chunk_index == total_chunks - 1:
        return f"You are an expert in analyzing educational documents, especially IEPs. IMPORTANT: This is part {chunk_index+1} of {total_chunks} of a longer document. Focus on the ending sections."
    else:
        return f"You are an expert in analyzing educational documents, especially IEPs. IMPORTANT: This is part {chunk_index+1} of {total_chunks} of a longer document. Focus on the middle sections."

def get_unified_summary_prompt(sections_text, previous_summaries=""):
    """Generate a prompt for creating a unified summary from chunked analysis results."""
    return f"""
You need to create a comprehensive parent-friendly summary of an IEP document. 
I've already analyzed the document in chunks, and now I need you to create a unified, coherent summary.

Your summary should:
- Cover all major decisions and services in the IEP
- Use simple language (8th-grade reading level)
- Explain what the plan means for the child's daily school life
- Highlight any important dates, changes, or actions needed
- Incorporate any significant concerns or input from parents or teachers
- Have a warm, supportive tone
- Be 3-4 sentences long

Here are the extracted sections and their details:

{sections_text}

{previous_summaries}

Based on all this information, provide a comprehensive yet concise parent-friendly summary of the entire IEP document.
"""

def get_chunk_analysis_prompt(chunk_text, chunk_index, total_chunks, context=None):
    """
    Generate a prompt for analyzing a single chunk of text from an IEP document.
    
    Args:
        chunk_text: The chunk of text to analyze
        chunk_index: Current chunk number
        total_chunks: Total number of chunks
        context: Optional context from previous chunks
    
    Returns:
        A formatted prompt string for the LLM
    """
    # Add context information if available
    context_text = ""
    if context:
        context_text = f"""
This chunk follows after chunk {context.get('chunk_number', 'unknown')}.
Here is the end of the previous chunk to provide continuity:
{context.get('content_preview', 'No preview available')}

"""

    # Create the prompt with context
    prompt = f"""
Human: Please analyze this section (chunk {chunk_index}/{total_chunks}) of an IEP document.

{context_text}
For this chunk, please:

1. Identify any IEP sections present in this text
2. For each identified section:
   - Provide a clear summary
   - Note any key points
   - List any important dates mentioned
   - List any actions parents need to take
   - Describe where in the document this section appears

Do not try to generate structured JSON for this chunk. Instead, provide a clear text analysis that describes what you found in this chunk. This will be combined with analyses of other chunks later.

Chunk {chunk_index}/{total_chunks} content:

{chunk_text}
"""
    return prompt
