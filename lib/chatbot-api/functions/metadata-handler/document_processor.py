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
    get_document_analysis_prompt,
    get_chunk_analysis_prompt,
    get_final_json_analysis_prompt,
    get_simplified_json_analysis_prompt,
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
        # Convert binary content to text if needed
        if isinstance(document_content, bytes):
            text_content = document_content.decode('utf-8', errors='replace')
        else:
            text_content = document_content
        
        logger.info(f"Document word count: {len(text_content.split())} words")
        logger.info(f"Document token count: {get_token_count(text_content)}")
        
        # Check if the document is too large to process in one chunk
        token_count = get_token_count(text_content)
        
        # Define target languages for translation based on user profile
        target_languages = []
        if user_profile and 'languages' in user_profile:
            target_languages = user_profile.get('languages', [])
            if 'en' in target_languages:  # Remove English from target languages as it's the source
                target_languages.remove('en')
        
        # If we have more tokens than can fit in a single chunk, process in chunks
        if token_count > MAX_TOKENS_PER_CHUNK:
            logger.info(f"Document is too large for single processing, using chunked approach.")
            # Process document in chunks
            chunk_results = process_document_in_chunks(text_content)
            
            # Log diagnostic info about the chunked processing
            logger.info(f"Processed document in {len(chunk_results)} chunks.")
            
            # Combine the results from all chunks
            combined_text_analysis = combine_chunk_results(chunk_results)
            
            # Generate the final structured JSON analysis
            result = generate_final_json_analysis(combined_text_analysis)
        else:
            # For smaller documents, process in a single call
            logger.info("Document is small enough for single processing.")
            # Process the entire document
            result = process_full_document(text_content)
        
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
            if current_chunk_tokens + section_tokens > MAX_TOKENS_PER_CHUNK:
                # If current chunk is not empty, add it to chunks
                if current_chunk and len(current_chunk) > MIN_CHUNK_SIZE:
                    chunks.append(current_chunk)
                
                # Start a new chunk with this section
                current_chunk = section_text
                current_chunk_tokens = section_tokens
            else:
                # Add this section to the current chunk
                current_chunk += section_text
                current_chunk_tokens += section_tokens
        
        # Add the last chunk if not empty
        if current_chunk and len(current_chunk) > MIN_CHUNK_SIZE:
            chunks.append(current_chunk)
    else:
        # No clear section boundaries, use character-based splitting
        logger.info(f"No clear sections found, splitting document by character length")
        
        # Create fewer chunks with more content in each
        chars_per_chunk = max(chars_per_chunk, len(text_to_process) // target_chunk_count)
        
        # Create chunks with overlap
        for i in range(0, len(text_to_process), chars_per_chunk):
            # If this is not the first chunk, add some overlap with previous chunk
            start_idx = max(0, i - 2000) if i > 0 else 0  # Increase overlap to 2000 chars
            
            # If this is not the last chunk, continue to a reasonable break point
            end_idx = min(i + chars_per_chunk, len(text_to_process))
            if end_idx < len(text_to_process):
                # Find the next paragraph break if possible
                next_break = text_to_process.find('\n\n', end_idx)
                if next_break != -1 and next_break < end_idx + 3000:  # Look further for break points
                    end_idx = next_break
            
            chunk = text_to_process[start_idx:end_idx]
            if len(chunk) > MIN_CHUNK_SIZE:  # Only add chunks with sufficient content
                chunks.append(chunk)
    
    # Ensure we don't have too many chunks - combine small chunks if needed
    if len(chunks) > target_chunk_count * 2:
        logger.info(f"Too many chunks ({len(chunks)}), consolidating...")
        consolidated_chunks = []
        current_chunk = ""
        current_chunk_tokens = 0
        
        for chunk in chunks:
            chunk_tokens = get_token_count(chunk)
            if current_chunk_tokens + chunk_tokens > MAX_TOKENS_PER_CHUNK:
                if current_chunk:
                    consolidated_chunks.append(current_chunk)
                current_chunk = chunk
                current_chunk_tokens = chunk_tokens
            else:
                current_chunk += "\n\n" + chunk
                current_chunk_tokens += chunk_tokens
        
        if current_chunk:
            consolidated_chunks.append(current_chunk)
        
        chunks = consolidated_chunks
    
    logger.info(f"Split document into {len(chunks)} chunks for processing")
    
    # Process each chunk
    results = []
    previous_context = None
    
    for i, chunk in enumerate(chunks):
        logger.info(f"Processing chunk {i+1}/{len(chunks)} with {get_token_count(chunk)} tokens")
        
        # Determine if we need to add context from previous chunk
        context = previous_context if i > 0 else None
        
        # Process this chunk
        try:
            result_text = process_chunk_with_context(chunk, i+1, len(chunks), context)
            
            # Update context for next chunk
            previous_context = {
                'chunk_number': i+1,
                'content_preview': chunk[-1500:] if len(chunk) > 1500 else chunk  # Increased preview size
            }
            
            # Add result to the list
            results.append(result_text)
            
            logger.info(f"Chunk {i+1} processed successfully")
        except Exception as e:
            logger.error(f"Error processing chunk {i+1}: {str(e)}")
            traceback.print_exc()
            # Add empty result for this chunk
            results.append("")
    
    return results

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

def process_full_document(text_content):
    """
    Process a document in a single LLM call for smaller documents.
    
    Args:
        text_content: The document text content
    
    Returns:
        Structured document analysis with summary and sections
    """
    logger.info("Processing entire document in a single call")
    
    try:
        # Create the prompt for the full document using the imported function
        prompt = get_document_analysis_prompt(text_content)
        
        # Call the Claude model for analysis using Claude 3.5 Sonnet
        response = invoke_claude_3_5(
            prompt=prompt,
            temperature=0,
            max_tokens=8000
        )
        
        # Parse the response to get structured information
        result = parse_document_analysis(response)
        
        # Ensure we have a valid result structure
        if not result:
            result = {
                'summary': "The document could not be analyzed properly.",
                'sections': {}
            }
        
        return result
    except Exception as e:
        logger.error(f"Error in full document processing: {str(e)}")
        traceback.print_exc()
        
        # Return a minimal result structure
        return {
            'summary': "An error occurred while analyzing the document.",
            'sections': {}
        }

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

def generate_final_json_analysis(combined_text_analysis):
    """
    Convert the combined text analysis into structured JSON format.
    
    Args:
        combined_text_analysis (str): Combined text analysis from all chunks
        
    Returns:
        dict: Structured document analysis
    """
    try:
        # Create the prompt for generating the final structured JSON using the imported function
        prompt = get_final_json_analysis_prompt(combined_text_analysis)
        
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
            
            # Retry with a simplified prompt from config.py
            logger.info("Retrying with simplified prompt")
            
            # Use the simplified prompt from config.py
            prompt = get_simplified_json_analysis_prompt(combined_text_analysis)
            
            # Try Claude 3.7 Sonnet for better handling of complex JSON 
            response = invoke_claude_3_5(
                prompt=prompt,
                temperature=0,
                max_tokens=8000
            )
            
            # Log the output for debugging
            logger.info(f"Raw text analysis output length: {len(response)}")
            logger.info(f"Raw text analysis preview: {response[:500]}...")
            
            return response
        
        logger.info(f"Successfully generated structured JSON from combined analysis")
        return result
        
    except Exception as e:
        logger.error(f"Error generating final JSON analysis: {str(e)}")
        traceback.print_exc()
        return None

def extract_text_from_pdf(file_content):
    """Fallback method to extract text from PDF using PyPDF2."""
    try:
        # Create a file-like object from the content
        pdf_file = io.BytesIO(file_content)
        
        # Initialize PdfReader
        pdf_reader = PdfReader(pdf_file)
        
        # Extract text from each page
        full_text = ""
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            full_text += page.extract_text() + "\n\n"
        
        return full_text
    except Exception as e:
        print(f"Error extracting text from PDF: {str(e)}")
        traceback.print_exc()
        return None

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