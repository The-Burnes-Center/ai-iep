import os
import boto3
import logging
import json
import traceback
from data_model import IEPData, TranslationOutput
from openai import OpenAI
from agents import Agent, Runner, function_tool, ModelSettings
from config import get_full_prompt, get_translation_prompt, IEP_SECTIONS, SECTION_KEY_POINTS, LANGUAGE_CODES
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
        # Tools
        self.ocr_text_tool = self._create_ocr_text_tool()
        self.ocr_page_tool = self._create_ocr_page_tool()
        self.ocr_multiple_pages_tool = self._create_ocr_multiple_pages_tool()
        self.language_context_tool = self._create_language_context_tool()
        self.section_info_tool = self._create_section_info_tool()

    def _get_openai_api_key(self):
        """
        Retrieve the OpenAI API key from environment or SSM.
        Returns:
            str: The OpenAI API key.
        """
        key = os.environ.get('OPENAI_API_KEY')
        if not key:
            logger.warning("OPENAI_API_KEY not in env, fetching from SSM")
            param = os.environ.get('OPENAI_API_KEY_PARAMETER_NAME')
            if param:
                ssm = boto3.client('ssm')
                resp = ssm.get_parameter(Name=param, WithDecryption=True)
                key = resp['Parameter']['Value']
                os.environ['OPENAI_API_KEY'] = key
        if not key:
            logger.error("No OpenAI API key available")
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

    def _create_language_context_tool(self):
        @function_tool()
        def get_language_context_for_translation(target_language: str) -> str:
            from config import get_language_context
            return get_language_context(target_language)
        return get_language_context_for_translation

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

    def analyze_document(self, model="gpt-4o"):
        """
        Analyze and translate an IEP document in one Agent run using GPT-4.1.
        Returns a dict matching IEPData schema.
        """
        if not self.api_key:
            return {"error": "API key missing"}
        if not self.ocr_data or 'pages' not in self.ocr_data:
            return {"error": "No OCR data"}

        prompt = get_full_prompt()
        translation_prompt = get_translation_prompt()

        # Translation tool agent
        translation_agent = Agent(
            name="Translation Agent",
            model=model,
            instructions=translation_prompt,
            tools=[self.language_context_tool],
            model_settings=ModelSettings(temperature=0.0), 
            output_type=TranslationOutput
        )
           
        # Main agent: analyze then translate_text
        agent = Agent(
            name="IEP Document Analyzer",
            model=model,
            instructions=prompt,
            model_settings=ModelSettings(parallel_tool_calls=True, temperature=0.0),
            tools=[
                self.ocr_text_tool, 
                self.ocr_page_tool,
                self.ocr_multiple_pages_tool,
                self.section_info_tool,
                translation_agent.as_tool(
                    tool_name="translate_text",
                    tool_description="Batch translate the English JSON into es/vi/zh"
                )
            ],
            output_type=IEPData
        )
            
        try:
            result = Runner.run_sync(
                agent, 
                "Analyze IEP and translate according to instructions.",
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
                data = IEPData.model_validate_json(cleaned, strict=False)
            elif isinstance(raw_output, dict):
                data = IEPData.model_validate(raw_output, strict=False)
            elif isinstance(raw_output, IEPData):
                # Already an IEPData instance, use it directly
                logger.info("Output is already an IEPData instance")
                data = raw_output
            else:
                # Simple logging of the unexpected output type
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
