import os
import boto3
import logging
import json
import traceback
from data_model import IEPData, TranslationOutput, SingleLanguageIEP
from openai import OpenAI
from agents import Agent, Runner, function_tool, ModelSettings
from config import get_translation_prompt, get_english_only_prompt, get_translation_prompt_missing_info, IEP_SECTIONS, SECTION_KEY_POINTS, LANGUAGE_CODES
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

    def analyze_document(self, model="gpt-4.1"):
        """
        Analyze an IEP document in English only using GPT-4.1.
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
            model_settings=ModelSettings(parallel_tool_calls=True, temperature=0.0),
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

    def translate_content(self, content, target_language, content_type="parsing_result", model="gpt-4.1"):
        """
        Translate content to a single target language with content-type-specific prompts.
        
        Args:
            content (dict): Content to translate (parsing result or missing info)
            target_language (str): Single target language code ('es', 'vi', 'zh')
            content_type (str): Type of content - 'parsing_result' or 'missing_info'
            model (str): OpenAI model to use
            
        Returns:
            dict: Translated content in the same structure
        """
        try:
            client = OpenAI(api_key=self.api_key)
            
            # Dynamically select base prompt based on content type from config
            if content_type == 'parsing_result':
                # Adapt the existing parsing translation approach for single language
                system_prompt = f"""
You are a multi-language translation agent using GPT-4.1.
Your input is a JSON object with English IEP parsing content (summaries, sections, document_index, abbreviations).

Translation Task: Translate the English content to {target_language} while preserving structure.

Guidelines:
- Translate all text content while preserving the JSON structure
- Do not translate JSON keys or section titles (e.g., keep "Present Levels", "Goals", "Services")  
- Maintain the same data structure and field names
- Use appropriate cultural context for {target_language} and maintain 8th-grade reading level
- Preserve all page numbers, dates, and numerical values
- For abbreviations: translate full forms, keep abbreviation codes in English
- Do not include extra keys or commentary—output only the valid JSON

Cultural Guidelines for {target_language}:
""" + self._get_language_guidelines(target_language)
                
            elif content_type == 'missing_info':
                system_prompt = f"""
You are a multi-language translation agent using GPT-4.1 specializing in parent communication.
Your input is a JSON object with missing information items that help parents understand what's needed for their child's IEP.

Translation Task: Translate the missing info content to {target_language} while maintaining a supportive, parent-friendly tone.

Guidelines:
- Translate all text fields (descriptions, suggestions) while preserving the JSON structure
- Do not translate field names (e.g., "iepId", "items", "description", "suggestion") 
- Use appropriate cultural context for {target_language} and maintain 8th-grade reading level
- Be supportive and encouraging (never judgmental)
- Emphasize collaboration between parents and school
- Keep all IDs and structural elements unchanged
- Do not include extra keys or commentary—output only the valid JSON

Cultural Guidelines for {target_language}:
""" + self._get_language_guidelines(target_language)
                
            else:
                # Fallback for unknown content types
                system_prompt = f"""
You are a professional translator specializing in educational documents.
Translate all text content from English to {target_language} while preserving the original structure and maintaining 8th-grade reading level.
Return only the translated content in the same format.
"""
            
            # Create user prompt with content
            user_prompt = f"""
Content to translate:

{json.dumps(content, indent=2)}
"""
            
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1
            )
            
            translated_text = response.choices[0].message.content
            
            # Clean and parse the response
            cleaned = translated_text.replace('```json', '').replace('```', '').strip()
            
            try:
                translated_content = json.loads(cleaned)
                return translated_content
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse translation response: {e}")
                return {"error": f"Translation parsing failed: {str(e)}"}
                
        except Exception as e:
            logger.error(f"Translation failed: {str(e)}")
            return {"error": f"Translation failed: {str(e)}"}

    def _get_language_guidelines(self, target_language):
        """Get cultural and linguistic guidelines for specific target language"""
        guidelines = {
            'es': "- Use formal but warm tone, educational terminology familiar to Hispanic families\n- Respect for family values and educational process\n- Clear, direct communication style",
            'vi': "- Respectful tone, avoid complex grammatical structures\n- Community-focused, family-respectful approach\n- Simple, clear sentence structures", 
            'zh': "- Use simplified characters, respectful educational language\n- Formal respect for education, emphasis on student success\n- Clear, structured communication"
        }
        return guidelines.get(target_language, "- Use appropriate cultural context and clear language")

    def translate_document(self, english_data, target_languages=None, model="gpt-4.1"):
        """
        Translate English IEP data into specified languages and create final IEPData structure.
        
        Args:
            english_data (dict): English-only IEP data matching SingleLanguageIEP schema
            target_languages (list): List of language codes to translate to (default: ['es', 'vi', 'zh'])
            model (str): Model to use for translation
            
        Returns:
            dict: Complete IEPData with English and translated languages
        """
        if not self.api_key:
            return {"error": "API key missing"}
        
        if not english_data:
            return {"error": "No English data provided"}
        
        # Default to all languages if not specified
        if target_languages is None:
            target_languages = ['es', 'vi', 'zh']
        
        # Remove English from target languages if present (since we already have English data)
        target_languages = [lang for lang in target_languages if lang != 'en']
        
        # If no target languages, return just English data
        if not target_languages:
            return {
                "summaries": {"en": english_data["summary"]},
                "sections": {"en": english_data["sections"]},
                "document_index": {"en": english_data["document_index"]}
            }

        print(f"Translating to languages: {target_languages}")
        translation_prompt = get_translation_prompt()

        # Translation agent
        translation_agent = Agent(
            name="Translation Agent",
            model=model,
            instructions=translation_prompt,
            tools=[self.language_context_tool],
            model_settings=ModelSettings(temperature=0.0), 
            output_type=TranslationOutput
        )

        # Create input for translation agent
        english_input = {
            "summaries": {"en": english_data["summary"]},
            "sections": {"en": english_data["sections"]},
            "document_index": {"en": english_data["document_index"]},
            # Pass English abbreviations so the translation agent can translate them
            "abbreviations": {"en": english_data.get("abbreviations", [])}
        }

        try:
            language_names = {
                'es': 'Spanish',
                'vi': 'Vietnamese', 
                'zh': 'Chinese'
            }
            target_lang_names = [language_names.get(lang, lang) for lang in target_languages]
            lang_list = ', '.join(target_lang_names)
            
            result = Runner.run_sync(
                translation_agent,
                f"Translate this English IEP data into {lang_list}: {json.dumps(english_input)}",
                max_turns=50
            )
        except MaxTurnsExceeded as e:
            logger.error(f"Translation max turns exceeded: {str(e)}")
            return {"error": "Translation max turns exceeded"}

        # Parse translation result
        raw_output = result.final_output
        try:
            if isinstance(raw_output, str):
                cleaned = raw_output.replace('```json','').replace('```','').strip()
                translation_data = json.loads(cleaned)
            elif isinstance(raw_output, dict):
                translation_data = raw_output
            elif isinstance(raw_output, TranslationOutput):
                translation_data = raw_output.model_dump()
            else:
                output_type = type(raw_output).__name__
                logger.error(f"Unexpected translation output type: {output_type}")
                return {"error": f"Unexpected translation output type: {output_type}"}

            # Merge English and translated data for target languages only
            final_data = {
                "summaries": {"en": english_data["summary"]},
                "sections": {"en": english_data["sections"]},
                "document_index": {"en": english_data["document_index"]},
                # Always include English abbreviations
                "abbreviations": {"en": english_data.get("abbreviations", [])}
            }
            
            # Add translations for target languages
            for lang in target_languages:
                if lang in translation_data.get("summaries", {}):
                    final_data["summaries"][lang] = translation_data["summaries"][lang]
                if lang in translation_data.get("sections", {}):
                    final_data["sections"][lang] = translation_data["sections"][lang]
                if lang in translation_data.get("document_index", {}):
                    final_data["document_index"][lang] = translation_data["document_index"][lang]
                if lang in translation_data.get("abbreviations", {}):
                    final_data["abbreviations"][lang] = translation_data["abbreviations"][lang]

            # Return the final data without strict validation since we have dynamic languages
            # The data structure will be validated when it's stored in DynamoDB
            return final_data

        except Exception as e:
            logger.error(f"Translation validation error: {str(e)}")
            logger.error(traceback.format_exc(limit=3))
            return {"error": f"Translation validation failed: {str(e)}"}

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
