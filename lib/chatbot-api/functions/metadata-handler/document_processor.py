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
from database import format_data_for_dynamodb
import time
import uuid
from datetime import datetime
import tiktoken
from botocore.exceptions import ClientError
import logging
from itertools import groupby
import base64

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Boto3 clients
bedrock_runtime = boto3.client('bedrock-runtime')

# Configure models
ANTHROPIC_MODEL = os.environ.get('ANTHROPIC_MODEL', 'anthropic.claude-3-5-sonnet-20240620-v1:0')

# Constants for chunk processing
MAX_TOKENS_PER_CHUNK = 50000  # Updated to 50,000 tokens as requested

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
            # If content is a string, try to convert to bytes if it could be base64 encoded
            logger.info("Content is not binary, checking if it could be base64 encoded")
            try:
                # Try to convert to bytes if it's a base64 string
                decoded_content = base64.b64decode(document_content)
                logger.info("Successfully decoded base64 content to bytes")
                return summarize_and_analyze_document(decoded_content, user_profile)
            except Exception as e:
                logger.info(f"Not base64 encoded or conversion failed: {str(e)}")
                # If it's already text, just use it
                text_content = document_content
        
        logger.info(f"Document word count: {len(text_content.split())} words")
        logger.info(f"Document token count: {get_token_count(text_content)}")
        
        # Process document in chunks
        raw_chunks = process_document_in_chunks(text_content)
        
        # MAP phase: Process each chunk individually
        logger.info(f"Starting MAP phase - processing {len(raw_chunks)} chunks individually")
        processed_chunks = []
        for i, chunk in enumerate(raw_chunks):
            logger.info(f"Processing chunk {i+1}/{len(raw_chunks)} with LLM")
            processed_chunk = process_single_chunk(chunk, i+1, len(raw_chunks))
            processed_chunks.append(processed_chunk)
            logger.info(f"Completed processing chunk {i+1}/{len(raw_chunks)}")
        
        # Combine results from all chunks
        combined_result = combine_chunk_results(processed_chunks)
        
        # REDUCE phase: Generate final JSON analysis from combined processed chunks
        logger.info("Starting REDUCE phase - generating final analysis from combined chunk results")
        result = generate_final_json_analysis(combined_result)
        
        # Transform to simplified format for DynamoDB
        result = transform_to_simplified_format(result)
        
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
        
        # Translate content if needed
        if target_languages:
            logger.info("Starting translation process")
            try:
                # Translate the summary if it exists
                if 'summary' in result:
                    summary = result.get('summary', '')
                    if isinstance(summary, str):
                        # Single string summary (English only)
                        translated_summary = translate_content(
                            content=summary,
                            target_languages=target_languages
                        )
                        if isinstance(translated_summary, dict):
                            # Store translated summaries directly in DynamoDB format
                            for lang, trans_text in translated_summary.items():
                                if lang != 'original':  # Skip the original English text
                                    result['summaries']['M'][lang] = {'S': trans_text}
                
                # Translate the structured sections data
                if 'sections' in result and 'M' in result['sections']:
                    try:
                        # Get English sections
                        en_sections = result['sections']['M'].get('en', {}).get('M', {})
                        
                        # Process each language
                        for target_lang in target_languages:
                            # Initialize target language structure if not exists
                            if target_lang not in result['sections']['M']:
                                result['sections']['M'][target_lang] = {'M': {}}
                            
                            # Process each section
                            for section_name, section_data in en_sections.items():
                                # Get English content
                                en_content = section_data.get('M', {}).get('S', {}).get('S', '')
                                
                                if en_content:
                                    # Translate the section content
                                    translated_content = translate_content(
                                        content=en_content,
                                        target_languages=[target_lang]
                                    )
                                    
                                    # Add translated content to result
                                    if isinstance(translated_content, dict) and target_lang in translated_content:
                                        result['sections']['M'][target_lang]['M'][section_name] = {
                                            'M': {
                                                'S': {
                                                    'S': translated_content[target_lang]
                                                }
                                            }
                                        }
                    except Exception as e:
                        logger.error(f"Error translating sections: {str(e)}")
                        traceback.print_exc()
            except Exception as e:
                logger.error(f"Error during translation: {str(e)}")
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
    Split a document into manageable chunks based on token size.
    This function now ONLY divides text into chunks without processing them.
    
    Args:
        text_content: The full text content to be processed
    
    Returns:
        A list of raw text chunks
    """
    # Calculate approximate token count
    token_count = get_token_count(text_content)
    logger.info(f"Processing document with {token_count} tokens in chunks")
    
    # If document is smaller than max chunk size, just use it as a single chunk
    if token_count <= MAX_TOKENS_PER_CHUNK:
        logger.info(f"Document fits in a single chunk")
        return [text_content]
    
    # For larger documents, split by paragraphs to create better chunk boundaries
    paragraphs = text_content.split('\n\n')
    chunks = []
    current_chunk = ""
    current_tokens = 0
    
    logger.info(f"Splitting document into chunks with approximately {MAX_TOKENS_PER_CHUNK} tokens each")
    
    for para in paragraphs:
        # Skip empty paragraphs
        if not para.strip():
            continue
            
        para_tokens = get_token_count(para)
        
        # If adding this paragraph would exceed the chunk size, finish current chunk
        if current_tokens > 0 and current_tokens + para_tokens > MAX_TOKENS_PER_CHUNK:
            chunks.append(current_chunk)
            current_chunk = para
            current_tokens = para_tokens
        else:
            # Otherwise, add to current chunk
            if current_chunk:
                current_chunk += "\n\n"
            current_chunk += para
            current_tokens += para_tokens
    
    # Add the last chunk
    if current_chunk:
        chunks.append(current_chunk)
    
    # Ensure we have at least one chunk
    if not chunks:
        logger.warning("No valid chunks created, using full text as a single chunk")
        chunks.append(text_content)
    
    logger.info(f"Created {len(chunks)} chunks for processing")
    return chunks

def process_single_chunk(chunk_text, chunk_index, total_chunks):
    """
    Process a single chunk of text using the LLM to extract important information.
    This is the MAP phase of the map-reduce pattern.
    
    Args:
        chunk_text: The raw text chunk to process
        chunk_index: The index of the current chunk
        total_chunks: The total number of chunks
        
    Returns:
        str: Processed text analysis from the LLM
    """
    try:
        # Generate the prompt for chunk analysis using the function from config.py
        prompt = get_chunk_analysis_prompt(chunk_text, chunk_index, total_chunks)
        
        # Call Claude 3.5 Sonnet to process the chunk
        response = invoke_claude_3_5(
            prompt=prompt,
            temperature=0,
            max_tokens=4000
        )
        
        logger.info(f"Chunk {chunk_index}/{total_chunks} processed successfully")
        return response
    except Exception as e:
        logger.error(f"Error processing chunk {chunk_index}/{total_chunks}: {str(e)}")
        traceback.print_exc()
        # Return a simple error message as the chunk result to avoid breaking the pipeline
        return f"Error processing chunk {chunk_index}/{total_chunks}: {str(e)}\n\nOriginal chunk content (partial):\n{chunk_text[:1000]}..."

def combine_chunk_results(processed_chunks):
    """
    Combine processed text analyses from multiple chunks into a single text.
    
    Args:
        processed_chunks (list): List of processed text analyses from each chunk
        
    Returns:
        str: Combined text analysis
    """
    logger.info(f"Combining {len(processed_chunks)} processed chunk analyses")
    
    # Add separators between chunk analyses for clarity
    combined_text = ""
    
    for i, chunk in enumerate(processed_chunks):
        combined_text += f"\n\n--- CHUNK {i+1} ANALYSIS ---\n\n"
        combined_text += chunk
    
    logger.info(f"Combined processed text analysis length: {len(combined_text)}")
    logger.info(f"Combined text analysis preview: {combined_text[:500]}...")
    
    return combined_text

def generate_final_json_analysis(combined_text_analysis):
    """
    Convert the combined text analysis into structured JSON format.
    This is the REDUCE phase of our map-reduce pattern.
    
    Args:
        combined_text_analysis (str): Combined processed text analysis from all chunks
        
    Returns:
        dict: Structured document analysis in a simplified format
    """
    try:
        # Create the prompt for generating the structured JSON using the config function
        prompt = get_json_analysis_prompt(combined_text_analysis)
        
        # Call Claude 3.5 Sonnet to generate the structured JSON
        response = invoke_claude_3_5(
            prompt=prompt,
            temperature=0,
            max_tokens=8000
        )
        
        # Parse the response to get JSON
        result = parse_document_analysis(response)
        
        if not result:
            logger.warning("Failed to parse JSON from final analysis")
            
            # Retry with the same prompt
            logger.info("Retrying with the same prompt")
            
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
        
        logger.info(f"Successfully generated structured JSON from combined analysis")
        
        # Basic validation to ensure the response has the expected format
        if not result.get('summary') or not result.get('sections'):
            logger.warning("Generated JSON is missing required fields, adding defaults")
            if not result.get('summary'):
                result['summary'] = "No summary was generated from the document analysis."
            
            if not result.get('sections'):
                result['sections'] = {
                    "Student Information": "Not specified",
                    "Present Levels of Performance": "Not specified",
                    "Services": "Not specified",
                    "Goals": "Not specified",
                    "Accommodations": "Not specified"
                }
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating final JSON analysis: {str(e)}")
        traceback.print_exc()
        
        # Return a basic structure if everything fails
        return {
            "summary": "Error generating document analysis. Please try again.",
            "sections": {
                "Student Information": "Error processing document",
                "Present Levels of Performance": "Error processing document",
                "Services": "Error processing document",
                "Goals": "Error processing document",
                "Accommodations": "Error processing document"
            }
        }

def transform_to_simplified_format(result, target_languages=None):
    """Transform the simplified format to the DynamoDB format structure
    
    Args:
        result: The result to transform from the LLM output
        target_languages: List of language codes to include (defaults to ['en'] if None)
    """
    try:
        # Set default languages if none provided
        languages = target_languages if target_languages else ['en']
        
        # Always include English if not already in the languages list
        if 'en' not in languages:
            languages = ['en'] + languages
        
        # Create the base DynamoDB structure
        dynamodb_result = {
            'summaries': {
                'M': {}
            },
            'sections': {
                'M': {}
            }
        }
        
        # Process summary first
        if 'summary' in result:
            summary = result.get('summary', '')
            
            # Handle English summary
            if isinstance(summary, str):
                # Single string summary (English only)
                dynamodb_result['summaries']['M']['en'] = {'S': summary}
            elif isinstance(summary, dict):
                # Summary with translations
                for lang, content in summary.items():
                    if lang == 'original':
                        dynamodb_result['summaries']['M']['en'] = {'S': content}
                    else:
                        dynamodb_result['summaries']['M'][lang] = {'S': content}
        
        # Process each language for sections
        for lang in languages:
            # Initialize section structure for this language - correct nesting here
            if lang not in dynamodb_result['sections']['M']:
                dynamodb_result['sections']['M'][lang] = {'M': {}}
            
            # Get sections from the result (simplified structure from LLM)
            if 'sections' in result and isinstance(result['sections'], dict):
                # For English (primary language)
                if lang == 'en':
                    for section_name, section_content in result['sections'].items():
                        if isinstance(section_content, str):
                            # Add section with correct nesting (avoid duplicate 'M' keys)
                            dynamodb_result['sections']['M']['en']['M'][section_name] = {
                                'M': {
                                    'S': {
                                        'S': section_content
                                    }
                                }
                            }
        
        # Log the structure to help with debugging
        logger.info(f"Created DynamoDB format with sections for English: {json.dumps(dynamodb_result)[:200]}...")
        
        return dynamodb_result
        
    except Exception as e:
        logger.error(f"Error transforming to DynamoDB format: {str(e)}")
        traceback.print_exc()
        
        # Attempt a basic transformation as a fallback
        try:
            return format_data_for_dynamodb(result)
        except Exception as fallback_error:
            logger.error(f"Fallback formatting also failed: {str(fallback_error)}")
            return result

def extract_text_from_pdf(file_content):
    """Enhanced method to extract text from PDF using PyPDF2."""
    try:
        # Ensure file_content is bytes
        if isinstance(file_content, str):
            logger.info("Converting string content to bytes for PDF extraction")
            try:
                # Try to decode as base64 first
                file_content = base64.b64decode(file_content)
                logger.info("Successfully decoded base64 string to bytes")
            except Exception as e:
                logger.warning(f"Failed to decode as base64, treating as UTF-8: {str(e)}")
                # If not base64, try to encode as UTF-8
                file_content = file_content.encode('utf-8')
        
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
        # Ensure file_content is bytes
        if isinstance(file_content, str):
            logger.info("Converting string content to bytes for Document AI")
            try:
                # Try to decode as base64 first
                file_content = base64.b64decode(file_content)
                logger.info("Successfully decoded base64 string to bytes for Document AI")
            except Exception as e:
                logger.warning(f"Failed to decode as base64 for Document AI, treating as UTF-8: {str(e)}")
                # If not base64, try to encode as UTF-8
                file_content = file_content.encode('utf-8')
        
        documentai_client = get_documentai_client()
        if not documentai_client:
            logger.warning("DocumentAI client not available")
            return None
            
        # Process the document with Document AI
        logger.info("Processing document with Document AI")
        
        # Get project and processor information from environment
        project_id = os.environ.get('DOCUMENT_AI_PROJECT_ID', '')
        location = os.environ.get('DOCUMENT_AI_LOCATION', 'us-central1')  # Default to us-central1
        processor_id = os.environ.get('DOCUMENT_AI_PROCESSOR_ID', '')
        
        if not project_id or not processor_id:
            logger.warning("DocumentAI configuration missing, skipping Document AI processing")
            return None
        
        # Format the processor name correctly
        name = f"projects/{project_id}/locations/{location}/processors/{processor_id}"
        
        # Create a request to process the PDF - correct structure according to latest API
        request = {
            "name": name,
            "raw_document": {
                "content": base64.b64encode(file_content).decode('utf-8'),  # Base64 encode the content
                "mime_type": "application/pdf"
            }
        }
        
        # Call DocumentAI with correct parameters - only pass request parameter
        response = documentai_client.process_document(request=request)
        
        # Extract the text from the response
        document = response.document
        if document and hasattr(document, 'text'):
            return document.text
        
        return None
    except Exception as e:
        logger.warning(f"Error extracting text with Document AI: {str(e)}")
        traceback.print_exc()
        return None 