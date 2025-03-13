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
        # Handle null or empty content
        if not document_content:
            logger.error("Empty document content provided")
            return {
                'success': False,
                'error': "Empty document content provided"
            }

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
                # First, ensure we have a valid summary to translate
                if not result.get('summary') or not isinstance(result.get('summary'), str) or len(result.get('summary', '').strip()) < 10:
                    logger.warning("Summary missing or too short - creating default summary for translation")
                    result['summary'] = "This document appears to be an Individualized Education Program (IEP). It contains information about the student's educational needs, goals, and services, but detailed content could not be extracted."
                
                # Track if we have any content to translate
                has_english_content = False
                
                # Ensure summaries structure exists
                if 'summaries' not in result:
                    result['summaries'] = {}
                    
                # Make sure English summary is stored in summaries
                if isinstance(result.get('summary'), str) and result.get('summary').strip():
                    result['summaries']['en'] = result['summary']
                    has_english_content = True
                    logger.info(f"Added English summary to summaries structure, length: {len(result['summary'])}")
                
                # Make sure sections has some content
                if 'sections' not in result or not result['sections'] or not isinstance(result['sections'], dict):
                    logger.warning("Sections missing or invalid - creating default sections structure")
                    result['sections'] = {
                        "Student Information": "Information not extracted from document",
                        "Present Levels of Performance": "Information not extracted from document",
                        "Services": "Information not extracted from document", 
                        "Goals": "Information not extracted from document",
                        "Accommodations": "Information not extracted from document"
                    }
                
                # Initialize language structure for sections if needed
                if not isinstance(result['sections'].get('en'), dict):
                    logger.info("Adding English sections structure")
                    # Copy sections directly to English section
                    result['sections']['en'] = {}
                    for section_name, section_content in result['sections'].items():
                        if section_name not in ['en', 'es', 'zh', 'vi'] and isinstance(section_content, str):
                            result['sections']['en'][section_name] = section_content
                            has_english_content = True
                
                if not has_english_content:
                    logger.warning("No valid English content found for translation")
                    return {
                        'success': True,
                        'result': result
                    }
                
                # Now translate summary if we have one
                logger.info("Translating summary")
                if result['summaries'].get('en'):
                    try:
                        # Log the beginning of summary translation with full debug info
                        logger.info(f"Starting summary translation with content length: {len(result['summaries']['en'])} for languages: {target_languages}")
                        logger.info(f"Summary content preview: {result['summaries']['en'][:100]}...")
                        
                        translated_summary = translate_content(
                            content=result['summaries']['en'],
                            target_languages=target_languages
                        )
                        
                        # Log detailed translation results
                        if isinstance(translated_summary, dict):
                            logger.info(f"Received translation result with keys: {list(translated_summary.keys())}")
                            
                            # Log each translation result separately
                            for lang, trans_text in translated_summary.items():
                                if lang == 'original':
                                    logger.info(f"Original text length: {len(trans_text) if isinstance(trans_text, str) else 'N/A'}")
                                elif trans_text and trans_text.strip():
                                    result['summaries'][lang] = trans_text
                                    logger.info(f"Added {lang} summary translation, length: {len(trans_text)}")
                                    logger.info(f"{lang} translation preview: {trans_text[:100]}...")
                                else:
                                    logger.warning(f"Translation for {lang} is empty or invalid: {type(trans_text)}")
                            
                            # Log what languages we have after translation
                            logger.info(f"Summaries after translation: {list(result['summaries'].keys())}")
                        else:
                            logger.warning(f"Unexpected translation result type: {type(translated_summary)}")
                            logger.warning(f"Translation result: {translated_summary}")
                    except Exception as e:
                        logger.error(f"Error translating summary: {str(e)}")
                        traceback.print_exc()
                        
                        # Try direct translations for each language if the bulk translation failed
                        for target_lang in target_languages:
                            try:
                                logger.info(f"Attempting direct translation for language: {target_lang}")
                                from translation import translate_text
                                
                                translated_text = translate_text(result['summaries']['en'], target_lang)
                                if translated_text and translated_text.strip():
                                    result['summaries'][target_lang] = translated_text
                                    logger.info(f"Added {target_lang} summary via direct translation, length: {len(translated_text)}")
                                    logger.info(f"Direct {target_lang} translation preview: {translated_text[:100]}...")
                                else:
                                    logger.warning(f"Direct translation for {target_lang} returned empty result")
                            except Exception as direct_e:
                                logger.error(f"Direct translation to {target_lang} also failed: {str(direct_e)}")
                else:
                    logger.warning("No English summary found to translate")
                
                # Translate sections
                logger.info("Translating sections")
                if result['sections'].get('en'):
                    try:
                        # Ensure each target language has a sections structure
                        for target_lang in target_languages:
                            if target_lang not in result['sections']:
                                result['sections'][target_lang] = {}
                            
                            # Process each English section
                            for section_name, section_content in result['sections']['en'].items():
                                if not isinstance(section_content, str) or not section_content.strip():
                                    continue  # Skip non-string or empty content
                                
                                try:
                                    translated_section = translate_content(
                                        content=section_content,
                                        target_languages=[target_lang]
                                    )
                                    
                                    if isinstance(translated_section, dict) and translated_section.get(target_lang):
                                        result['sections'][target_lang][section_name] = translated_section[target_lang]
                                        logger.info(f"Translated {section_name} to {target_lang}, length: {len(translated_section[target_lang])}")
                                except Exception as section_e:
                                    logger.error(f"Error translating section {section_name} to {target_lang}: {str(section_e)}")
                    except Exception as e:
                        logger.error(f"Error in sections translation: {str(e)}")
                        traceback.print_exc()
            except Exception as e:
                logger.error(f"Error during translation process: {str(e)}")
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

def process_single_chunk(chunk, chunk_index, total_chunks):
    """
    Process a single chunk of text using the LLM to extract important information.
    This is the MAP phase of the map-reduce pattern.
    
    Args:
        chunk: The raw text chunk to process
        chunk_index: The index of the current chunk
        total_chunks: The total number of chunks
        
    Returns:
        str: Processed text analysis from the LLM
    """
    try:
        # Validate chunk size
        if not chunk or len(chunk.strip()) < 200:  # Require reasonable amount of text
            logger.warning(f"Chunk {chunk_index}/{total_chunks} too small to analyze: {len(chunk) if chunk else 0} chars")
            return f"CHUNK {chunk_index} ANALYSIS:\nThis chunk contains insufficient text content to analyze (less than 200 characters)."
        
        logger.info(f"Processing chunk {chunk_index}/{total_chunks} of length {len(chunk)} characters")
        
        # Generate the prompt for chunk analysis using the function from config.py
        prompt = get_chunk_analysis_prompt(chunk, chunk_index, total_chunks)
        
        # Log prompt size for debugging
        logger.info(f"Generated analysis prompt of size: {len(prompt)} characters")
        
        # Call Claude 3.5 Sonnet to process the chunk
        response = invoke_claude_3_5(
            prompt=prompt,
            temperature=0,
            max_tokens=4000
        )
        
        # Validate response 
        if not response or len(response.strip()) < 50:
            logger.warning(f"Empty or very short response from LLM for chunk {chunk_index}: {len(response) if response else 0} chars")
            return f"CHUNK {chunk_index} ANALYSIS:\nThe analysis engine returned an empty or insufficient response for this chunk. Consider reprocessing the document."
        
        logger.info(f"Received response of length {len(response)} characters for chunk {chunk_index}/{total_chunks}")
        logger.info(f"Chunk {chunk_index}/{total_chunks} response preview: {response[:200].replace(chr(10), ' ')}...")
        
        # Check for specific error patterns in response
        if "I apologize" in response and ("cannot" in response or "unable to" in response):
            logger.warning(f"LLM indicated inability to process chunk {chunk_index}")
            return f"CHUNK {chunk_index} ANALYSIS:\nThe analysis engine reported difficulty processing this chunk. Original chunk preview: {chunk[:300]}...\n\nEngine response: {response[:500]}"
        
        logger.info(f"Chunk {chunk_index}/{total_chunks} processed successfully")
        return response
    except Exception as e:
        logger.error(f"Error processing chunk {chunk_index}/{total_chunks}: {str(e)}")
        traceback.print_exc()
        # Return a simple error message as the chunk result to avoid breaking the pipeline
        return f"Error processing chunk {chunk_index}/{total_chunks}: {str(e)}\n\nOriginal chunk content (partial):\n{chunk[:1000] if chunk else 'No content'}..."

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
        # Validate combined text analysis has meaningful content
        if not combined_text_analysis or len(combined_text_analysis.strip()) < 100:
            logger.warning(f"Combined text analysis too short or empty: {len(combined_text_analysis) if combined_text_analysis else 0} chars")
            # Return a basic structure if input is insufficient
            return {
                "summary": "The document analysis could not be completed due to insufficient text content.",
                "sections": {
                    "Student Information": "Insufficient document content for analysis",
                    "Present Levels of Performance": "Insufficient document content for analysis",
                    "Services": "Insufficient document content for analysis",
                    "Goals": "Insufficient document content for analysis",
                    "Accommodations": "Insufficient document content for analysis"
                }
            }

        # Log analysis size to help with debugging
        logger.info(f"Generating final JSON from combined text analysis: {len(combined_text_analysis)} characters")
        
        # Create the prompt for generating the structured JSON using the config function
        prompt = get_json_analysis_prompt(combined_text_analysis)
        
        # Call Claude 3.5 Sonnet to generate the structured JSON
        response = invoke_claude_3_5(
            prompt=prompt,
            temperature=0,
            max_tokens=8000
        )
        
        # Log the raw response size for debugging
        logger.info(f"Raw LLM response size: {len(response)} characters")
        logger.info(f"Raw LLM response preview: {response[:500]}...")
        
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
            logger.info(f"Retry: Raw LLM output length: {len(response)}")
            logger.info(f"Retry: Raw LLM output preview: {response[:500]}...")
            
            # Try to parse the JSON again
            result = parse_document_analysis(response)
        
        if result:
            logger.info(f"Successfully generated structured JSON from combined analysis")
            logger.info(f"Result structure keys: {list(result.keys())}")
            if 'sections' in result:
                logger.info(f"Sections keys: {list(result['sections'].keys())}")
        else:
            logger.warning("JSON parsing failed even after retry")
        
        # Basic validation to ensure the response has the expected format
        if not result or not result.get('summary') or not result.get('sections'):
            logger.warning("Generated JSON is missing required fields, adding defaults")
            if not result:
                result = {}
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
    """Transform the LLM output into a simpler structure that can be properly formatted by database.py
    
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
        
        logger.info(f"Transform_to_simplified_format called with languages: {languages}")
        logger.info(f"Input result type: {type(result)}")
        
        # Create a simpler structure that will be properly formatted by format_data_for_dynamodb
        simplified_result = {
            'summaries': {},
            'sections': {}
        }
        
        # Log current result keys for debugging
        logger.info(f"Transform input result keys: {list(result.keys() if isinstance(result, dict) else [])}")
        if 'summaries' in result:
            logger.info(f"Transform input summaries keys: {list(result['summaries'].keys() if isinstance(result['summaries'], dict) else [])}")
            if isinstance(result['summaries'], dict) and 'M' in result['summaries']:
                logger.info(f"Transform input summaries DynamoDB format keys: {list(result['summaries']['M'].keys())}")
        
        # Process summary and summaries
        # First check if we have translated summaries in the summaries structure
        if 'summaries' in result and isinstance(result['summaries'], dict):
            logger.info(f"Processing summaries structure with languages: {list(result['summaries'].keys())}")
            
            # Check if we have DynamoDB formatted summaries structure
            if 'M' in result['summaries']:
                logger.info(f"Found DynamoDB format summaries structure with keys: {list(result['summaries']['M'].keys())}")
                # Copy all language summaries from DynamoDB format
                for lang, summary_obj in result['summaries']['M'].items():
                    if isinstance(summary_obj, dict) and 'S' in summary_obj:
                        simplified_result['summaries'][lang] = summary_obj['S']
                        logger.info(f"Added {lang} summary from DynamoDB format, length: {len(summary_obj['S'])}")
                    else:
                        logger.warning(f"Unexpected format for {lang} summary: {type(summary_obj)}")
                        if isinstance(summary_obj, dict):
                            logger.warning(f"Keys in summary object: {list(summary_obj.keys())}")
            else:
                # Copy all language summaries to simplified structure
                for lang, summary_text in result['summaries'].items():
                    if isinstance(summary_text, str) and summary_text.strip():
                        simplified_result['summaries'][lang] = summary_text
                        logger.info(f"Added {lang} summary from summaries structure, length: {len(summary_text)}")
                    else:
                        logger.warning(f"Ignoring invalid {lang} summary of type: {type(summary_text)}")
        else:
            logger.warning(f"No valid summaries structure found, type: {type(result.get('summaries', None))}")
        
        # Also handle main summary if present (fallback)
        if 'summary' in result:
            summary = result.get('summary', '')
            logger.info(f"Processing main summary field, type: {type(summary)}")
            
            # Handle English summary
            if isinstance(summary, str) and summary.strip():
                # Single string summary (English only)
                if not simplified_result['summaries'].get('en'):
                    simplified_result['summaries']['en'] = summary
                    logger.info(f"Added English summary from main summary field, length: {len(summary)}")
            elif isinstance(summary, dict):
                # Summary with translations
                logger.info(f"Processing dictionary summary with keys: {list(summary.keys())}")
                for lang, content in summary.items():
                    if lang == 'original' and content.strip() and not simplified_result['summaries'].get('en'):
                        simplified_result['summaries']['en'] = content
                        logger.info(f"Added English summary from summary.original, length: {len(content)}")
                    elif content.strip() and lang != 'original':
                        simplified_result['summaries'][lang] = content
                        logger.info(f"Added {lang} summary from summary dict, length: {len(content)}")
        
        # Log sections structure
        if 'sections' in result:
            logger.info(f"Processing sections structure, type: {type(result['sections'])}")
            if isinstance(result['sections'], dict):
                if 'M' in result['sections']:
                    logger.info(f"Sections has DynamoDB format with keys: {list(result['sections']['M'].keys())}")
                    # Check inside each language key
                    for lang_key in result['sections']['M'].keys():
                        lang_data = result['sections']['M'][lang_key]
                        if isinstance(lang_data, dict) and 'M' in lang_data:
                            logger.info(f"Section language {lang_key} contains keys: {list(lang_data['M'].keys())}")
                else:
                    logger.info(f"Sections has direct keys: {list(result['sections'].keys())}")
        
        # Process sections - correctly organize by language first, then section name
        # This fixes the nested language issue
        logger.info("Processing sections by language...")
        for lang in languages:
            logger.info(f"Processing sections for language: {lang}")
            simplified_result['sections'][lang] = {}
            
            # First check if sections already has language-specific data
            if 'sections' in result and isinstance(result['sections'], dict):
                # Check for nested DynamoDB format
                if 'M' in result['sections']:
                    logger.info(f"Looking for {lang} in DynamoDB format sections")
                    # Look for language key in DynamoDB format
                    if lang in result['sections']['M']:
                        lang_sections = result['sections']['M'][lang]
                        logger.info(f"Found {lang} sections with type: {type(lang_sections)}")
                        
                        # Get the sections for this language
                        if isinstance(lang_sections, dict) and 'M' in lang_sections:
                            logger.info(f"Found {lang} in DynamoDB format with keys: {list(lang_sections['M'].keys())}")
                            # Check if the lang_sections has the nested language issue
                            if lang in lang_sections['M'] or 'en' in lang_sections['M']:
                                # Fix the nested language issue - take sections from the inner structure
                                logger.warning(f"Detected nested language issue in {lang} sections!")
                                inner_lang = lang if lang in lang_sections['M'] else 'en'
                                logger.info(f"Using inner language key: {inner_lang}")
                                inner_sections = lang_sections['M'][inner_lang]
                                
                                if isinstance(inner_sections, dict) and 'M' in inner_sections:
                                    logger.info(f"Inner sections contains keys: {list(inner_sections['M'].keys())}")
                                    for section_name, section_data in inner_sections['M'].items():
                                        if 'S' in section_data:
                                            simplified_result['sections'][lang][section_name] = section_data['S']
                                            logger.info(f"Fixed nested language issue: Added {lang}/{section_name} from {inner_lang} key")
                                else:
                                    logger.warning(f"Invalid inner sections format for {lang}/{inner_lang}: {type(inner_sections)}")
                            else:
                                # Normal case - sections directly under language
                                logger.info(f"Normal structure for {lang} sections")
                                for section_name, section_data in lang_sections['M'].items():
                                    if 'S' in section_data:
                                        simplified_result['sections'][lang][section_name] = section_data['S']
                                        logger.info(f"Added {lang} section {section_name} from DynamoDB format")
                        else:
                            logger.warning(f"Invalid format for {lang} sections: {type(lang_sections)}")
                
                elif lang in result['sections']:
                    # Direct language key in sections
                    logger.info(f"Found direct {lang} key in sections")
                    lang_sections = result['sections'][lang]
                    if isinstance(lang_sections, dict):
                        logger.info(f"Direct {lang} sections contains keys: {list(lang_sections.keys())}")
                        for section_name, section_content in lang_sections.items():
                            if isinstance(section_content, str) and section_content.strip():
                                simplified_result['sections'][lang][section_name] = section_content
                                logger.info(f"Added {lang} section {section_name}, length: {len(section_content)}")
                
                # Special case for English - also check direct sections
                if lang == 'en' and len(simplified_result['sections']['en']) == 0:
                    logger.info("Checking for direct sections for English")
                    direct_section_count = 0
                    for section_name, section_content in result['sections'].items():
                        if section_name not in languages and isinstance(section_content, str) and section_content.strip():
                            simplified_result['sections']['en'][section_name] = section_content
                            logger.info(f"Added English section {section_name} from direct sections, length: {len(section_content)}")
                            direct_section_count += 1
                    logger.info(f"Added {direct_section_count} direct sections to English")
        
        # Log the simplified structure for debugging
        logger.info(f"Created simplified structure with summaries languages: {list(simplified_result['summaries'].keys())}")
        logger.info(f"Created simplified structure with sections languages: {list(simplified_result['sections'].keys())}")
        
        # Log detailed structure to debug
        logger.info(f"Final summaries structure: {json.dumps(simplified_result['summaries'], default=str)}")
        logger.info(f"Sample sections content: " + 
                   ", ".join([f"{lang}: {list(sections.keys())[:2]}..." 
                             for lang, sections in simplified_result['sections'].items()]))
        
        # Let format_data_for_dynamodb handle the DynamoDB formatting
        logger.info("Formatting result for DynamoDB...")
        formatted_result = format_data_for_dynamodb(simplified_result)
        
        # Log the formatted structure to help with debugging
        if isinstance(formatted_result, dict) and 'M' in formatted_result:
            if 'summaries' in formatted_result['M']:
                logger.info(f"Final formatted structure has summaries: {list(formatted_result['M']['summaries'].get('M', {}).keys())}")
            if 'sections' in formatted_result['M']:
                logger.info(f"Final formatted structure has sections: {list(formatted_result['M']['sections'].get('M', {}).keys())}")
                for lang in formatted_result['M']['sections'].get('M', {}).keys():
                    logger.info(f"Final formatted section for {lang} has keys: {list(formatted_result['M']['sections']['M'][lang].get('M', {}).keys())}")
        
        return formatted_result
        
    except Exception as e:
        logger.error(f"Error transforming to simplified format: {str(e)}")
        traceback.print_exc()
        
        # Create a minimal structure as fallback
        minimal_result = {
            'summaries': {'en': 'Error processing document'},
            'sections': {'en': {'Error': 'Failed to process document'}}
        }
        
        try:
            return format_data_for_dynamodb(minimal_result)
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
        if not response or len(response.strip()) < 50:
            logger.warning(f"Response too short to contain valid JSON: {len(response) if response else 0} chars")
            return None
        
        # Log response characteristics for debugging
        logger.info(f"Parsing JSON from response of length: {len(response)}")
        response_preview = response[:100].replace('\n', ' ')
        logger.info(f"Response starts with: {response_preview}...")
        
        # First try: Find code block with JSON
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
        
        if json_match:
            # Extract JSON string from code block
            json_str = json_match.group(1)
            logger.info(f"Found JSON in code block, length: {len(json_str)}")
            
            try:
                # Parse the JSON
                result = json.loads(json_str)
                logger.info("Successfully parsed JSON from code block")
                return result
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse error from code block: {str(e)}")
                # Fall through to other methods
        
        # Second try: Find any JSON-like structure with braces
        potential_json = re.search(r'({[\s\S]*})', response)
        if potential_json:
            json_str = potential_json.group(1)
            logger.info(f"Found potential JSON structure, length: {len(json_str)}")
            
            try:
                # Try to parse what looks like JSON
                result = json.loads(json_str)
                logger.info("Successfully parsed JSON-like structure from response")
                return result
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse error from brace structure: {str(e)}")
                # Continue to next method
        
        # Third try: Look for JSON structure with double quotes (more strict pattern)
        strict_json = re.search(r'({(?:"[^"]*"\s*:\s*(?:"[^"]*"|{[^}]*}|\[[^\]]*\]|true|false|null|\d+)(?:\s*,\s*)?)+\s*})', response)
        if strict_json:
            json_str = strict_json.group(1)
            logger.info(f"Found strict JSON pattern, length: {len(json_str)}")
            
            try:
                # Try to parse with strict pattern
                result = json.loads(json_str)
                logger.info("Successfully parsed JSON with strict pattern")
                return result
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse error with strict pattern: {str(e)}")
                # Continue to fallback
        
        # Fourth try: Most aggressive - try cleaning up the response
        try:
            # Remove extra text, keep just what might be JSON
            cleaned = re.sub(r'[^{}[\]"\'0-9:,.\-+eE\s]', '', response)
            # Replace single quotes with double quotes for JSON compatibility
            cleaned = cleaned.replace("'", '"')
            # Fix common JSON issues
            cleaned = re.sub(r'"\s*:\s*([^"][^,}]*?)([,}])', r'":"\1"\2', cleaned)
            
            # Find anything that looks like a JSON object
            final_match = re.search(r'({.*})', cleaned)
            if final_match:
                final_json = final_match.group(1)
                result = json.loads(final_json)
                logger.info("Successfully parsed JSON after aggressive cleaning")
                return result
        except Exception as cleaning_error:
            logger.warning(f"Failed aggressive JSON extraction: {str(cleaning_error)}")
                
        logger.warning("All JSON extraction methods failed")
        
        # Create a basic structure with just the raw text when all parsing fails
        return {
            'summary': "The document could not be analyzed properly. Please try again or upload a clearer document.",
            'sections': {
                'Student Information': "Unable to extract information from document",
                'Present Levels of Performance': "Unable to extract information from document",
                'Services': "Unable to extract information from document", 
                'Goals': "Unable to extract information from document",
                'Accommodations': "Unable to extract information from document"
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