import os
import json
import boto3
import traceback
import re
from translation import translate_content
from PyPDF2 import PdfReader
import io
from google_auth import get_documentai_client
from config import get_full_prompt, CHUNK_ANALYSIS_SYSTEM_MSG, SUMMARY_SYSTEM_MSG, get_chunk_system_message, get_unified_summary_prompt

def summarize_and_categorize(content_text):
    """
    Extract summary and sections from document content using Claude.
    Processes long documents in chunks to capture all content.
    
    Args:
        content_text (str): The text content from the document
        
    Returns:
        dict: Contains summary and sections
    """
    # Update to Claude 3.5 Sonnet for better performance
    model_id = 'anthropic.claude-3-5-sonnet-20240620-v1:0'
    
    # Ensure content is valid
    if not content_text or not content_text.strip():
        print("Empty document content, cannot summarize")
        return {
            'summary': '',
            'sections': []
        }
    
    # Set chunk size and overlap for context preservation
    chunk_size = 60000  # Slightly smaller to account for prompt and instructions
    overlap = 2000  # Overlap between chunks to maintain context
    
    # For very short documents, just process directly
    if len(content_text) <= chunk_size:
        return process_single_chunk(content_text, model_id)
    
    # For longer documents, break into chunks with overlap
    print(f"Document is {len(content_text)} characters, processing in chunks")
    
    # Split the document into overlapping chunks
    chunks = []
    position = 0
    while position < len(content_text):
        end = min(position + chunk_size, len(content_text))
        # If this isn't the first chunk, include overlap
        if position > 0:
            position = position - overlap
        chunks.append(content_text[position:end])
        position = end
    
    print(f"Split document into {len(chunks)} chunks for processing")
    
    # Process each chunk to extract sections and content
    chunk_results = []
    for i, chunk in enumerate(chunks):
        print(f"Processing chunk {i+1}/{len(chunks)}")
        # Include context information in the prompt
        chunk_context = f"CHUNK {i+1}/{len(chunks)}"
        result = process_chunk_with_context(chunk, chunk_context, model_id, i, len(chunks))
        chunk_results.append(result)
    
    # Combine results from all chunks
    combined_result = combine_chunk_results(chunk_results)
    
    # Generate a final unified summary
    unified_summary = generate_unified_summary(combined_result, model_id)
    combined_result['summary'] = unified_summary
    
    return combined_result

def process_chunk_with_context(chunk_text, chunk_context, model_id, chunk_index, total_chunks):
    """Process a single chunk of the document with context information."""
    try:
        # Create contextual key for the prompt
        key = f"IEP Document {chunk_context}"
        
        # Get the system message based on chunk position
        system_message = get_chunk_system_message(chunk_index, total_chunks)
        
        # Add chunk-specific instructions
        if chunk_index == 0:
            chunk_instruction = f"IMPORTANT: This is part {chunk_index+1} of {total_chunks} of a longer document. Focus on the beginning sections."
        elif chunk_index == total_chunks - 1:
            chunk_instruction = f"IMPORTANT: This is part {chunk_index+1} of {total_chunks} of a longer document. Focus on the ending sections."
        else:
            chunk_instruction = f"IMPORTANT: This is part {chunk_index+1} of {total_chunks} of a longer document. Focus on the middle sections."
        
        # Prepend the chunk instruction to the document content
        prefixed_chunk = f"{chunk_instruction}\n\n{chunk_text}"
        
        # Get the prompt from config.py
        prompt = get_full_prompt(key, prefixed_chunk)
        
        # Call Claude for this chunk
        bedrock_runtime = boto3.client('bedrock-runtime')
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 4000,
                'temperature': 0.1,
                'system': system_message,
                'messages': [
                    {'role': 'user', 'content': prompt}
                ]
            })
        )
        
        # Parse the response
        response_body = json.loads(response['body'].read().decode('utf-8'))
        
        # Extract the content
        content = ''
        if 'content' in response_body:
            if isinstance(response_body['content'], list):
                for block in response_body['content']:
                    if 'text' in block:
                        content += block['text']
            else:
                content = response_body['content']
        elif 'completion' in response_body:
            content = response_body['completion']
            
        # Extract JSON from the content
        json_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
        json_match = re.search(json_pattern, content)
        
        if json_match:
            try:
                chunk_result = json.loads(json_match.group(1))
                return chunk_result
            except json.JSONDecodeError:
                print(f"Failed to parse JSON from chunk {chunk_index+1}")
        
        # If no valid JSON match is found, try parsing the entire content as JSON
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            print(f"Failed to parse entire content as JSON from chunk {chunk_index+1}")
            
            # Final fallback - look for any JSON object in the content
            json_pattern = r'\{[\s\S]*\}'
            json_match = re.search(json_pattern, content)
            if json_match:
                try:
                    return json.loads(json_match.group(0))
                except json.JSONDecodeError:
                    print(f"Failed to parse JSON object from chunk {chunk_index+1}")
        
        # Return empty result if all parsing attempts fail
        return {"summary": "", "sections": {}}
    except Exception as e:
        print(f"Error processing chunk {chunk_index+1}: {str(e)}")
        traceback.print_exc()
        return {"summary": "", "sections": {}}

def combine_chunk_results(chunk_results):
    """Combine results from multiple chunks into a single coherent structure."""
    combined_sections = {}
    all_summaries = []
    
    # Extract summaries and sections from each chunk
    for result in chunk_results:
        chunk_summary = result.get('summary', '')
        if chunk_summary:
            all_summaries.append(chunk_summary)
        
        chunk_sections = result.get('sections', {})
        for section_name, section_data in chunk_sections.items():
            if section_name not in combined_sections:
                combined_sections[section_name] = section_data
            else:
                # Merge section data
                current_section = combined_sections[section_name]
                
                # Update section summary by combining
                if 'summary' in section_data:
                    if 'summary' in current_section:
                        current_section['summary'] += "\n\n" + section_data['summary']
                    else:
                        current_section['summary'] = section_data['summary']
                
                # Merge key_points if present
                if 'key_points' in section_data:
                    if 'key_points' not in current_section:
                        current_section['key_points'] = {}
                    
                    # Merge individual key points
                    for point_category, point_content in section_data['key_points'].items():
                        if point_category in current_section['key_points']:
                            # Combine point contents if not identical
                            if point_content != current_section['key_points'][point_category]:
                                current_section['key_points'][point_category] += "\n" + point_content
                        else:
                            current_section['key_points'][point_category] = point_content
                
                # Merge important_dates
                if 'important_dates' in section_data:
                    if 'important_dates' not in current_section:
                        current_section['important_dates'] = []
                    
                    # Add non-duplicate dates
                    for date in section_data['important_dates']:
                        if date not in current_section['important_dates']:
                            current_section['important_dates'].append(date)
                
                # Merge parent_actions
                if 'parent_actions' in section_data:
                    if 'parent_actions' not in current_section:
                        current_section['parent_actions'] = []
                    
                    # Add non-duplicate actions
                    for action in section_data['parent_actions']:
                        if action not in current_section['parent_actions']:
                            current_section['parent_actions'].append(action)
    
    return {
        'temporary_summaries': all_summaries,  # Store all chunk summaries temporarily
        'sections': combined_sections
    }

def generate_unified_summary(combined_result, model_id):
    """Generate a unified summary from the combined sections."""
    try:
        # Get all the section summaries and temporary chunk summaries
        temp_summaries = combined_result.get('temporary_summaries', [])
        sections = combined_result.get('sections', {})
        
        # Create a structured representation of all sections
        sections_text = ""
        for section_name, section_data in sections.items():
            sections_text += f"## {section_name}\n"
            if 'summary' in section_data:
                sections_text += f"{section_data['summary']}\n\n"
            
            if 'key_points' in section_data:
                sections_text += "Key points:\n"
                for category, content in section_data['key_points'].items():
                    sections_text += f"- {category}: {content}\n"
                sections_text += "\n"
            
            if 'important_dates' in section_data and section_data['important_dates']:
                sections_text += "Important dates: " + ", ".join(section_data['important_dates']) + "\n\n"
            
            if 'parent_actions' in section_data and section_data['parent_actions']:
                sections_text += "Parent actions: " + ", ".join(section_data['parent_actions']) + "\n\n"
        
        # Add previous chunk summaries if available
        previous_summaries = ""
        if temp_summaries:
            previous_summaries = "Previous chunk summaries:\n" + "\n".join([f"- {summary}" for summary in temp_summaries])
        
        # Get the prompt from config.py
        prompt = get_unified_summary_prompt(sections_text, previous_summaries)
        
        bedrock_runtime = boto3.client('bedrock-runtime')
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 2000,
                'temperature': 0.1,
                'system': SUMMARY_SYSTEM_MSG,
                'messages': [
                    {'role': 'user', 'content': prompt}
                ]
            })
        )
        
        response_body = json.loads(response['body'].read().decode('utf-8'))
        
        # Extract the summary
        summary = ""
        if 'content' in response_body:
            if isinstance(response_body['content'], list):
                for block in response_body['content']:
                    if 'text' in block:
                        summary += block['text']
            else:
                summary = response_body['content']
        elif 'completion' in response_body:
            summary = response_body['completion']
            
        return summary.strip()
    except Exception as e:
        print(f"Error generating unified summary: {str(e)}")
        traceback.print_exc()
        return "Error generating summary"

def process_single_chunk(content_text, model_id):
    """Process a short document in a single chunk."""
    try:
        # Use the prompt from config.py for consistent format
        key = "IEP Document"
        prompt = get_full_prompt(key, content_text)
        
        # Call Claude
        bedrock_runtime = boto3.client('bedrock-runtime')
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 4000,
                'temperature': 0.1,
                'system': CHUNK_ANALYSIS_SYSTEM_MSG,
                'messages': [
                    {'role': 'user', 'content': prompt}
                ]
            })
        )
        
        # Parse response from Claude
        response_body = json.loads(response['body'].read().decode('utf-8'))
        
        # Log the raw output for debugging
        print(f"Raw Claude output: {json.dumps(response_body)[:500]}...")
        
        # Extract text content from Claude's response
        content = ''
        if 'content' in response_body:
            if isinstance(response_body['content'], list):
                # Handle message format with content blocks
                for block in response_body['content']:
                    if 'text' in block:
                        content += block['text']
            elif isinstance(response_body['content'], str):
                # Handle direct content string
                content = response_body['content']
        elif 'completion' in response_body:
            # Handle simple completion response format
            content = response_body['completion']
        else:
            print(f"Unexpected Claude response format: {response_body.keys()}")
            # Try to find any usable text in the response
            content = str(response_body)
        
        # Extract JSON from content
        # Look for JSON in various formats (fenced code blocks, within content, etc.)
        print(f"Attempting to extract JSON from content: {content[:200]}...")
        
        # Try different regex patterns to find JSON
        json_patterns = [
            # Match JSON between ```json and ``` markers
            r'```(?:json)?\s*([\s\S]*?)\s*```',
            # Match a complete JSON object (assuming one is present)
            r'(?s)\{.*\}',
            # Match a complete JSON array (assuming one is present)
            r'(?s)\[.*\]'
        ]
        
        result_json = None
        
        for pattern in json_patterns:
            matches = re.findall(pattern, content)
            if matches:
                for match in matches:
                    try:
                        candidate = json.loads(match)
                        # Check if it has the expected structure
                        if isinstance(candidate, dict) and 'summary' in candidate:
                            result_json = candidate
                            break
                    except json.JSONDecodeError:
                        continue
                if result_json:
                    break
        
        # If no valid JSON found, create a fallback structure
        if not result_json:
            print("Could not parse JSON from the Claude response, using fallback structure")
            # Extract something that looks like a summary
            summary_match = re.search(r'summary["\s:]+([^"]*)', content, re.IGNORECASE)
            summary = summary_match.group(1).strip() if summary_match else "No summary available"
            
            # Create a default structure
            result_json = {
                'summary': summary,
                'sections': {}
            }
        
        # Validate and clean up the result
        if not result_json.get('summary'):
            result_json['summary'] = "No summary available"
        
        # Ensure sections is a dictionary
        if 'sections' not in result_json or not isinstance(result_json['sections'], dict):
            result_json['sections'] = {}
        
        # Log success
        print(f"Successfully extracted summary and sections from document")
        return result_json
        
    except Exception as e:
        print(f"Error during process_single_chunk: {str(e)}")
        traceback.print_exc()
        return {
            'summary': "Error generating summary: " + str(e),
            'sections': {}
        }

def extract_text_from_pdf(file_content):
    """
    Extract text from a PDF file using PyPDF2 as a fallback.
    
    Args:
        file_content (bytes): The PDF file content as bytes
        
    Returns:
        str: The extracted text
    """
    try:
        print(f"Using PyPDF2 fallback to extract text from PDF")
        pdf_reader = PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error extracting text from PDF with PyPDF2: {e}")
        return None

def summarize_and_analyze_document(file_content, user_profile=None):
    """Analyze a document to extract text and generate a summary."""
    print("Analyzing document...")
    
    try:
        # Extract text from the document using Google Document AI with PyPDF2 fallback
        from google_auth import process_document, get_documentai_client
        
        # Get Document AI client and process the document
        documentai_client = get_documentai_client()
        project_id = os.environ.get('DOCUMENT_AI_PROJECT_ID')
        location = os.environ.get('DOCUMENT_AI_LOCATION', 'us-central1')
        processor_id = os.environ.get('DOCUMENT_AI_PROCESSOR_ID')
        
        print(f"Processing document with Google Document AI (project: {project_id}, location: {location}, processor: {processor_id})")
        
        # Create request to process document
        name = documentai_client.processor_path(project_id, location, processor_id)
        
        # Process document with Document AI
        document_result = documentai_client.process_document(
                                request={
                'name': name,
                'raw_document': {
                    'content': file_content,
                    'mime_type': 'application/pdf'
                }
            }
        )
        
        # Check if text extraction was successful
        extracted_text = None
        
        if hasattr(document_result, 'document') and hasattr(document_result.document, 'text'):
            extracted_text = document_result.document.text
            
            # Check if the result came from the fallback method
            if hasattr(document_result, 'from_fallback') and document_result.from_fallback:
                print("Text successfully extracted using PyPDF2 fallback")
            else:
                print("Text successfully extracted using Google Document AI")
        
        # If Document AI failed, try the direct PDF extraction fallback
        if not extracted_text:
            print("Document AI text extraction failed, trying direct PDF fallback")
            extracted_text = extract_text_from_pdf(file_content)
            
            if extracted_text:
                print("Text successfully extracted using direct PDF fallback")
        
        # Only proceed if we successfully extracted text
        if not extracted_text:
            return {
                "success": False,
                "error": "Failed to extract text from the document"
            }

        # Summarize and categorize the document
        result = summarize_and_categorize(extracted_text)
        
        # Handle language preferences from user profile
        target_languages = []
        
        if user_profile:
            if 'languages' in user_profile:
                # Use the existing languages array from user profile
                all_languages = user_profile.get('languages', [])
                print(f"Using languages from user profile: {all_languages}")
                
                # Only include non-English languages for translation
                target_languages = [lang for lang in all_languages if lang != 'en']
                if target_languages:
                    print(f"Target languages for translation: {target_languages}")
                else:
                    print("No non-English languages found for translation")
            else:
                print("No 'languages' field found in user profile")
        else:
            print("No user profile provided, skipping translations")
        
        # Translate summary if target languages are specified
        if target_languages:
            print(f"Translating content to: {', '.join(target_languages)}")
            if 'summary' in result:
                result['summary'] = translate_content(result['summary'], target_languages)
            
            # Translate each section
            if 'sections' in result:
                # Check if sections is a dictionary (previous code assumed it's always a list)
                if isinstance(result['sections'], dict):
                    translated_sections = {}
                    for section_name, section_content in result['sections'].items():
                        if isinstance(section_content, dict):
                            translated_section = section_content.copy()
                            # Translate the content of the section
                            if 'content' in translated_section:
                                translated_section['content'] = translate_content(translated_section['content'], target_languages)
                            # Also translate summary if present
                            if 'summary' in translated_section:
                                translated_section['summary'] = translate_content(translated_section['summary'], target_languages)
                            translated_sections[section_name] = translated_section
                        else:
                            # If section content is not a dictionary, just keep it as is
                            translated_sections[section_name] = section_content
                    result['sections'] = translated_sections
                else:
                    # Original implementation for when sections is a list
                    translated_sections = []
                    for section in result['sections']:
                        if isinstance(section, dict):
                            translated_section = section.copy()
                            # Translate the content of the section
                            if 'content' in section:
                                translated_section['content'] = translate_content(section['content'], target_languages)
                            translated_sections.append(translated_section)
                        else:
                            # If section is not a dictionary, just append it as is
                            translated_sections.append(section)
                    result['sections'] = translated_sections
        
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        } 