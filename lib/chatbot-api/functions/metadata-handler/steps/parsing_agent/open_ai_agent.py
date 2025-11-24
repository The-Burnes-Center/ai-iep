import os
import logging
import json
import traceback
from data_model import SingleLanguageIEP
from openai import OpenAI
from agents import Agent, Runner, function_tool, ModelSettings
from config import get_english_only_prompt, IEP_SECTIONS, SECTION_KEY_POINTS
from agents.exceptions import MaxTurnsExceeded

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OpenAIAgent:
    def __init__(self, ocr_data=None, api_key=None):
        """
        Initialize the OpenAIAgent with optional OCR data.
        Args:
            ocr_data (dict, optional): OCR data from Mistral OCR API
            api_key (str, optional): Pre-fetched OpenAI API key to avoid SSM calls
        """
        self.ocr_data = ocr_data
        self.api_key = api_key or self._get_openai_api_key()
        # Tools
        self.ocr_text_tool = self._create_ocr_text_tool()
        self.ocr_page_tool = self._create_ocr_page_tool()
        self.ocr_multiple_pages_tool = self._create_ocr_multiple_pages_tool()
        self.section_info_tool = self._create_section_info_tool()

    def _get_openai_api_key(self):
        """
        Retrieve the OpenAI API key from environment variable (direct access).
        Returns:
            str: The OpenAI API key.
        """
        key = os.environ.get('OPENAI_API_KEY')
        if not key:
            logger.error("OPENAI_API_KEY environment variable not set")
        return key

    # --- tool factories unchanged ---
    def _create_ocr_text_tool(self):
        @function_tool()
        def get_all_ocr_text() -> str:
            if not self.ocr_data or 'pages' not in self.ocr_data:
                return None
            text_content = []
            for i, page in enumerate(self.ocr_data['pages'], 1):
                md = page.get('markdown')
                if md:
                    text_content.append(f"Page {i}:\n{md}")
            combined = "\n\n".join(text_content)
            return f"{combined}\n\nTotal pages: {len(self.ocr_data['pages'])}"
        return get_all_ocr_text

    def _create_ocr_page_tool(self):
        @function_tool()
        def get_ocr_text_for_page(page_index: int) -> str:
            if not self.ocr_data or 'pages' not in self.ocr_data:
                return f"ERROR: No OCR data"
            for page in self.ocr_data['pages']:
                if page.get('index') == page_index:
                    return page.get('markdown','')
            return f"ERROR: Page {page_index} not found"
        return get_ocr_text_for_page

    def _create_ocr_multiple_pages_tool(self):
        @function_tool()
        def get_ocr_text_for_pages(page_indices: list[int]) -> str:
            if not self.ocr_data or 'pages' not in self.ocr_data:
                return ""
            parts = []
            for idx in page_indices:
                for page in self.ocr_data['pages']:
                    if page.get('index') == idx:
                        parts.append(f"Page {idx+1}:\n{page.get('markdown','')}")
            return "\n\n".join(parts)
        return get_ocr_text_for_pages


    def _create_section_info_tool(self):
        sections_list = ', '.join(IEP_SECTIONS.keys())
        doc = f"Get key points for a section. Valid names: {sections_list}"
        @function_tool()
        def get_section_info(section_name: str) -> dict:
            if section_name not in IEP_SECTIONS:
                return {"error": f"Unknown section", "available_sections": list(IEP_SECTIONS.keys())}
            return {"section_name": section_name,
                    "description": IEP_SECTIONS[section_name],
                    "key_points": SECTION_KEY_POINTS.get(section_name, [])}
        get_section_info.__doc__ = doc
        return get_section_info

    def analyze_document(self, model="gpt-5.1"):
        """
        Analyze an IEP document in English only using GPT-5.1.
        Returns a dict matching SingleLanguageIEP schema.
        """
        if not self.api_key:
            return {"error": "API key missing"}
        if not self.ocr_data or 'pages' not in self.ocr_data:
            return {"error": "No OCR data"}

        prompt = get_english_only_prompt()

        # English-only analysis agent
        agent = Agent(
            name="IEP Document Analyzer",
            model=model,
            instructions=prompt,
            model_settings=ModelSettings(parallel_tool_calls=True),
            tools=[
                self.ocr_text_tool, 
                self.ocr_page_tool,
                self.ocr_multiple_pages_tool,
                self.section_info_tool
            ],
            output_type=SingleLanguageIEP
        )
            
        try:
            result = Runner.run_sync(
                agent, 
                "Analyze IEP document in English only according to instructions.",
                max_turns=150
            )
        except MaxTurnsExceeded as e:
            logger.error(f"Max turns exceeded: {str(e)}")
            return {"error": "Max turns exceeded"}

        # Parse & validate
        raw_output = result.final_output
        try:
            if isinstance(raw_output, str):
                cleaned = raw_output.replace('```json','').replace('```','').strip()
                parsed_data = json.loads(cleaned)
                parsed_data = self._ensure_complete_english_sections(parsed_data)
                data = SingleLanguageIEP.model_validate(parsed_data, strict=False)
            elif isinstance(raw_output, dict):
                raw_output = self._ensure_complete_english_sections(raw_output)
                data = SingleLanguageIEP.model_validate(raw_output, strict=False)
            elif isinstance(raw_output, SingleLanguageIEP):
                logger.info("Output is already a SingleLanguageIEP instance")
                data = raw_output
            else:
                output_type = type(raw_output).__name__
                logger.error(f"Unexpected output type: {output_type}")
                if raw_output is not None:
                    logger.error(f"Output preview: {str(raw_output)[:200]}")
                return {"error": f"Unexpected output type: {output_type}"}
            return data.model_dump()
        except Exception as e:
            logger.error(f"Validation error: {str(e)}")
            logger.error(traceback.format_exc(limit=3))
            return {"error": f"Validation failed: {str(e)}"}


    def _ensure_complete_english_sections(self, data):
        """
        Ensure all required IEP sections are present in English data.
        If a section is missing, add it with appropriate placeholder content.
        """
        required_sections = set(IEP_SECTIONS.keys())
        
        if 'sections' not in data:
            data['sections'] = []
        
        # Get existing section titles
        existing_titles = {section.get('title', '') for section in data['sections']}
        
        # Find missing sections
        missing_sections = required_sections - existing_titles
        
        # Add missing sections
        for missing_section in missing_sections:
            logger.warning(f"Adding missing section '{missing_section}' for English")
            placeholder_content = f"This section (_{missing_section}_) was not found in the provided IEP document."
            
            data['sections'].append({
                'title': missing_section,
                'content': placeholder_content,
                'page_numbers': [1]  # Default to page 1
            })
        
        return data

    def _ensure_complete_sections(self, data):
        """
        Ensure all required IEP sections are present in all languages.
        If a section is missing, add it with appropriate placeholder content.
        """
        required_sections = set(IEP_SECTIONS.keys())
        
        if 'sections' not in data:
            data['sections'] = {}
            
        for lang in ['en', 'es', 'vi', 'zh']:
            if lang not in data['sections']:
                data['sections'][lang] = []
            
            # Get existing section titles for this language
            existing_titles = {section.get('title', '') for section in data['sections'][lang]}
            
            # Find missing sections
            missing_sections = required_sections - existing_titles
            
            # Add missing sections
            for missing_section in missing_sections:
                logger.warning(f"Adding missing section '{missing_section}' for language '{lang}'")
                placeholder_content = f"This section (_{missing_section}_) was not found in the provided IEP document."
                
                data['sections'][lang].append({
                    'title': missing_section,
                    'content': placeholder_content,
                    'page_numbers': [1]  # Default to page 1
                })
        
        return data
