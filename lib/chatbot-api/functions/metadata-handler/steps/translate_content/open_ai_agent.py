import os
import boto3
import logging
import json
from openai import OpenAI
from config import get_translation_prompt
from data_model import TranslationSectionContent, AbbreviationLegend, MissingInfoTranslation

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OpenAIAgent:
    def __init__(self):
        """Initialize the OpenAIAgent for translation only."""
        self.api_key = self._get_openai_api_key()

    def _get_openai_api_key(self):
        """Retrieve the OpenAI API key from environment or SSM."""
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

    def translate_content(self, content, target_language, content_type="parsing_result", model="gpt-4.1"):
        """
        Translate content to a single target language.
        
        Args:
            content (dict): Content to translate
            target_language (str): Target language code ('es', 'vi', 'zh')
            content_type (str): Type of content - 'parsing_result' or 'missing_info'
            model (str): OpenAI model to use
            
        Returns:
            dict: Translated content
        """
        try:
            client = OpenAI(api_key=self.api_key)
            
            # Get the unified translation prompt
            system_prompt = get_translation_prompt(target_language, content_type)
            
            user_prompt = f"Content to translate:\n\n{json.dumps(content, indent=2)}"
            
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1
            )
            
            translated_text = response.choices[0].message.content
            cleaned = translated_text.replace('```json', '').replace('```', '').strip()
            
            try:
                translated_content = json.loads(cleaned)
                
                # Optional validation based on content type
                if content_type == 'parsing_result':
                    validated_content = self._validate_parsing_result(translated_content)
                    return validated_content
                elif content_type == 'missing_info':
                    validated_content = self._validate_missing_info(translated_content)
                    return validated_content
                else:
                    return translated_content
                    
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse translation response: {e}")
                return {"error": f"Translation parsing failed: {str(e)}"}
                
        except Exception as e:
            logger.error(f"Translation failed: {str(e)}")
            return {"error": f"Translation failed: {str(e)}"}

    def _validate_parsing_result(self, content):
        """
        Validate translation output structure for parsing results.
        Uses Pydantic models to ensure proper format.
        """
        try:
            # Validate sections if present
            if 'sections' in content and isinstance(content['sections'], list):
                validated_sections = []
                for section in content['sections']:
                    try:
                        validated_section = TranslationSectionContent.model_validate(section)
                        validated_sections.append(validated_section.model_dump())
                    except Exception as e:
                        logger.warning(f"Section validation failed: {e}")
                        # Keep original if validation fails
                        validated_sections.append(section)
                content['sections'] = validated_sections
            
            # Validate abbreviations if present
            if 'abbreviations' in content and isinstance(content['abbreviations'], list):
                validated_abbreviations = []
                for abbrev in content['abbreviations']:
                    try:
                        validated_abbrev = AbbreviationLegend.model_validate(abbrev)
                        validated_abbreviations.append(validated_abbrev.model_dump())
                    except Exception as e:
                        logger.warning(f"Abbreviation validation failed: {e}")
                        # Keep original if validation fails
                        validated_abbreviations.append(abbrev)
                content['abbreviations'] = validated_abbreviations
            
            logger.info("Translation content validation completed")
            return content
            
        except Exception as e:
            logger.warning(f"Validation failed, returning original content: {e}")
            return content

    def _validate_missing_info(self, content):
        """
        Validate translation output structure for missing info.
        Uses Pydantic models to ensure proper format.
        """
        try:
            # Validate the entire missing info structure
            validated_missing_info = MissingInfoTranslation.model_validate(content)
            logger.info("Missing info translation validation completed")
            return validated_missing_info.model_dump()
            
        except Exception as e:
            logger.warning(f"Missing info validation failed, returning original content: {e}")
            return content

