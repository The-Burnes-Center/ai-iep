import os
import json
import boto3
import traceback
import re
from translation import translate_content
from PyPDF2 import PdfReader
import io
from google_auth import get_documentai_client
from config import (
    get_chunk_analysis_prompt,
    get_json_analysis_prompt,
    IEP_SECTIONS,
    PDF_EXTRACTION_GUIDANCE
)
from llm_service import invoke_claude, invoke_claude_3_5, CLAUDE_MODELS
import time
import uuid
from datetime import datetime
import tiktoken
from botocore.exceptions import ClientError
import logging
from itertools import groupby

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Boto3 clients
bedrock_runtime = boto3.client('bedrock-runtime')

# Configure models
ANTHROPIC_MODEL = os.environ.get('ANTHROPIC_MODEL', 'anthropic.claude-3-5-sonnet-20240620-v1:0')

# Constants for chunk processing
# Increase max tokens per chunk to reduce the number of chunks and provide more context
MAX_TOKENS_PER_CHUNK = 120000  # Increased from 80000 to reduce number of chunks

# Minimum meaningful chunk size in characters to avoid tiny chunks
MIN_CHUNK_SIZE = 2000

# Encoding for token estimation
CL100K_ENCODING = tiktoken.get_encoding("cl100k_base")

def get_token_count(text):
    """Estimate token count for a text string using tiktoken."""
    if not text:
        return 0
    return len(CL100K_ENCODING.encode(text))

def summarize_and_analyze_document(document_content, user_profile=None):
    """
    Process a document by summarizing and categorizing it into sections.
    
    Args:
        document_content: The binary content of the document file
        user_profile: Optional user profile containing language preferences
    
    Returns:
        A dictionary with processing results
    """
    start_time = time.time()
    
    try:
        # Check if content is binary (likely a PDF file)
        is_binary = isinstance(document_content, bytes)
        
        if is_binary:
            logger.info("Detected binary content, attempting document extraction")
            
            # First try using Google Document AI for high-quality extraction
            try:
                logger.info("Attempting extraction with Google Document AI")
                doc_ai_text = extract_text_with_documentai(document_content)
                
                if doc_ai_text and len(doc_ai_text.strip()) > 500:
                    logger.info(f"Successfully extracted text with Document AI: {len(doc_ai_text)} characters")
                    text_content = doc_ai_text
                else:
                    logger.info("Document AI extraction yielded insufficient content, falling back to PyPDF2")
                    extracted_text = extract_text_from_pdf(document_content)
                    
                    if extracted_text and len(extracted_text.strip()) > 500:
                        logger.info(f"Successfully extracted text with PyPDF2: {len(extracted_text)} characters")
                        text_content = extracted_text
                    else:
                        logger.info("PyPDF2 extraction also yielded insufficient content, falling back to decode")
                        text_content = document_content.decode('utf-8', errors='replace')
            except Exception as e:
                logger.warning(f"Document AI extraction failed: {str(e)}, falling back to PyPDF2")
                extracted_text = extract_text_from_pdf(document_content)
                
                if extracted_text and len(extracted_text.strip()) > 500:
                    logger.info(f"Successfully extracted text with PyPDF2: {len(extracted_text)} characters")
                    text_content = extracted_text
                else:
                    logger.info("PyPDF2 extraction yielded insufficient content, falling back to decode")
                    text_content = document_content.decode('utf-8', errors='replace')
        else:
            # If it's already text, just use it
            text_content = document_content
        
        # Attempt to further clean the text to remove binary content
        text_content = improve_text_quality(text_content)
        
        logger.info(f"Document word count: {len(text_content.split())} words")
        logger.info(f"Document token count: {get_token_count(text_content)}")
        
        # Define target languages for translation based on user profile
        target_languages = []
        if user_profile:
            if 'languages' in user_profile:
                # Use the existing languages array from user profile
                all_languages = user_profile.get('languages', [])
                logger.info(f"Using languages from user profile: {all_languages}")
                
                # Only include non-English languages for translation
                target_languages = [lang for lang in all_languages if lang != 'en']
                if target_languages:
                    logger.info(f"Target languages for translation: {target_languages}")
                else:
                    logger.info("No non-English languages found for translation")
            else:
                # Create languages array from primary/secondary languages if not exists
                languages = []
                
                # Always include 'en' (English) as a base language
                if 'en' not in languages:
                    languages.append('en')
                
                # Check for primary language
                primary_lang = user_profile.get('primaryLanguage')
                if primary_lang and primary_lang not in languages:
                    languages.append(primary_lang)
                    logger.info(f"Added primary language: {primary_lang}")
                
                # Check for secondary language
                secondary_lang = user_profile.get('secondaryLanguage')
                if secondary_lang and secondary_lang not in languages:
                    languages.append(secondary_lang)
                    logger.info(f"Added secondary language: {secondary_lang}")
                
                # Set target languages (excluding English)
                target_languages = [lang for lang in languages if lang != 'en']
                if target_languages:
                    logger.info(f"Target languages for translation: {target_languages}")
                else:
                    logger.info("No non-English languages found for translation")
        else:
            logger.info("No user profile provided, skipping translations")
        
        # Always process document in chunks regardless of size
        logger.info("Using chunked document processing approach")
        # Process document in chunks
        chunk_results = process_document_in_chunks(text_content)
        
        # Log diagnostic info about the chunked processing
        logger.info(f"Processed document in {len(chunk_results)} chunks.")
        
        # Combine the results from all chunks
        combined_text_analysis = combine_chunk_results(chunk_results)
        
        # Generate the final structured JSON analysis
        result = generate_final_json_analysis(combined_text_analysis, target_languages)
        
        # Check if we need to translate
        if target_languages:
            logger.info(f"Translating into languages: {target_languages}")
            
            # Translate the summary
            if 'summary' in result and result['summary']:
                # Translate the document summary
                try:
                    translated_summary = translate_content(
                        content=result['summary'],
                        target_languages=target_languages
                    )
                    
                    # Update the summary with translated versions
                    if isinstance(translated_summary, dict):
                        result['summary'] = translated_summary
                except Exception as e:
                    logger.error(f"Error translating summary: {str(e)}")
            
            # Translate the structured sections data
            if 'sections' in result and result['sections']:
                try:
                    # Process each section
                    for section_name, section_data in result['sections'].items():
                        # Check if the section has a summary to translate
                        if 'summary' in section_data and section_data['summary']:
                            # Translate the section summary
                            translated_summary = translate_content(
                                content=section_data['summary'],
                                target_languages=target_languages
                            )
                            
                            # Update the section summary with translated versions
                            if isinstance(translated_summary, dict):
                                result['sections'][section_name]['summary'] = translated_summary
                except Exception as e:
                    logger.error(f"Error translating sections: {str(e)}")
                    traceback.print_exc()
        
        end_time = time.time()
        logger.info(f"Document processing completed in {end_time - start_time:.2f} seconds")
        
        return {
            'success': True,
            'result': result
        }
    
    except Exception as e:
        error_message = f"Error processing document: {str(e)}"
        logger.error(error_message)
        traceback.print_exc()
        
        return {
            'success': False,
            'error': error_message
        }

def process_document_in_chunks(text_content):
    """
    Process a document in chunks by splitting the content and processing each chunk.
    
    Args:
        text_content: The full text content to be processed
    
    Returns:
        A list of results from each chunk, each containing plain text analysis
    """
    # Calculate approximate token count
    token_count = get_token_count(text_content)
    logger.info(f"Processing document with {token_count} tokens in chunks")
    
    # Determine optimal chunk size based on token count
    # Aim for fewer chunks with more context in each
    target_chunk_count = max(1, min(5, (token_count // (MAX_TOKENS_PER_CHUNK // 2))))
    logger.info(f"Target chunk count: {target_chunk_count}")
    
    # Start with a minimum chunk size (in characters)
    avg_chars_per_token = len(text_content) / max(1, token_count)
    chars_per_chunk = int((MAX_TOKENS_PER_CHUNK // 2) * avg_chars_per_token)
    
    # Create chunk boundaries
    chunks = []
    
    # First attempt to extract just the readable text parts and filter out binary/encoding data
    cleaned_text = clean_pdf_text(text_content)
    if cleaned_text and len(cleaned_text) > MIN_CHUNK_SIZE:
        logger.info(f"Using cleaned text version ({len(cleaned_text)} chars)")
        text_to_process = cleaned_text
    else:
        logger.info("Using original text (cleaning didn't produce sufficient content)")
        text_to_process = text_content
    
    # Split by section or natural breaks if possible
    section_boundaries = find_section_boundaries(text_to_process)
    
    if section_boundaries and len(section_boundaries) > 1:
        logger.info(f"Splitting document into {len(section_boundaries)} natural sections")
        
        # Use the section boundaries to create chunks, merging small sections together
        current_chunk = ""
        current_chunk_tokens = 0
        
        for i in range(len(section_boundaries)):
            start_idx = section_boundaries[i]
            end_idx = section_boundaries[i+1] if i+1 < len(section_boundaries) else len(text_to_process)
            
            section_text = text_to_process[start_idx:end_idx]
            section_tokens = get_token_count(section_text)
            
            # If adding this section would exceed our chunk size, finish current chunk
            if current_chunk_tokens > 0 and current_chunk_tokens + section_tokens > MAX_TOKENS_PER_CHUNK:
                chunks.append(current_chunk)
                current_chunk = section_text
                current_chunk_tokens = section_tokens
            else:
                # Otherwise, add to current chunk
                if current_chunk:
                    current_chunk += "\n\n"
                current_chunk += section_text
                current_chunk_tokens += section_tokens
        
        # Add the last chunk if it exists
        if current_chunk:
            chunks.append(current_chunk)
    else:
        # No natural section breaks found, use simple character-based splitting
        logger.info("No natural sections found, splitting by character count")
        
        # Calculate a more accurate chunk size based on token estimate
        chunk_size = min(chars_per_chunk, 100000)  # Cap at 100K chars to be safe
        
        # Split into chunks using simpler approach
        for i in range(0, len(text_to_process), chunk_size):
            chunk = text_to_process[i:i + chunk_size]
            if len(chunk) > MIN_CHUNK_SIZE:  # Only add chunks with meaningful content
                chunks.append(chunk)
    
    # Ensure we have at least one chunk
    if not chunks:
        logger.warning("No valid chunks created, using full text as a single chunk")
        chunks.append(text_to_process)
    
    logger.info(f"Created {len(chunks)} chunks for processing")
    
    # Process each chunk in parallel (can be enhanced with async if needed)
    chunk_results = []
    
    for i, chunk in enumerate(chunks):
        # If not the first chunk, provide some context from the previous chunk
        context = None
        if i > 0:
            # Provide last few paragraphs from the previous chunk
            prev_chunk_preview = "\n".join(chunks[i-1].split("\n")[-10:])
            context = {
                "chunk_number": i-1,
                "content_preview": prev_chunk_preview
            }
        
        # Process the chunk
        result = process_chunk_with_context(chunk, i+1, len(chunks), context)
        chunk_results.append(result)
    
    return chunk_results

def clean_pdf_text(text_content):
    """
    Attempt to clean PDF text by removing binary data and encoding information.
    
    Args:
        text_content: The raw text content from the PDF
    
    Returns:
        Cleaned text with binary/encoding data removed or original if cleaning fails
    """
    try:
        # Remove common PDF binary patterns
        cleaned = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]', '', text_content)
        
        # Remove PDF object references and stream data
        cleaned = re.sub(r'\d+ \d+ obj[\s\S]*?endobj', ' ', cleaned)
        cleaned = re.sub(r'stream[\s\S]*?endstream', ' ', cleaned)
        
        # Remove font definitions and other technical PDF content
        cleaned = re.sub(r'/Type\s*/[\w]+', ' ', cleaned)
        cleaned = re.sub(r'/Font\s*<<[\s\S]*?>>', ' ', cleaned)
        
        # Remove PDF operators and syntax
        cleaned = re.sub(r'^\s*[/\[\]()<>{}][\w/\s]*$', '', cleaned, flags=re.MULTILINE)
        
        # Normalize whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned)
        
        # If we've removed too much content, return the original
        if len(cleaned) < len(text_content) * 0.1:
            logger.warning("Cleaning removed too much content, using original")
            return text_content
        
        return cleaned
    except Exception as e:
        logger.error(f"Error cleaning PDF text: {str(e)}")
        return text_content

def find_section_boundaries(text_content):
    """
    Find natural section boundaries in a document using common section header patterns.
    
    Args:
        text_content: The document text content
    
    Returns:
        List of character indices where sections begin
    """
    # Always include the beginning of the document
    boundaries = [0]
    
    # Look for section header patterns
    patterns = [
        # 1. Roman numerals followed by a title
        r'\n(?:(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\.?\s+[A-Z][\w\s]+:?(?:\n|\r\n))',
        
        # 2. Numbered sections
        r'\n(?:\d+\.(?:\d+\.)*\s+[A-Z][\w\s]+:?(?:\n|\r\n))',
        
        # 3. All caps headers that look like sections
        r'\n(?:[A-Z]{3,}(?:[\s\-][A-Z]+)*(?::|\n|\r\n))',
        
        # 4. Form field patterns like "Student Name:"
        r'\n(?:[A-Z][\w\s]+:(?:\s+|$))',
        
        # 5. Common IEP section headers
        r'\n(?:(?:PRESENT\s+LEVELS|GOALS|OBJECTIVES|ACCOMMODATIONS|SERVICES|PLACEMENT|ELIGIBILITY|ASSESSMENT)[\s\w]*(?::|\n|\r\n))',
        
        # 6. Headers with underlines
        r'\n([A-Z][\w\s]+)\n[-=_]{3,}'
    ]
    
    # Find all matches
    for pattern in patterns:
        for match in re.finditer(pattern, text_content, re.IGNORECASE):
            boundaries.append(match.start())
    
    # Remove near-duplicate boundaries (within 150 chars of each other)
    boundaries.sort()
    filtered_boundaries = [boundaries[0]]
    
    for boundary in boundaries[1:]:
        if boundary - filtered_boundaries[-1] > 150:
            filtered_boundaries.append(boundary)
    
    return filtered_boundaries

def process_chunk_with_context(chunk_text, chunk_index, total_chunks, context=None):
    """
    Process a single chunk of the document with context information, returning plain text analysis.
    
    Args:
        chunk_text (str): The chunk of text to process
        chunk_index (int): Index of the current chunk
        total_chunks (int): Total number of chunks
        context (dict, optional): Context information for the chunk
        
    Returns:
        str: Text analysis of the chunk
    """
    try:
        # Create the prompt using the imported function
        prompt = get_chunk_analysis_prompt(chunk_text, chunk_index, total_chunks, context)
        
        # Call Claude 3.5 Sonnet for this chunk
        response = invoke_claude_3_5(
            prompt=prompt,
            temperature=0,
            max_tokens=8000
        )
        
        # Log the raw output for debugging
        print(f"[CHUNK {chunk_index}/{total_chunks}] Raw text analysis length: {len(response)}")
        print(f"[CHUNK {chunk_index}/{total_chunks}] Raw text analysis preview: {response[:500]}...")
        if len(response) > 500:
            print(f"[CHUNK {chunk_index}/{total_chunks}] Raw text analysis end: ...{response[-200:]}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error processing chunk: {str(e)}")
        traceback.print_exc()
        return f"Error in chunk {chunk_index}/{total_chunks}: {str(e)}"

def combine_chunk_results(chunk_results):
    """
    Combine text analyses from multiple chunks into a single text.
    
    Args:
        chunk_results (list): List of text analyses from each chunk
        
    Returns:
        str: Combined text analysis
    """
    print(f"Combining {len(chunk_results)} text analyses")
    
    # Add a separator and chunk identifier before each chunk analysis
    formatted_chunks = []
    for i, analysis in enumerate(chunk_results):
        formatted_chunks.append(f"\n\n--- CHUNK {i+1}/{len(chunk_results)} ANALYSIS ---\n\n{analysis}")
    
    # Join all analyses with separation
    combined_text = "\n".join(formatted_chunks)
    
    print(f"Combined text analysis length: {len(combined_text)}")
    print(f"Combined text analysis preview: {combined_text[:500]}...")
    
    return combined_text

def generate_final_json_analysis(combined_text_analysis, target_languages=None):
    """
    Convert the combined text analysis into structured JSON format.
    
    Args:
        combined_text_analysis (str): Combined text analysis from all chunks
        target_languages (list, optional): List of language codes to include in the output
        
    Returns:
        dict: Structured document analysis
    """
    try:
        # Create the prompt for generating the structured JSON using the combined function
        prompt = get_json_analysis_prompt(combined_text_analysis)
        
        # Call Claude 3.5 Sonnet to generate the structured JSON
        response = invoke_claude_3_5(
            prompt=prompt,
            temperature=0,
            max_tokens=8000
        )
        
        # Parse the response
        result = parse_document_analysis(response)
        
        if not result:
            logger.warning("Failed to parse JSON from final analysis")
            
            # Retry with the same prompt but give a better warning
            logger.info("Retrying with the same prompt")
            
            # Try Claude 3.5 Sonnet for better handling of complex JSON 
            response = invoke_claude_3_5(
                prompt=prompt,
                temperature=0,
                max_tokens=8000
            )
            
            # Log the output for debugging
            logger.info(f"Raw text analysis output length: {len(response)}")
            logger.info(f"Raw text analysis preview: {response[:500]}...")
            
            # Try to parse the JSON again
            result = parse_document_analysis(response)
        
        # Transform the result to the simplified format if it's not already
        if result and 'sections' in result and not is_simplified_format(result):
            result = transform_to_simplified_format(result, target_languages)
        
        logger.info(f"Successfully generated structured JSON from combined analysis")
        return result
        
    except Exception as e:
        logger.error(f"Error generating final JSON analysis: {str(e)}")
        traceback.print_exc()
        return None

def is_simplified_format(result):
    """Check if the result is already in the simplified format"""
    if not result or 'sections' not in result:
        return False
        
    sections = result.get('sections', {})
    if isinstance(sections, dict) and 'M' in sections and 'en' in sections.get('M', {}):
        # Check format of first section in English
        en_sections = sections.get('M', {}).get('en', {}).get('M', {})
        if en_sections:
            first_section = next(iter(en_sections.values()), {})
            # If it has the simplified 'S' format, it's already simplified
            return 'S' in first_section.get('M', {})
    
    return False

def transform_to_simplified_format(result, target_languages=None):
    """Transform the detailed format to the simplified format
    
    Args:
        result: The result to transform
        target_languages: List of language codes to include (defaults to ['en'] if None)
    """
    try:
        if 'sections' not in result:
            return result
            
        simplified_result = {
            'summaries': result.get('summaries', {}),
            'sections': {
                'M': {}
            }
        }
        
        # Set default languages if none provided
        languages = target_languages if target_languages else ['en']
        
        # Always include English if not already in the languages list
        if 'en' not in languages:
            languages = ['en'] + languages
        
        # Process each language
        for lang in languages:
            if lang not in result.get('sections', {}):
                continue
                
            simplified_result['sections']['M'][lang] = {'M': {}}
            
            # Process each section in the original format
            for section_name, section_data in result['sections'].get(lang, {}).items():
                # Skip sections that are not present
                if not section_data.get('present', True):
                    continue
                    
                # Create a simplified section entry
                section_content = create_simplified_section_content(section_name, section_data)
                
                # Add the section to the simplified result
                simplified_result['sections']['M'][lang]['M'][section_name] = {
                    'M': {
                        'S': {
                            'S': section_content
                        }
                    }
                }
        
        return simplified_result
    except Exception as e:
        logger.error(f"Error transforming to simplified format: {str(e)}")
        return result

def create_simplified_section_content(section_name, section_data):
    """Create simplified content for a section based on the section name and data"""
    try:
        # Default to the summary if available
        if 'summary' in section_data:
            content = section_data['summary']
        else:
            content = ""
            
        # Add key points if available
        if 'key_points' in section_data and section_data['key_points']:
            # If content already exists, add a separator
            if content:
                content += ". "
                
            # Add each key point
            key_points_str = ", ".join([f"{k}: {v}" for k, v in section_data['key_points'].items()])
            if key_points_str:
                content += key_points_str
                
        # Add important dates if available
        if 'important_dates' in section_data and section_data['important_dates']:
            # If content already exists, add a separator
            if content:
                content += ". "
                
            # Add the dates
            dates_str = ", ".join(section_data['important_dates'])
            if dates_str:
                content += f"Important dates: {dates_str}"
                
        # Add parent actions if available
        if 'parent_actions' in section_data and section_data['parent_actions']:
            # If content already exists, add a separator
            if content:
                content += ". "
                
            # Add the parent actions
            actions_str = ", ".join(section_data['parent_actions'])
            if actions_str:
                content += f"Parent actions: {actions_str}"
                
        return content
    except Exception as e:
        logger.error(f"Error creating simplified section content: {str(e)}")
        return "Error processing section content"

def improve_text_quality(text_content):
    """
    Apply multiple text cleaning techniques to improve the quality of extracted text.
    Specialized for IEP documents.
    
    Args:
        text_content: The raw text content to clean
    
    Returns:
        Cleaned text with improved quality
    """
    try:
        # Step 1: Remove non-printable characters
        printable_text = re.sub(r'[^\x20-\x7E\n\r\t]', ' ', text_content)
        
        # Step 2: Remove PDF specific markers and commands
        pdf_cleaned = re.sub(r'(\d+ \d+ obj)|endobj|stream|endstream|xref|trailer|startxref|\%EOF', ' ', printable_text)
        
        # Step 3: Remove font definitions and other technical PDF content
        font_cleaned = re.sub(r'/Type\s*/[\w]+|/Font\s*<<.*?>>|/F\d+\s+\d+\s+\d+|/Length\s+\d+', ' ', pdf_cleaned)
        
        # Step 4: Remove PDF operators such as Tf, Tm, TD, etc.
        operators_cleaned = re.sub(r'\b[0-9.]+ [0-9.]+ [0-9.]+ [0-9.]+ [0-9.]+ [0-9.]+ Tm\b|\b[0-9.]+ [0-9.]+ TD\b|\b[0-9.]+ [0-9.]+ Td\b|\b/F\d+ [0-9.]+ Tf\b', ' ', font_cleaned)
        
        # Step 5: Normalize whitespace (collapse multiple spaces, line breaks)
        whitespace_normalized = re.sub(r'\s+', ' ', operators_cleaned).strip()
        
        # Step 6: Try to identify and extract sections that look like IEP content
        # Look for common IEP section headers
        iep_sections = []
        section_patterns = [
            r'((?:PRESENT|CURRENT)\s+LEVELS?\s+(?:OF|IN)?\s+(?:ACADEMIC\s+)?(?:ACHIEVEMENT|PERFORMANCE|FUNCTIONING).*?)(?=GOAL|OBJECTIVE|SERVICES|ACCOMMODATIONS|PLACEMENT|\Z)',
            r'(SPECIAL\s+EDUCATION\s+(?:AND\s+RELATED\s+)?SERVICES.*?)(?=GOAL|OBJECTIVE|ACCOMMODATIONS|PLACEMENT|\Z)',
            r'(MEASURABLE\s+(?:ANNUAL\s+)?GOALS?.*?)(?=SERVICES|ACCOMMODATIONS|PLACEMENT|\Z)',
            r'(ACCOMMODATIONS\s+(?:AND|OR)\s+MODIFICATIONS.*?)(?=SERVICES|GOAL|OBJECTIVE|PLACEMENT|\Z)',
            r'(EDUCATIONAL\s+PLACEMENT.*?)(?=SERVICES|GOAL|OBJECTIVE|ACCOMMODATIONS|\Z)',
            r'(ELIGIBILITY\s+(?:DETERMINATION|STATEMENT).*?)(?=PRESENT|CURRENT|SERVICES|GOAL|OBJECTIVE|ACCOMMODATIONS|PLACEMENT|\Z)',
            r'(PARENT(?:/GUARDIAN)?\s+(?:INVOLVEMENT|PARTICIPATION|CONSENT).*?)(?=PRESENT|CURRENT|SERVICES|GOAL|OBJECTIVE|ACCOMMODATIONS|PLACEMENT|\Z)'
        ]
        
        for pattern in section_patterns:
            matches = re.finditer(pattern, whitespace_normalized, re.IGNORECASE | re.DOTALL)
            for match in matches:
                if match.group(1) and len(match.group(1)) > 50:  # Only include substantial matches
                    iep_sections.append(match.group(1))
        
        # Step 7: Extract text blocks that look meaningful (more than 3 words together)
        text_blocks = re.findall(r'([A-Za-z,\.\(\)\-\'\"]+(?: [A-Za-z,\.\(\)\-\'\"]+){5,})', whitespace_normalized)
        
        # If we have IEP sections, prioritize those
        if iep_sections and len(iep_sections) >= 2:  # At least 2 sections to be meaningful
            logger.info(f"Found {len(iep_sections)} IEP sections")
            meaningful_text = '\n\n'.join(iep_sections)
            return meaningful_text
        
        # If we found meaningful text blocks, join them with line breaks
        if text_blocks and len(text_blocks) > 10:  # Only if we have a meaningful number of blocks
            # Filter blocks to focus on educational/IEP-related content
            iep_keywords = [
                'student', 'education', 'learning', 'goal', 'objective', 'service', 'accommodation', 
                'placement', 'assessment', 'evaluation', 'instruction', 'teacher', 'classroom', 
                'behavior', 'skill', 'level', 'performance', 'achievement', 'parent', 'meeting', 
                'eligibility', 'disability', 'program', 'support', 'curriculum', 'iep', 'school'
            ]
            
            # Prioritize blocks with IEP keywords
            scored_blocks = []
            for block in text_blocks:
                score = 0
                block_lower = block.lower()
                for keyword in iep_keywords:
                    if keyword in block_lower:
                        score += 1
                scored_blocks.append((block, score))
            
            # Sort by score (higher first) and keep only blocks with score > 0
            relevant_blocks = [block for block, score in sorted(scored_blocks, key=lambda x: x[1], reverse=True) if score > 0]
            
            # If we have relevant blocks, use those, otherwise use all blocks
            if relevant_blocks:
                logger.info(f"Found {len(relevant_blocks)} relevant text blocks out of {len(text_blocks)} total")
                meaningful_text = '\n\n'.join(relevant_blocks)
            else:
                logger.info(f"Using all {len(text_blocks)} text blocks (no IEP-specific content found)")
                meaningful_text = '\n\n'.join(text_blocks)
                
            # Check if we have enough content
            if len(meaningful_text) > 500:  # Arbitrary threshold for meaningful content
                return meaningful_text
        
        # If the above approaches don't yield good results, try a simpler cleaner
        # that focuses on removing obviously binary content
        simple_cleaned = clean_pdf_text(text_content)
        
        # Compare the results and return the better one
        if simple_cleaned and len(simple_cleaned) > len(whitespace_normalized) * 0.8:
            logger.info("Using simple cleaned text version")
            return simple_cleaned
        
        logger.info("Using enhanced cleaned text version")
        return whitespace_normalized
    except Exception as e:
        logger.error(f"Error in improve_text_quality: {str(e)}")
        # If all else fails, return the original
        return text_content

def extract_text_from_pdf(file_content):
    """Enhanced method to extract text from PDF using PyPDF2."""
    try:
        # Create a file-like object from the content
        pdf_file = io.BytesIO(file_content)
        
        # Initialize PdfReader
        pdf_reader = PdfReader(pdf_file)
        
        # Extract text from each page using multiple approaches
        full_text = ""
        
        # Method 1: Standard extraction
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            page_text = page.extract_text()
            if page_text and len(page_text.strip()) > 0:
                full_text += page_text + "\n\n"
                
        # If we got good text, return it
        if full_text and len(full_text.strip()) > 500:
            logger.info(f"Successfully extracted {len(full_text)} characters using standard extraction")
            return full_text
            
        # Method 2: Try extracting text from raw content streams
        # This can sometimes work better for PDFs with unusual formatting
        alternative_text = ""
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            
            # Access the page's content stream if possible
            try:
                if hasattr(page, '/Contents') and page['/Contents'] is not None:
                    content_stream = page['/Contents'].get_data()
                    # Extract text fragments using regex
                    text_fragments = re.findall(r'\((.*?)\)', content_stream.decode('utf-8', errors='replace'))
                    if text_fragments:
                        alternative_text += ' '.join(text_fragments) + "\n\n"
            except Exception as inner_e:
                logger.warning(f"Error extracting from content stream for page {page_num}: {str(inner_e)}")
                continue
        
        # If we got good alternative text, use it
        if alternative_text and len(alternative_text.strip()) > 500:
            logger.info(f"Successfully extracted {len(alternative_text)} characters using content stream extraction")
            return alternative_text
            
        # If we didn't get enough text from either method, combine both
        combined_text = full_text + "\n\n" + alternative_text
        if combined_text and len(combined_text.strip()) > 500:
            logger.info(f"Using combined extraction methods: {len(combined_text)} characters")
            return combined_text
            
        # If we still don't have enough text, log a warning and return what we have
        logger.warning("PDF extraction yielded limited text content")
        return combined_text if combined_text else "PDF text extraction failed to yield readable content."
        
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        traceback.print_exc()
        return "Error extracting text from PDF."

def parse_document_analysis(response):
    """
    Parse the JSON response from Claude to extract structured information.
    
    Args:
        response: Text response from Claude containing JSON
    
    Returns:
        dict: Structured document analysis
    """
    try:
        # Find JSON block in the response
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
        
        if json_match:
            # Extract JSON string
            json_str = json_match.group(1)
            # Parse the JSON
            result = json.loads(json_str)
            logger.info("Successfully parsed JSON from response")
            return result
        else:
            # Try to find any JSON-like structure
            potential_json = re.search(r'({[\s\S]*})', response)
            if potential_json:
                try:
                    # Try to parse what looks like JSON
                    result = json.loads(potential_json.group(1))
                    logger.info("Found and parsed JSON-like structure from response")
                    return result
                except json.JSONDecodeError:
                    logger.warning("Found potential JSON structure but failed to parse it")
                    pass
                
            logger.warning("No valid JSON found in response")
            
            # Create a basic structure with just the raw text
            return {
                'summary': "Failed to extract structured information from the document.",
                'sections': {
                    'document_content': {
                        'present': True,
                        'summary': "The document analysis could not be structured properly.",
                        'key_points': {},
                        'important_dates': [],
                        'parent_actions': [],
                        'location': "Throughout the document"
                    }
                }
            }
    
    except Exception as e:
        logger.error(f"Error parsing document analysis: {str(e)}")
        traceback.print_exc()
        
        # Return a minimal result structure
        return None

def extract_text_with_documentai(file_content):
    """
    Extract text from a document using Google Document AI.
    
    Args:
        file_content: Binary content of the document
        
    Returns:
        str: Extracted text from the document or None if extraction fails
    """
    try:
        documentai_client = get_documentai_client()
        if not documentai_client:
            logger.warning("DocumentAI client not available")
            return None
            
        # Process the document with Document AI
        logger.info("Processing document with Document AI")
        
        # Create a request to process the PDF
        request = {
            "raw_document": {
                "content": file_content,
                "mime_type": "application/pdf"
            }
        }
        
        # Call DocumentAI to process the document
        project_id = os.environ.get('DOCUMENT_AI_PROJECT_ID', '')
        location = os.environ.get('DOCUMENT_AI_LOCATION', 'us')
        processor_id = os.environ.get('DOCUMENT_AI_PROCESSOR_ID', '')
        
        if not project_id or not processor_id:
            logger.warning("DocumentAI configuration missing, skipping Document AI processing")
            return None
            
        name = f"projects/{project_id}/locations/{location}/processors/{processor_id}"
        response = documentai_client.process_document(request=request, name=name)
        
        # Extract the text from the response
        document = response.document
        if document and hasattr(document, 'text'):
            return document.text
        
        return None
    except Exception as e:
        logger.warning(f"Error extracting text with Document AI: {str(e)}")
        traceback.print_exc()
        return None 