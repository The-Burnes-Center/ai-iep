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

# Enhanced prompt instructions to handle partial/encoded PDF content
PDF_EXTRACTION_GUIDANCE = """
IMPORTANT PDF PROCESSING INSTRUCTIONS:
1. If you encounter text that appears to be PDF encoding or binary data, ignore it and focus only on the readable content.
2. If a chunk appears to be mostly technical PDF structure information, report this and focus on any readable content.
3. Attempt to make connections between fragmented text by inferring context from headings and formatting.
4. For partially readable content, extract whatever meaningful information is available rather than refusing to analyze.
5. Recognize common IEP formatting patterns even when fragments of text are present.
"""

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

def get_json_analysis_prompt(combined_text_analysis):
    """
    Create a combined prompt for generating structured JSON from document analysis.
    This function combines the previous final and simplified prompts into a more robust solution.
    
    Args:
        combined_text_analysis: Combined text analysis from all document chunks
    
    Returns:
        A formatted prompt string for the LLM
    """
    # Create extraction guide based on the IEP_SECTIONS and SECTION_KEY_POINTS
    section_guides = []
    
    # Student Information - Special case since it's not directly in IEP_SECTIONS
    section_guides.append("""
1. Student Information:
   - Student name, spelled exactly as it appears in the document
   - Age/birthdate in format MM/DD/YYYY if available
   - Grade level (e.g., 3rd grade, 5th grade)
   - Primary disability category (e.g., Autism, Specific Learning Disability)
   - Secondary disability if any (e.g., Speech/Language Impairment)
   - Look in 'eligibility' and beginning sections for this information
""")
    
    # Present Levels of Performance
    if 'present_levels' in IEP_SECTIONS and 'present_levels' in SECTION_KEY_POINTS:
        present_levels_points = "\n   - ".join(SECTION_KEY_POINTS['present_levels'])
        section_guides.append(f"""
2. {IEP_SECTIONS['present_levels']}:
   - {present_levels_points}
   - Look in 'present_levels' sections for this information
""")
    
    # Services
    if 'services' in IEP_SECTIONS and 'services' in SECTION_KEY_POINTS:
        section_guides.append(f"""
3. {IEP_SECTIONS['services']}:
   - Special education instruction with EXACT hours/week (e.g., "5 hours weekly")
   - Speech therapy services with hours/week
   - Occupational therapy services with hours/week
   - Physical therapy services with hours/week
   - Counseling services if mentioned
   - Start and end dates for services
   - Look in 'services' sections for this information
   - IMPORTANT: ALWAYS convert minutes to hours (e.g., 300 minutes = 5 hours)
""")
    
    # Goals
    if 'goals' in IEP_SECTIONS and 'goals' in SECTION_KEY_POINTS:
        goals_points = "\n   - ".join(SECTION_KEY_POINTS['goals'])
        section_guides.append(f"""
4. {IEP_SECTIONS['goals']}:
   - {goals_points}
   - Look in 'goals' sections for this information
""")
    
    # Accommodations
    if 'accommodations' in IEP_SECTIONS and 'accommodations' in SECTION_KEY_POINTS:
        accommodations_points = "\n   - ".join(SECTION_KEY_POINTS['accommodations'])
        section_guides.append(f"""
5. {IEP_SECTIONS['accommodations']}:
   - {accommodations_points}
   - Look in 'accommodations' sections for this information
""")
    
    # Combine all section guides
    extraction_guide = "EXTRACTION GUIDE - Extract this information from the document analysis:" + "".join(section_guides)
    
    # Example of the expected output format (simplified DynamoDB format)
    example_format = """
EXAMPLE OUTPUT FORMAT:
{
  "summary": "This IEP is for John Smith, a 10-year-old 4th grader with Autism and Speech/Language Impairment...",
  "sections": {
    "Student Information": "Name: John Smith, Age: 10, Grade: 4th, Primary disability: Autism, Secondary disability: Speech/Language Impairment",
    "Present Levels of Performance": "Reading: Can decode at grade level but struggles with comprehension. Math: Knows addition but struggles with subtraction and regrouping. Writing: Can form letters but has difficulty with coherent paragraphs. Communication: Speech is 60% intelligible to unfamiliar listeners.",
    "Services": "Specialized Academic Instruction: 5 hours weekly, Speech Therapy: 1.7 hours weekly, Occupational Therapy: 0.5 hours weekly",
    "Goals": "Reading: Will improve comprehension from 50% to 80% accuracy. Math: Will learn regrouping for double-digit addition/subtraction with 85% accuracy. Speech: Will increase intelligibility to 80% with unfamiliar listeners.",
    "Accommodations": "Visual supports, peer buddy, extra time for assignments, separate setting for assessments, alternate response methods, scaffolded writing supports"
  }
}
"""
    
    return f"""
Human: You are an expert at analyzing IEP (Individualized Education Program) documents. You've received pre-processed analysis from multiple document chunks, and now need to create a structured summary.

{PDF_EXTRACTION_GUIDANCE}

{extraction_guide}

Here is the combined analysis from all document chunks that have already been processed:

{combined_text_analysis}

TASK:
Using the pre-processed chunk analyses, create a final structured summary. Each chunk has already been analyzed for IEP sections, so you'll need to:

1. Combine information across chunks to form a complete picture
2. Resolve any conflicts or repetitions in the analysis
3. Create a unified summary that captures the most important elements
4. Structure the final output in a clean JSON format

Based on this analysis, extract the most important information and format it as a JSON object:

{example_format}

IMPORTANT REQUIREMENTS:
1. Create a concise but comprehensive summary of the entire IEP (2-3 paragraphs)
2. For each section, include ALL relevant information as a single string
3. Be EXTREMELY precise about service times and ALWAYS use hours/week (e.g., "5 hours weekly")
4. Format with clear separators (e.g., "Name: John Smith, Age: 10")
5. If information is missing for a field, write "Not specified" rather than leaving it blank
6. Focus on OBJECTIVE facts from the document - do not add interpretations
7. Use section titles exactly as shown in the example format
8. Always CONVERT service times from minutes to hours (divide by 60) and format as "X hours weekly"

{JSON_FORMATTING_INSTRUCTIONS}

Return valid JSON without any additional text, explanations, or markdown formatting.
"""

def get_all_tags():
    """Compile all sections into a single list for reference."""
    return {
        'sections': list(IEP_SECTIONS.keys())
    }

def get_chunk_analysis_prompt(chunk_text, chunk_index, total_chunks, context=None):
    """
    Generate a prompt for analyzing a single chunk of text from an IEP document.
    Optimized for map-reduce pattern to extract key information.
    
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

    # Generate section list for prompt
    section_names = ", ".join([f"'{name}' ({desc})" for name, desc in IEP_SECTIONS.items()])
    
    # Create a section-specific guide for extraction
    section_extraction_guide = ""
    for section_name, key_points in SECTION_KEY_POINTS.items():
        section_extraction_guide += f"\n{section_name.upper()}:\n"
        for point in key_points:
            section_extraction_guide += f"- {point}\n"
    
    # Create the prompt with context and PDF guidance
    prompt = f"""
Human: You are an educational document analyst specializing in IEPs. Please analyze chunk {chunk_index}/{total_chunks} of an IEP document.

{PDF_EXTRACTION_GUIDANCE}

{context_text}
TASK:
Your task is to extract and organize key information from this chunk of an IEP document. You're part of a map-reduce system:
- You're processing one chunk of the document (the MAP phase)
- Your analysis will later be combined with other chunks (the REDUCE phase)

For this chunk, please:

1. Identify any IEP sections present in this text from among: {section_names}

2. For each identified section, extract information in a clear, organized format:
   a) Write the section name (e.g., "PRESENT LEVELS OF PERFORMANCE:")
   b) Extract all key information for that section
   c) Be especially careful to note:
      - Student details (name, age, grade, disabilities)
      - Academic performance in different subjects
      - Service types with EXACT hours/frequency (ALWAYS convert minutes to hours, e.g., 300 minutes = 5 hours weekly)
      - Specific goals in different areas
      - Specific accommodations and modifications
      - Important dates
      - Parent actions required

KEY INFORMATION TO EXTRACT FROM EACH SECTION:
{section_extraction_guide}

SPECIAL INSTRUCTIONS:
- If this chunk contains PDF binary data or non-readable content, extract any meaningful text you can find
- Always convert service time from minutes to hours (300 minutes = 5 hours) and format as "X hours weekly"
- Be precise about quantities, dates, and names
- Include direct quotes when they provide important details
- Organize information by section for easy reference in the reduce phase
- DO NOT try to generate JSON - just provide clear text analysis

Chunk {chunk_index}/{total_chunks} content:

{chunk_text}
"""
    return prompt
