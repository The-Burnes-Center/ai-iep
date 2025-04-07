import os
import boto3
import logging
import json
from datetime import datetime
from openai import OpenAI
# Correct imports for openai-agents package
from agents import Agent, Runner, function_tool
from config import get_full_prompt, get_all_tags, IEP_SECTIONS, get_translation_prompt, get_language_context, SECTION_KEY_POINTS

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
        @function_tool
        def get_all_ocr_text():
            """
            Use this tool to Extract all OCR text with page numbers from the OCR result.
            
            This tool combines the text content from all pages in the OCR data,
            prefixing each page's content with its page number for reference.
            
            Returns:
                str: Combined text content from all pages with page numbers,
                     or None if no valid OCR data is available.
                     Format:
                     Page 1:
                     [page 1 content]
                     
                     Page 2: 
                     [page 2 content]
                     ...
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
        @function_tool
        def get_ocr_text_for_page(page_index: int):
            """
            Use this tool to get the markdown text for a specific page from OCR result of the IEP document. Using the index you can get specific information about each section based on the page number of the document. 
            
            Args:
                page_index (int): 0-based page index to retrieve, i.e. page 1 is index 0
                
            Returns:
                str: Markdown content for the specified page or empty string if not found
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
        @function_tool
        def get_language_context_for_translation(target_language: str):
            """
            Use this tool to get the language context for translation.
            
            Args:
                target_language (str): The target language code, i.e. 'es' for spanish, 'vi' for vietnamese, 'zh' for chinese
                
            Returns:
                str: Language-specific context and guidelines
            """
            return get_language_context(target_language)
        return get_language_context_for_translation

    def _create_section_info_tool(self):
        """Create a tool for getting section-specific information"""
        @function_tool
        def get_section_info(section_name: str):
            """
            Use this tool to get understand what key points and information are important for a specific section.
            
            Args:
                section_name (str): The name of the section to get information for, {IEP_SECTIONS.keys()}
                
            Returns:
                dict: Section information including key points and description
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
                tools=[self.ocr_text_tool, self.ocr_page_tool, self.language_context_tool, self.section_info_tool]
            )

    
            
            # Run the agent
            result = Runner.run_sync(agent, "Please analyze this IEP document according to the instructions.")
            
            logger.info("Agent completed analysis")
            
            # Extract the final output
            analysis_text = result.final_output
            print(analysis_text)
            
            # Try to parse any JSON in the response
            try:
                # Look for JSON within the text
                json_start = analysis_text.find('{')
                json_end = analysis_text.rfind('}') + 1
                
                if json_start >= 0 and json_end > json_start:
                    json_str = analysis_text[json_start:json_end]
                    analysis_result = json.loads(json_str)
                    
                    # Ensure the sections structure matches the expected format
                    if 'sections' in analysis_result:
                        if not isinstance(analysis_result['sections'], dict):
                            analysis_result['sections'] = {'en': []}
                        elif 'en' not in analysis_result['sections']:
                            analysis_result['sections']['en'] = []
                            
                        # Convert sections to array format if needed
                        if isinstance(analysis_result['sections']['en'], dict):
                            sections_array = []
                            for title, content in analysis_result['sections']['en'].items():
                                sections_array.append({
                                    'title': title,
                                    'content': content.get('content', ''),
                                    'ocr_text_used': content.get('ocr_text_used', ''),
                                    'page_numbers': content.get('page_numbers', '')
                                })
                            analysis_result['sections']['en'] = sections_array
                else:
                    # If no JSON found, use the whole text as a summary
                    analysis_result = {
                        "summary": analysis_text,
                        "sections": {"en": []},
                        "document_index": {}
                    }
            except json.JSONDecodeError:
                # If JSON parsing fails, use the text as a summary
                analysis_result = {
                    "summary": analysis_text,
                    "sections": {"en": []},
                    "document_index": {}
                }
            
            logger.info(f"Successfully analyzed document with OpenAI Agent")
            return analysis_result
                
        except Exception as e:
            logger.error(f"Error analyzing document with OpenAI Agent: {str(e)}")
            return {"error": str(e)}

    # def translate(self, content, target_language, model="gpt-4o"):
        """
        Translate content using OpenAI's Agent architecture.
        
        Args:
            content (dict): The content to translate (complete document structure)
            target_language (str): The target language code
            model (str): The OpenAI model to use, defaults to gpt-4o
            
        Returns:
            dict: Translated content with the same structure
        """
        if not self.api_key:
            logger.error("OpenAI API key not available, cannot translate content")
            return {"error": "OpenAI API key not available"}
        
        try:
            logger.info(f"Creating translation agent for {target_language}")
            
            # Get the translation prompt from config.py
            prompt = get_translation_prompt(content, target_language)
            
            # Create an agent for translation
            agent = Agent(
                name=f"Translation Agent ({target_language})",
                model=model,
                instructions=prompt
            )
            
            # Run the agent
            result = Runner.run_sync(agent, "Please translate the content according to the instructions.")
            
            logger.info("Translation agent completed")
            
            # Extract the final output
            translated_text = result.final_output
            
            # Try to parse the JSON response
            try:
                # Look for JSON within the text
                json_start = translated_text.find('{')
                json_end = translated_text.rfind('}') + 1
                
                if json_start >= 0 and json_end > json_start:
                    json_str = translated_text[json_start:json_end]
                    translated_result = json.loads(json_str)
                    
                    # Validate the structure matches the input
                    if not all(key in translated_result for key in content.keys()):
                        raise ValueError("Translated result missing required fields")
                    
                    # Validate the nested structure
                    for key, value in content.items():
                        if isinstance(value, dict):
                            if not isinstance(translated_result[key], dict):
                                raise ValueError(f"Invalid structure for {key}")
                            if 'M' in value and 'M' not in translated_result[key]:
                                raise ValueError(f"Missing 'M' structure in {key}")
                    
                    logger.info(f"Successfully translated content to {target_language}")
                    return translated_result
                else:
                    return {"error": "No valid JSON found in translation response"}
                    
            except json.JSONDecodeError:
                logger.error("Failed to parse translation JSON response")
                return {"error": "Invalid JSON response"}
            except ValueError as e:
                logger.error(f"Invalid translation structure: {str(e)}")
                return {"error": f"Invalid translation structure: {str(e)}"}
                
        except Exception as e:
            logger.error(f"Error translating content with OpenAI Agent: {str(e)}")
            return {"error": str(e)}
