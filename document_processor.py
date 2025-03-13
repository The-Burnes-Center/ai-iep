def call_claude(prompt, max_tokens=8000, temperature=0):
    """
    Call Claude model through AWS Bedrock to process text.
    
    Args:
        prompt (str): The prompt to send to Claude
        max_tokens (int): Maximum number of tokens in the response
        temperature (float): Temperature setting for response randomness
    
    Returns:
        dict: The response from Claude
    """
    import boto3
    import json
    from utils import get_logger
    import os
    
    logger = get_logger()
    
    # Initialize Bedrock client
    bedrock_runtime = boto3.client('bedrock-runtime')
    
    # Get model ID from environment variables or use default
    model_id = os.environ.get('CLAUDE_MODEL_ID', 'anthropic.claude-3-5-sonnet-20240620-v1:0')
    logger.info(f"Using Claude model: {model_id}")
    
    # Call Claude
    try:
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': max_tokens,
                'temperature': temperature,
                'messages': [
                    {'role': 'user', 'content': prompt}
                ]
            })
        )
        
        # Parse response
        response_body = json.loads(response['body'].read().decode('utf-8'))
        return response_body
        
    except Exception as e:
        logger.error(f"Error calling Claude: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {"error": str(e)}

def process_single_chunk(text, context=None):
    """
    Process a single chunk of text with Claude.
    
    Args:
        text (str): The text to process.
        context (dict, optional): Context information to include with the processing.
    
    Returns:
        dict: The processed content.
    """
    import re
    import json
    from utils import get_logger
    
    logger = get_logger()
    
    # Prepare the prompt with the text and context
    prompt_parts = ["I'll give you a portion of an educational document, likely an Individualized Education Program (IEP) for a student with special needs.",
                   "Extract ALL important information in this document including: ",
                   "- Summarize the content in parent-friendly language that maintains all important details",
                   "- All services and accommodations",
                   "- All dates mentioned in the document, including due dates",
                   "- All parent action items or decisions needed",
                   "Use this structure and return ONLY as JSON (no markdown):\n"]
    
    # Format the expected JSON structure
    json_format = {
        "summary": "Comprehensive summary in parent-friendly language",
        "services": {
            "academic": "Academic services description",
            "speech": "Speech services description",
            "occupational_therapy": "Occupational therapy description",
            # Other services as needed
        },
        "accommodations": {
            "classroom": "Classroom accommodations",
            "testing": "Testing accommodations",
            # Other accommodations as needed
        },
        "important_dates": [
            "List of important dates"
        ],
        "parent_actions": [
            "List of parent action items"
        ],
        "location": "beginning/middle/end"
    }
    
    prompt_parts.append(f"Expected format: {json.dumps(json_format, indent=2)}")
    
    if context:
        prompt_parts.append(f"\nThis is the {context.get('position', 'middle')} part of the document.")
        if context.get('is_first', False):
            prompt_parts.append("Focus on capturing the introduction and initial information.")
        if context.get('is_last', False):
            prompt_parts.append("Focus on capturing the conclusion and final information.")
    
    prompt_parts.append("\nHere's the text to analyze:")
    prompt_parts.append(text)
    prompt = "\n".join(prompt_parts)
    
    # Call Claude
    try:
        response = call_claude(prompt, max_tokens=8000, temperature=0)
        
        # Log raw output keys
        logger.info(f"Raw LLM output keys: {list(response.keys() if isinstance(response, dict) else ['not a dict'])}")
        
        # Extract the text content from the response
        if isinstance(response, dict) and 'content' in response:
            if isinstance(response['content'], list) and len(response['content']) > 0:
                content_items = [item for item in response['content'] if isinstance(item, dict) and 'text' in item]
                if content_items:
                    raw_output = content_items[0]['text']
                else:
                    logger.warning("No text content found in response content list")
                    raw_output = str(response['content'])
            else:
                raw_output = str(response['content'])
        else:
            logger.warning(f"Unexpected response structure: {type(response)}")
            raw_output = str(response)
        
        # Log the raw output length and preview
        logger.info(f"Raw LLM output length: {len(raw_output)}")
        logger.info(f"Raw LLM output preview: {raw_output[:300]}...")
        logger.info(f"Raw LLM output end: {raw_output[-300:] if len(raw_output) > 300 else raw_output}")
        
        # Try to extract JSON from the response using various methods
        result = None
        
        # Method 1: Look for JSON in code blocks
        logger.info("Looking for JSON in code blocks")
        json_code_block_pattern = r"```(?:json)?\s*([\s\S]*?)```"
        json_matches = re.findall(json_code_block_pattern, raw_output)
        
        if json_matches:
            logger.info(f"Found {len(json_matches)} JSON code blocks")
            for i, json_match in enumerate(json_matches):
                logger.info(f"Attempting to parse JSON code block {i+1}")
                try:
                    # Clean the JSON string before parsing - remove control characters
                    clean_json = re.sub(r'[\x00-\x1F\x7F]', '', json_match)
                    result = json.loads(clean_json)
                    logger.info(f"Successfully parsed JSON from code block {i+1}")
                    break
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse JSON code block {i+1}: {str(e)}")
        else:
            logger.info("No JSON code block found")
        
        # Method 2: Try to parse the entire content as JSON
        if not result:
            logger.info("Attempting to parse entire content as JSON")
            try:
                # Clean the JSON string before parsing
                clean_json = re.sub(r'[\x00-\x1F\x7F]', '', raw_output)
                result = json.loads(clean_json)
                logger.info("Successfully parsed entire content as JSON")
            except json.JSONDecodeError as e:
                logger.info(f"Failed to parse entire content as JSON: {str(e)}")
        
        # Method 3: Look for a JSON object pattern in the content
        if not result:
            logger.info("Looking for JSON object pattern in content")
            json_object_pattern = r"({[\s\S]*})"
            json_matches = re.findall(json_object_pattern, raw_output)
            
            if json_matches:
                # Find the longest match which is likely the complete JSON
                json_match = max(json_matches, key=len)
                logger.info(f"Found potential JSON object. Length: {len(json_match)}")
                logger.info(f"JSON object preview: {json_match[:150]}...")
                
                try:
                    # Clean the JSON string before parsing
                    clean_json = re.sub(r'[\x00-\x1F\x7F]', '', json_match)
                    result = json.loads(clean_json)
                    logger.info("Successfully parsed JSON object")
                except json.JSONDecodeError as e:
                    logger.info(f"Failed to parse JSON object: {str(e)}")
                    
                    # Try more aggressive cleaning if standard cleaning failed
                    try:
                        # Remove all non-printable characters and normalize whitespace
                        ultra_clean_json = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', json_match)
                        # Fix common JSON formatting issues
                        ultra_clean_json = re.sub(r',\s*}', '}', ultra_clean_json)  # Remove trailing commas
                        ultra_clean_json = re.sub(r',\s*]', ']', ultra_clean_json)  # Remove trailing commas in arrays
                        
                        result = json.loads(ultra_clean_json)
                        logger.info("Successfully parsed JSON object with aggressive cleaning")
                    except json.JSONDecodeError as e2:
                        logger.warning(f"Failed to parse JSON object with aggressive cleaning: {str(e2)}")
        
        # If no valid JSON was found, create a fallback structure
        if not result:
            logger.warning("Failed to extract valid JSON, creating fallback structure")
            # Extract a summary from the text if possible
            summary_match = re.search(r'"summary"\s*:\s*"([^"]+)"', raw_output)
            summary = summary_match.group(1) if summary_match else "Summary extraction failed"
            
            # Create a basic structure with the raw text
            excerpt_length = min(1000, len(raw_output))
            result = {
                "summary": summary,
                "content": raw_output[:excerpt_length],
                "extraction_failed": True
            }
            logger.info(f"Creating fallback structure with extracted text (length: {excerpt_length})")
        
        # Validate the result structure
        if not isinstance(result, dict):
            logger.warning(f"Result is not a dictionary: {type(result)}")
            result = {"error": "Invalid result structure", "raw": str(result)[:1000]}
        
        # Ensure the summary field exists and is a string
        if "summary" not in result:
            logger.warning("Summary field missing from result, adding placeholder")
            result["summary"] = "Summary not available in extracted content"
        elif not isinstance(result["summary"], str):
            logger.warning(f"Summary is not a string: {type(result['summary'])}")
            result["summary"] = str(result["summary"])
        
        # Log result summary details
        logger.info(f"Final result summary length: {len(result.get('summary', ''))}")
        logger.info(f"Final result sections type: {type(result.get('sections', {}))}")
        
        return result
    except Exception as e:
        logger.error(f"Error in process_single_chunk: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {"error": str(e), "summary": "Error processing document chunk"} 