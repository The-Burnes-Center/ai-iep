import os
import boto3
import logging
import json
import traceback
import asyncio
from typing import Dict, List, Optional, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from data_model import IEPData, TranslationOutput
from openai import OpenAI
from agents import Agent, Runner, function_tool, ModelSettings
from config import get_full_prompt, get_translation_prompt, IEP_SECTIONS, SECTION_KEY_POINTS, LANGUAGE_CODES
from agents.exceptions import MaxTurnsExceeded

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MultiAgentOrchestrator:
    """
    Multi-agent orchestration system with specialized agents for each task.
    Preserves all existing prompts and instructions while enabling parallel processing.
    """
    
    def __init__(self, ocr_data=None):
        """
        Initialize the orchestrator with OCR data and create all specialized agents.
        Args:
            ocr_data (dict, optional): OCR data from Mistral OCR API
        """
        self.ocr_data = ocr_data
        self.api_key = self._get_openai_api_key()
        
        # Create base OCR tools (unchanged from original)
        self.ocr_text_tool = self._create_ocr_text_tool()
        self.ocr_page_tool = self._create_ocr_page_tool()
        self.ocr_multiple_pages_tool = self._create_ocr_multiple_pages_tool()
        self.language_context_tool = self._create_language_context_tool()
        self.section_info_tool = self._create_section_info_tool()
        
        # Create specialized agent tools
        self.section_agents = self._create_section_agent_tools()
        self.summary_agent_tool = self._create_summary_agent_tool()
        self.document_index_agent_tool = self._create_document_index_agent_tool()
        self.markdown_formatting_agent_tool = self._create_markdown_formatting_agent_tool()
        self.translation_agent_tool = self._create_translation_agent_tool()
        self.json_validation_agent_tool = self._create_json_validation_agent_tool()
        
        # Create main orchestration agent
        self.orchestration_agent = self._create_orchestration_agent()

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

    # === Original OCR Tools (unchanged) ===
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

    # === Specialized Agent Tools ===
    
    def _create_section_agent_tools(self):
        """Create dedicated agents for each IEP section that can run in parallel"""
        section_agents = {}
        
        for section_name in IEP_SECTIONS.keys():
            # Create individual section extraction agent
            section_agent = Agent(
                name=f"Section Extraction Agent - {section_name}",
                model="gpt-4o",
                instructions=f"""
                You are a specialist in extracting '{section_name}' content from IEP documents.
                
                Section Requirements:
                {SECTION_KEY_POINTS.get(section_name, f"Extract content related to {section_name}")}
                
                Your tasks:
                1. Use the available OCR tools to search for content related to {section_name}
                2. Extract all relevant information for this section
                3. Preserve important details and context
                4. Maintain source attribution (page numbers where content was found)
                5. Return structured content with confidence assessment
                
                Return the extracted content in this format:
                {{
                    "section": "{section_name}",
                    "content": "extracted content here",
                    "page_numbers": [list of page numbers],
                    "confidence_score": 0.0-1.0,
                    "extraction_notes": "any relevant notes"
                }}
                
                If no relevant content is found, return status='not_found' and explain why.
                """,
                tools=[
                    self.ocr_text_tool,
                    self.ocr_page_tool,
                    self.ocr_multiple_pages_tool,
                    self.section_info_tool
                ],
                model_settings=ModelSettings(temperature=0.0)
            )
            
            # Convert agent to tool
            section_tool = section_agent.as_tool(
                tool_name=f"extract_{section_name.lower().replace(' ', '_')}_section",
                tool_description=f"Extract content for the {section_name} section of the IEP"
            )
            
            section_agents[section_name] = section_tool
        
        return section_agents

    def _create_summary_agent_tool(self):
        """Create specialized agent for generating IEP summaries"""
        summary_agent = Agent(
            name="IEP Summary Agent",
            model="gpt-4o",
            instructions="""
            You are a specialist in creating parent-friendly IEP summaries.
            
            Your task is to create a detailed English summary of the IEP that will be read by parents.
            The summary should:
            
            1. Explain the IEP to the parent in accessible language
            2. Highlight key information from all sections
            3. Use a warm, supportive tone
            4. Maintain 8th-grade reading level
            5. Focus on what this means for their child's education
            
            Input: You will receive extracted section content from all IEP sections
            Output: A comprehensive, parent-friendly summary explaining their child's IEP
            
            The summary should help parents understand:
            - Their child's current performance levels
            - Goals for the year
            - Services their child will receive
            - How progress will be measured
            - Who is involved in their child's education
            """,
            model_settings=ModelSettings(temperature=0.1)
        )
        
        return summary_agent.as_tool(
            tool_name="generate_iep_summary",
            tool_description="Generate a comprehensive, parent-friendly summary of the IEP"
        )

    def _create_document_index_agent_tool(self):
        """Create specialized agent for generating document index"""
        index_agent = Agent(
            name="Document Index Agent", 
            model="gpt-4o",
            instructions="""
            You are a specialist in creating document indexes (Table of Contents) for IEP documents.
            
            Your task is to create a detailed English document index that shows:
            1. Page numbers where each section can be found
            2. Clear section organization
            3. Easy navigation for parents
            
            Format the index as: "Page X: Section Name" or "Pages X-Y: Section Name"
            
            Input: You will receive section content with page number information
            Output: A clear, organized document index in the format:
            
            ## Document Index
            
            • Present Levels: Pages 1-3
            • Goals: Pages 4-6
            • Services: Page 7
            etc.
            
            Make it easy for parents to find specific information in their child's IEP.
            """,
            model_settings=ModelSettings(temperature=0.0)
        )
        
        return index_agent.as_tool(
            tool_name="generate_document_index",
            tool_description="Generate a detailed document index (Table of Contents) for the IEP"
        )

    def _create_markdown_formatting_agent_tool(self):
        """Create specialized agent for markdown formatting"""
        formatting_agent = Agent(
            name="Markdown Formatting Agent",
            model="gpt-4o",
            instructions="""
            You are a content formatting specialist focused on creating parent-friendly IEP content.
            
            Your responsibilities:
            1. Convert raw extracted content into well-formatted Markdown
            2. Break large paragraphs into readable sections
            3. Add introductory summaries for each section
            4. Use appropriate formatting: **bold**, *italic*, bullet points, tables
            5. Create abbreviation legends when needed
            6. Maintain a warm, friendly tone
            7. Ensure 8th-grade reading level
            
            Formatting Guidelines:
            - Start each section with a brief summary paragraph
            - Use bullet points for lists and key information
            - Create tables for structured data (goals, services, etc.)
            - Bold important terms and concepts
            - Include page references where content was found
            - Add abbreviation tables at the end if acronyms are used
            
            Input: Raw extracted section content
            Output: Properly formatted Markdown content ready for parent consumption
            
            The content should be warm, accessible, and help parents understand their child's educational plan.
            """,
            model_settings=ModelSettings(temperature=0.1)
        )
        
        return formatting_agent.as_tool(
            tool_name="format_content_as_markdown",
            tool_description="Format extracted content into parent-friendly Markdown with proper structure and styling"
        )

    def _create_translation_agent_tool(self):
        """Create specialized translation agent (using existing translation prompt)"""
        translation_agent = Agent(
            name="Translation Agent",
            model="gpt-4.1",
            instructions=get_translation_prompt(),  # Using existing translation prompt
            tools=[self.language_context_tool],
            model_settings=ModelSettings(temperature=0.0),
            output_type=TranslationOutput
        )
        
        return translation_agent.as_tool(
            tool_name="translate_text",
            tool_description="Batch translate the English JSON into es/vi/zh"
        )

    def _create_json_validation_agent_tool(self):
        """Create specialized JSON validation agent"""
        validation_agent = Agent(
            name="JSON Validation Agent",
            model="gpt-4o",
            instructions="""
            You are a JSON validation and completion specialist for IEP documents.
            
            Your responsibilities:
            1. Validate that all required IEP sections are present
            2. Ensure JSON structure matches the required IEPData schema
            3. Add placeholder content for any missing sections
            4. Verify all required fields are populated
            5. Ensure data integrity and consistency
            
            Required IEP sections that must be present:
            - Present Levels
            - Eligibility  
            - Placement
            - Goals
            - Services
            - Informed Consent
            - Accommodations
            - Key People
            - Strengths
            
            If any section is missing, add it with appropriate placeholder content explaining
            that the section was not found in the provided document.
            
            Input: Processed IEP data (sections, summary, index)
            Output: Complete, valid JSON structure ready for final output
            
            Always ensure the output can be successfully validated against the IEPData schema.
            """,
            model_settings=ModelSettings(temperature=0.0)
        )
        
        return validation_agent.as_tool(
            tool_name="validate_and_complete_json",
            tool_description="Validate JSON structure and ensure all required sections are present with proper formatting"
        )

    def _create_orchestration_agent(self):
        """Create the main orchestration agent that coordinates all other agents"""
        
        # Collect all tools for the orchestration agent
        all_tools = [
            self.ocr_text_tool,
            self.ocr_page_tool, 
            self.ocr_multiple_pages_tool,
            self.section_info_tool,
            self.summary_agent_tool,
            self.document_index_agent_tool,
            self.markdown_formatting_agent_tool,
            self.translation_agent_tool,
            self.json_validation_agent_tool
        ]
        
        # Add all section agent tools
        all_tools.extend(self.section_agents.values())
        
        orchestration_instructions = """
        You are the IEP Document Processing Orchestration Agent.
        
        Your job is to coordinate specialized agents to process an IEP document through the following workflow:
        
        PHASE 1: PARALLEL SECTION EXTRACTION
        - Use the section extraction agents to extract content for ALL 9 required sections in parallel
        - Each section has a dedicated agent: extract_present_levels_section, extract_goals_section, etc.
        - Run all section extractions simultaneously for maximum efficiency
        
        PHASE 2: CONTENT PROCESSING  
        - Use format_content_as_markdown to format all extracted section content
        - Use generate_iep_summary to create a comprehensive parent-friendly summary
        - Use generate_document_index to create a detailed table of contents
        
        PHASE 3: TRANSLATION
        - Use translate_text to translate all English content into Spanish, Vietnamese, and Chinese
        
        PHASE 4: VALIDATION & COMPLETION
        - Use validate_and_complete_json to ensure the final JSON is complete and valid
        - Ensure all required sections are present with appropriate placeholders if needed
        
        WORKFLOW EXECUTION:
        1. Start by getting the full OCR text to understand the document
        2. Execute ALL section extractions in parallel (9 agents simultaneously)
        3. Format the extracted content and generate summary/index
        4. Translate everything into multiple languages  
        5. Validate and complete the final JSON structure
        
        IMPORTANT: 
        - Always process ALL 9 required IEP sections
        - Use parallel execution for section extractions to maximize efficiency
        - Ensure error recovery - if a section fails, continue with others
        - Maintain data integrity throughout the process
        - Always return a complete, valid JSON structure
        
        Your goal is to produce a complete IEPData structure with all sections, summaries, and translations.
        """
        
        return Agent(
            name="IEP Processing Orchestration Agent",
            model="gpt-4.1",
            instructions=orchestration_instructions,
            tools=all_tools,
            model_settings=ModelSettings(parallel_tool_calls=True, temperature=0.0),
            output_type=IEPData
        )

    def analyze_document(self, model="gpt-4.1"):
        """
        Orchestrate the complete IEP document analysis using specialized agents.
        Returns a dict matching IEPData schema.
        """
        if not self.api_key:
            return {"error": "API key missing"}
        if not self.ocr_data or 'pages' not in self.ocr_data:
            return {"error": "No OCR data"}

        logger.info("Starting multi-agent orchestrated IEP analysis")
        
        try:
            # Run the orchestration agent with error recovery
            result = Runner.run_sync(
                self.orchestration_agent,
                "Process the IEP document using all specialized agents in the correct workflow sequence.",
                max_turns=200  # Increased for multi-agent coordination
            )
            
            logger.info("Multi-agent processing completed successfully")
            
        except MaxTurnsExceeded as e:
            logger.error(f"Max turns exceeded in orchestration: {str(e)}")
            return self._create_partial_recovery_result("Max turns exceeded during processing")
        except Exception as e:
            logger.error(f"Orchestration failed: {str(e)}")
            return self._create_partial_recovery_result(f"Processing error: {str(e)}")

        # Parse & validate the orchestrated result
        raw_output = result.final_output
        try:
            if isinstance(raw_output, str):
                cleaned = raw_output.replace('```json','').replace('```','').strip()
                parsed_data = json.loads(cleaned)
                parsed_data = self._ensure_complete_sections(parsed_data)
                data = IEPData.model_validate(parsed_data, strict=False)
            elif isinstance(raw_output, dict):
                raw_output = self._ensure_complete_sections(raw_output)
                data = IEPData.model_validate(raw_output, strict=False)
            elif isinstance(raw_output, IEPData):
                logger.info("Output is already an IEPData instance")
                data = raw_output
            else:
                output_type = type(raw_output).__name__
                logger.error(f"Unexpected output type: {output_type}")
                if raw_output is not None:
                    logger.error(f"Output preview: {str(raw_output)[:200]}")
                return self._create_partial_recovery_result(f"Unexpected output type: {output_type}")
            
            return data.model_dump()
            
        except Exception as e:
            logger.error(f"Validation error: {str(e)}")
            logger.error(traceback.format_exc(limit=3))
            return self._create_partial_recovery_result(f"Validation failed: {str(e)}")

    def _create_partial_recovery_result(self, error_message: str):
        """Create a partial result when full processing fails"""
        logger.warning(f"Creating partial recovery result due to: {error_message}")
        
        # Try to extract at least basic information
        try:
            basic_sections = []
            
            # Create placeholder sections
            for section_name in IEP_SECTIONS.keys():
                basic_sections.append({
                    'title': section_name,
                    'content': f"This section ({section_name}) could not be processed due to technical difficulties. Please contact the school for complete information.",
                    'page_numbers': [1]
                })
            
            recovery_data = {
                'summaries': {
                    'en': f"Document processing encountered an error: {error_message}. This is a partial recovery result with placeholder content. Please contact the school for the complete IEP document.",
                    'es': f"El procesamiento del documento encontró un error: {error_message}. Este es un resultado de recuperación parcial con contenido de marcador de posición.",
                    'vi': f"Xử lý tài liệu gặp lỗi: {error_message}. Đây là kết quả phục hồi một phần với nội dung giữ chỗ.",
                    'zh': f"文档处理遇到错误：{error_message}。这是带有占位符内容的部分恢复结果。"
                },
                'sections': {
                    'en': basic_sections,
                    'es': basic_sections,  # Would need translation in full implementation
                    'vi': basic_sections,
                    'zh': basic_sections
                },
                'document_index': {
                    'en': "Document index could not be generated due to processing error.",
                    'es': "No se pudo generar el índice del documento debido a un error de procesamiento.",
                    'vi': "Không thể tạo chỉ mục tài liệu do lỗi xử lý.",
                    'zh': "由于处理错误，无法生成文档索引。"
                }
            }
            
            # Validate the recovery data
            validated_data = IEPData.model_validate(recovery_data, strict=False)
            return validated_data.model_dump()
            
        except Exception as validation_error:
            logger.error(f"Even partial recovery failed: {validation_error}")
            return {
                "error": f"Complete processing failure. Original error: {error_message}. Recovery error: {str(validation_error)}",
                "partial_data_available": False,
                "recommendation": "Manual processing required"
            }

    def _ensure_complete_sections(self, data):
        """
        Ensure all required IEP sections are present in all languages.
        If a section is missing, add it with appropriate placeholder content.
        (Unchanged from original implementation)
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


# Usage remains the same as the original OpenAIAgent
class OpenAIAgent(MultiAgentOrchestrator):
    """
    Backward compatibility wrapper that maintains the same interface
    while using the new multi-agent orchestration under the hood.
    """
    pass 