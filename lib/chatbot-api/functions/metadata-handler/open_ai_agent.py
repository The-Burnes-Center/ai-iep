import os
import boto3
import logging
import json
from datetime import datetime
from openai import OpenAI
# Correct imports for openai-agents package
from agents import Agent, Runner, function_tool
from config import get_full_prompt, get_all_tags, IEP_SECTIONS, get_translation_prompt, get_language_context, SECTION_KEY_POINTS, LANGUAGE_CODES

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
        self.validation_tool = self._create_validation_tool()
        
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
        def get_all_ocr_text() -> str:
            """Extract all OCR text with page numbers from the OCR result.
            
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
        def get_ocr_text_for_page(page_index: int) -> str:
            """Get the markdown text for a specific page from OCR result of the IEP document.
            
            Using the index you can get specific information about each section based on 
            the page number of the document.
            
            Args:
                page_index (int): 0-based page index to retrieve (page 1 is index 0)
                
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
        def get_language_context_for_translation(target_language: str) -> str:
            """Get language-specific context, instructions and guidelines for translation.
            
            This tool provides specific guidelines and context for translating content
            to the target language, ensuring appropriate reading level and terminology.
            
            Args:
                target_language (str): Target language code ('es' for Spanish, 
                    'vi' for Vietnamese, 'zh' for Chinese)
                
            Returns:
                str: Language-specific context and guidelines for the target language
            """
            return get_language_context(target_language)
        return get_language_context_for_translation

    def _create_section_info_tool(self):
        """Create a tool for getting section-specific information"""
        @function_tool
        def get_section_info(section_name: str) -> dict:
            """Get key points and description for a specific IEP section.
            
            This tool provides information about what content and key points
            should be extracted for a given IEP section.
            
            Args:
                section_name (str): Name of the section to get information for.
                    Must be one of: {', '.join(IEP_SECTIONS.keys())}
                
            Returns:
                dict: Section information including:
                    - section_name: Name of the section
                    - description: Detailed description of the section
                    - key_points: List of important points to extract
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

    def _create_validation_tool(self):
        """Create a tool for validating the output JSON structure"""
        @function_tool  # Remove all parameters from decorator
        def validate_output(json_structure: dict) -> dict:
            """Validate the completeness and structure of the output JSON.

            Args:
                json_structure (dict): The input should have the following in the json_structure:
                    - summaries
                    - sections
                    - document_index

            Returns:
                dict: Validation results
            """
            validation_results = {
                "is_valid": True,
                "missing_items": [],
                "incomplete_sections": [],
                "structure_errors": []
            }
            
            # Required top-level keys
            required_keys = ["summaries", "sections", "document_index"]
            required_languages = list(LANGUAGE_CODES.values())  # Convert to list for better compatibility
            required_section_fields = ["title", "content", "ocr_text_used", "page_numbers"]
            
            # Check top-level structure
            for key in required_keys:
                if key not in json_structure:
                    validation_results["is_valid"] = False
                    validation_results["structure_errors"].append(f"Missing top-level key: {key}")
                    continue
                
                # Check language presence for each top-level key
                for lang in required_languages:
                    if lang not in json_structure[key]:
                        validation_results["is_valid"] = False
                        validation_results["missing_items"].append(f"Missing language {lang} in {key}")
            
            # Check sections specifically
            if "sections" in json_structure:
                for lang in required_languages:
                    if lang not in json_structure["sections"]:
                        continue
                        
                    # Get sections for this language
                    sections = json_structure["sections"][lang]
                    if not isinstance(sections, list):
                        validation_results["is_valid"] = False
                        validation_results["structure_errors"].append(f"Sections for {lang} is not a list")
                        continue
                    
                    # Check each section has all required fields
                    for section in sections:
                        missing_fields = []
                        for field in required_section_fields:
                            if field not in section:
                                missing_fields.append(field)
                            elif not section[field]:  # Check if field is empty
                                missing_fields.append(f"{field} (empty)")
                        
                        if missing_fields:
                            validation_results["is_valid"] = False
                            validation_results["incomplete_sections"].append({
                                "language": lang,
                                "section_title": section.get("title", "Unknown"),
                                "missing_fields": missing_fields
                            })
                    
                    # Check all required IEP sections are present
                    found_sections = {s.get("title") for s in sections}
                    missing_sections = set(IEP_SECTIONS.keys()) - found_sections
                    if missing_sections:
                        validation_results["is_valid"] = False
                        validation_results["missing_items"].append(f"Missing sections in {lang}: {', '.join(missing_sections)}")
            
            return validation_results
        return validate_output

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
                    self.validation_tool
                ]
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
                    
                    # Validate the output structure
                    validation_result = self.validation_tool(analysis_result)
                    
                    if not validation_result["is_valid"]:
                        logger.warning("Output validation failed:")
                        logger.warning(f"Structure errors: {validation_result['structure_errors']}")
                        logger.warning(f"Missing items: {validation_result['missing_items']}")
                        logger.warning(f"Incomplete sections: {validation_result['incomplete_sections']}")
                        
                        # Add validation results to the output
                        analysis_result["validation_errors"] = validation_result
                    
                    # Ensure the sections structure matches the expected format
                    if 'sections' in analysis_result:
                        for lang in LANGUAGE_CODES.values():
                            if lang not in analysis_result['sections']:
                                analysis_result['sections'][lang] = []
                            elif isinstance(analysis_result['sections'][lang], dict):
                                # Convert sections to array format if needed
                                sections_array = []
                                for title, content in analysis_result['sections'][lang].items():
                                    sections_array.append({
                                        'title': title,
                                        'content': content.get('content', ''),
                                        'ocr_text_used': content.get('ocr_text_used', ''),
                                        'page_numbers': content.get('page_numbers', '')
                                    })
                                analysis_result['sections'][lang] = sections_array
                else:
                    # If no JSON found, use the whole text as a summary
                    analysis_result = {
                        "summary": analysis_text,
                        "sections": {lang: [] for lang in LANGUAGE_CODES.values()},
                        "document_index": {lang: "" for lang in LANGUAGE_CODES.values()},
                        "validation_errors": {
                            "is_valid": False,
                            "structure_errors": ["No valid JSON found in response"]
                        }
                    }
            except json.JSONDecodeError:
                # If JSON parsing fails, use the text as a summary
                analysis_result = {
                    "summary": analysis_text,
                    "sections": {lang: [] for lang in LANGUAGE_CODES.values()},
                    "document_index": {lang: "" for lang in LANGUAGE_CODES.values()},
                    "validation_errors": {
                        "is_valid": False,
                        "structure_errors": ["Failed to parse JSON response"]
                    }
                }
            
            logger.info(f"Successfully analyzed document with OpenAI Agent")
            return analysis_result
                
        except Exception as e:
            logger.error(f"Error analyzing document with OpenAI Agent: {str(e)}")
            return {"error": str(e)}

    