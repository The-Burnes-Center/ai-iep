import os
import boto3
import logging
import json
from datetime import datetime
from data_model import IEPData
from openai import OpenAI
# Correct imports for openai-agents package
from agents import Agent, Runner, function_tool, WebSearchTool
from config import get_full_prompt, get_all_tags, IEP_SECTIONS, get_translation_prompt, get_language_context, SECTION_KEY_POINTS, LANGUAGE_CODES
import traceback
from agents.exceptions import MaxTurnsExceeded

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OpenAIAgent:
    def __init__(self, ocr_data=None):
        """
        Initialize the OpenAIAgent with optional OCR data.
        
        Args:
            ocr_data (dict, optional): OCR data from Mistral OCR API
        """
        self.ocr_data = ocr_data
        self.api_key = self._get_openai_api_key()
        
        # Create tool instances that have access to self
        self.ocr_text_tool = self._create_ocr_text_tool()
        self.ocr_page_tool = self._create_ocr_page_tool()
        self.language_context_tool = self._create_language_context_tool()
        self.section_info_tool = self._create_section_info_tool()

    def _get_openai_api_key(self):
        """
        Retrieves the OpenAI API key from the environment variable.
        The Lambda function should have already set this from SSM Parameter Store.
        Returns:
            str: The OpenAI API key.
        """
        # Get from environment - Lambda should have already set this
        openai_api_key = os.environ.get('OPENAI_API_KEY')
        
        if not openai_api_key:
            logger.warning("OpenAI API key not found in environment variables")
            # Fallback to SSM in case Lambda didn't set it
            param_name = os.environ.get('OPENAI_API_KEY_PARAMETER_NAME')
            if param_name:
                try:
                    ssm = boto3.client('ssm')
                    response = ssm.get_parameter(Name=param_name, WithDecryption=True)
                    openai_api_key = response['Parameter']['Value']
                    # Set in environment for future use
                    os.environ['OPENAI_API_KEY'] = openai_api_key
                    logger.info("Successfully retrieved OpenAI API key from SSM Parameter Store")
                except Exception as e:
                    logger.error(f"Error retrieving OpenAI API key from SSM: {str(e)}")
        
        if not openai_api_key:
            logger.error("No OpenAI API key available")
            
        return openai_api_key

    def _create_ocr_text_tool(self):
        """Create a tool for getting all OCR text"""
        @function_tool()
        def get_all_ocr_text() -> str:
            """Extract and combine OCR text from all document pages.

            This tool combines text content from all pages in the OCR data,
            prefixing each page's content with its page number for reference.

            Returns:
                str: Combined text content in format:
                    Page 1:
                    [page 1 content]
                    
                    Page 2: 
                    [page 2 content]
                    ...
                    
                    Returns None if no valid OCR data available.
            """
            if not self.ocr_data or 'pages' not in self.ocr_data:
                return None
                
            text_content = []
            for i, page in enumerate(self.ocr_data['pages'], 1):
                if 'markdown' in page:
                    text_content.append(f"Page {i}:\n{page['markdown']}")
            
            return "\n\n".join(text_content)
        return get_all_ocr_text

    def _create_ocr_page_tool(self):
        """Create a tool for getting OCR text for a specific page"""
        @function_tool()
        def get_ocr_text_for_page(page_index: int) -> str:
            """Extract OCR text from a specific page of the IEP document.

            This tool retrieves markdown-formatted text content from a specific page,
            allowing targeted extraction of section information.

            Args:
                page_index (int): 0-based page index to retrieve (page 1 is index 0)

            Returns:
                str: Markdown-formatted content for the specified page.
                    Returns empty string if page not found.
            """
            if not self.ocr_data or not isinstance(self.ocr_data, dict) or 'pages' not in self.ocr_data:
                print(f"Invalid OCR result format or missing 'pages' field")
                return ""
            
            for page in self.ocr_data['pages']:
                if isinstance(page, dict) and 'index' in page and page['index'] == page_index:
                    return page.get('markdown', '')
                    
            print(f"Page index {page_index} not found in OCR result. Max index is {len(self.ocr_data['pages'])}")
            return ""
        return get_ocr_text_for_page

    def _create_language_context_tool(self):
        """Create a tool for getting language context"""
        @function_tool()
        def get_language_context_for_translation(target_language: str) -> str:
            """Get translation guidelines for a specific target language.

            This tool provides language-specific guidelines and context for translation,
            ensuring appropriate reading level and terminology for IEP documents.

            Args:
                target_language (str): Target language code:
                    - 'es' for Spanish
                    - 'vi' for Vietnamese
                    - 'zh' for Chinese

            Returns:
                str: Language-specific guidelines and context for translation
            """
            return get_language_context(target_language)
        return get_language_context_for_translation

    def _create_section_info_tool(self):
        """Create a tool for getting section-specific information"""
        
        # Generate the docstring dynamically
        sections_list = ', '.join(list(IEP_SECTIONS.keys()))
        doc_template = f'''Get key points and requirements for an IEP section.

            This tool provides detailed information about what content and key points
            should be extracted for a specific IEP section.

            Args:
                section_name (str): Name of the section. Must be one of: {sections_list}

            Returns:
                dict: Section information containing:
                    - section_name (str): Name of the section
                    - description (str): Detailed description
                    - key_points (list): Important points to extract
                    
                    If section not found, returns:
                    - error (str): Error message
                    - available_sections (list): Valid section names
            '''
            
        @function_tool
        def get_section_info(section_name: str) -> dict:
            get_section_info.__doc__ = doc_template
            if section_name not in IEP_SECTIONS:
                return {
                    "error": f"Section {section_name} not found",
                    "available_sections": list(IEP_SECTIONS.keys())
                }
                
            return {
                "section_name": section_name,
                "description": IEP_SECTIONS[section_name],
                "key_points": SECTION_KEY_POINTS.get(section_name, [])
            }
        return get_section_info

    def analyze_document(self, model="gpt-4.1"):
        """
        Analyze an IEP document using OpenAI's Agent architecture.
        
        Args:
            model (str): The OpenAI model to use, defaults to gpt-4.1
            
        Returns:
            dict: Analysis results from the agent
        """
        if not self.api_key:
            logger.error("OpenAI API key not available, cannot process document")
            return {"error": "OpenAI API key not available"}
        
        try:
            if not self.ocr_data or 'pages' not in self.ocr_data:
                return {"error": "No OCR data available"}
                
            # API key should already be set in environment by the Lambda
            logger.info(f"Creating agent for document analysis using {model}")
            
            # Get the prompt from config.py
            prompt = get_full_prompt("IEP Document")
           
            # Create an agent for document analysis using the agents package
            agent = Agent(
                name="IEP Document Analyzer",
                model=model,
                instructions=prompt,
                tools=[
                    self.ocr_text_tool, 
                    self.ocr_page_tool, 
                    self.language_context_tool, 
                    self.section_info_tool,
                    WebSearchTool()
                ],
                output_type=IEPData
            )
            
            # Run the agent with increased max turns for complex IEP analysis
            try:
                result = Runner.run_sync(
                    agent, 
                    "Please analyze this IEP document according to the instructions.",
                    max_turns= 150  # Increased from default 10 to handle complex IEP analysis
                )
                logger.info("Agent completed analysis")
            except MaxTurnsExceeded as e:
                logger.error(f"Max turns exceeded during analysis: {str(e)}")
                return {
                    "error": "Analysis exceeded maximum allowed turns. The document may be too complex or require adjustment to the analysis strategy."
                }
            
            try:
                # Clean and validate the JSON output
                if isinstance(result.final_output, str):
                    logger.info("Cleaning and parsing JSON string output")
                    # Remove any potential markdown code block markers
                    cleaned_output = result.final_output.replace('```json', '').replace('```', '').strip()
                    try:
                        # Use Pydantic v2's model_validate_json for direct JSON string parsing
                        iep_data = IEPData.model_validate_json(cleaned_output, strict=False)
                        logger.info("Successfully parsed and validated IEPData")
                        return iep_data.model_dump()
                    except json.JSONDecodeError as je:
                        logger.error(f"JSON parsing error: {str(je)}")
                        logger.error(f"Problematic JSON: {cleaned_output[:200]}...")  # Log first 200 chars
                        return {
                            "summaries": {lang: "" for lang in LANGUAGE_CODES.values()},
                            "sections": {lang: [] for lang in LANGUAGE_CODES.values()},
                            "document_index": {lang: "" for lang in LANGUAGE_CODES.values()},
                            "validation_errors": {
                                "is_valid": False,
                                "errors": [f"Invalid JSON output: {str(je)}"]
                            }
                        }
                elif isinstance(result.final_output, dict):
                    # If it's already a dict, use model_validate method instead of parse_obj
                    iep_data = IEPData.model_validate(result.final_output, strict=False)
                    logger.info("Successfully parsed and validated IEPData from dict")
                    return iep_data.model_dump()
                elif isinstance(result.final_output, IEPData):
                    # If it's already an IEPData instance, just return it
                    logger.info("Successfully validated IEPData instance")
                    return result.final_output.model_dump()
                else:
                    logger.error(f"Unexpected output type: {type(result.final_output)}")
                    return {
                        "summaries": {lang: "" for lang in LANGUAGE_CODES.values()},
                        "sections": {lang: [] for lang in LANGUAGE_CODES.values()},
                        "document_index": {lang: "" for lang in LANGUAGE_CODES.values()},
                        "validation_errors": {
                            "is_valid": False,
                            "errors": [f"Unexpected output type: {type(result.final_output)}"]
                        }
                    }
                    
            except ValueError as e:
                # Handle Pydantic validation errors
                logger.error(f"Pydantic validation error: {str(e)}")
                return {
                    "summaries": {lang: "" for lang in LANGUAGE_CODES.values()},
                    "sections": {lang: [] for lang in LANGUAGE_CODES.values()},
                    "document_index": {lang: "" for lang in LANGUAGE_CODES.values()},
                    "validation_errors": {
                        "is_valid": False,
                        "errors": [f"Validation error: {str(e)}"]
                    }
                }
            except Exception as e:
                logger.error(f"Error processing agent output: {str(e)}")
                logger.error(traceback.format_exc())
                return {
                    "summaries": {lang: "" for lang in LANGUAGE_CODES.values()},
                    "sections": {lang: [] for lang in LANGUAGE_CODES.values()},
                    "document_index": {lang: "" for lang in LANGUAGE_CODES.values()},
                    "validation_errors": {
                        "is_valid": False,
                        "errors": [f"Error processing agent output: {str(e)}"]
                    }
                }
                
        except Exception as e:
            logger.error(f"Error analyzing document with OpenAI Agent: {str(e)}")
            # add more details to the error message
            logger.error(traceback.format_exc())
            
            # Safely log the result structure if it exists
            try:
                if 'result' in locals() and hasattr(result, 'final_output'):
                    logger.error("Final output structure:")
                    # Try to identify where the JSON might be truncated
                    output_str = str(result.final_output)
                    logger.error(f"Output length: {len(output_str)}")
                    logger.error(f"First 500 chars: {output_str[:500]}...")
                    logger.error(f"Last 500 chars: ...{output_str[-500:]}")
                    
                    # Try to parse as JSON to get more specific error details
                    try:
                        if isinstance(result.final_output, str):
                            json.loads(result.final_output)
                        elif isinstance(result.final_output, dict):
                            json.dumps(result.final_output)
                    except json.JSONDecodeError as json_err:
                        logger.error(f"JSON parsing error details: {str(json_err)}")
                        logger.error(f"Error position: {json_err.pos}")
                        logger.error(f"Error line and column: {json_err.lineno}:{json_err.colno}")
                        
            except Exception as log_error:
                logger.error(f"Could not log result structure: {str(log_error)}")

            return {"error": str(e)}

    