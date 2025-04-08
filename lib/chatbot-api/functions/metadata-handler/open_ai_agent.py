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
        @function_tool()
        def get_section_info(section_name: str) -> dict:
            """Get key points and requirements for an IEP section.

            This tool provides detailed information about what content and key points
            should be extracted for a specific IEP section.

            Args:
                section_name (str): Name of the section. Must be one of:
                    - Present Levels
                    - Eligibility
                    - Placement
                    - Goals
                    - Services
                    - Informed Consent
                    - Accommodations

            Returns:
                dict: Section information containing:
                    - section_name (str): Name of the section
                    - description (str): Detailed description
                    - key_points (list): Important points to extract
                    
                    If section not found, returns:
                    - error (str): Error message
                    - available_sections (list): Valid section names
            """
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

    def analyze_document(self, model="gpt-4o"):
        """
        Analyze an IEP document using OpenAI's Agent architecture.
        
        Args:
            model (str): The OpenAI model to use, defaults to gpt-4o
            
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
                output_pydantic=IEPData
            )
            
            # Run the agent
            result = Runner.run_sync(agent, "Please analyze this IEP document according to the instructions.")
            logger.info("Agent completed analysis")
            
            try:
                # Since we specified output_pydantic=IEPData, result.final_output should be an IEPData instance
                if isinstance(result.final_output, IEPData):
                    # Pydantic has already validated the model at this point
                    logger.info("Successfully validated IEPData output")
                    return result.final_output.dict()
                else:
                    # If output is not IEPData instance, create a default error structure
                    logger.error("Agent output is not an IEPData instance")
                    return {
                        "summaries": {lang: "" for lang in LANGUAGE_CODES.values()},
                        "sections": {lang: [] for lang in LANGUAGE_CODES.values()},
                        "document_index": {lang: "" for lang in LANGUAGE_CODES.values()},
                        "validation_errors": {
                            "is_valid": False,
                            "errors": ["Agent output is not in the expected IEPData format"]
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
            return {"error": str(e)}

    