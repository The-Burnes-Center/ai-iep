import os
import boto3
import logging
import json
from datetime import datetime
from openai import OpenAI
# Correct imports for openai-agents package
from agents import Agent, Runner
from config import get_full_prompt, get_all_tags, IEP_SECTIONS, get_translation_prompt, clean_translation

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_openai_api_key():
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

def analyze_document_with_agent(text, model="gpt-4o"):
    """
    Analyze an IEP document using OpenAI's Agent architecture.
    
    Args:
        text (str): The document text content to be analyzed
        model (str): The OpenAI model to use, defaults to gpt-4o
        
    Returns:
        dict: Analysis results from the agent
    """
    api_key = get_openai_api_key()
    if not api_key:
        logger.error("OpenAI API key not available, cannot process document")
        return {"error": "OpenAI API key not available"}
    
    try:
        # API key should already be set in environment by the Lambda
        logger.info(f"Creating agent for document analysis using {model}")
        
        # Get the prompt from config.py
        prompt = get_full_prompt("IEP Document", text)
        
        # Create an agent for document analysis using the agents package
        agent = Agent(
            name="IEP Document Analyzer",
            model=model,
            instructions=prompt
        )
        
        # Run the agent
        result = Runner.run_sync(agent, "Please analyze this IEP document according to the instructions.")
        
        logger.info("Agent completed analysis")
        
        # Extract the final output
        analysis_text = result.final_output
        
        # Try to parse any JSON in the response
        try:
            # Look for JSON within the text
            json_start = analysis_text.find('{')
            json_end = analysis_text.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = analysis_text[json_start:json_end]
                analysis_result = json.loads(json_str)
            else:
                # If no JSON found, use the whole text as a summary
                analysis_result = {
                    "summary": analysis_text,
                    "sections": []
                }
        except json.JSONDecodeError:
            # If JSON parsing fails, use the text as a summary
            analysis_result = {
                "summary": analysis_text,
                "sections": []
            }
        
        logger.info(f"Successfully analyzed document with OpenAI Agent")
        return analysis_result
            
    except Exception as e:
        logger.error(f"Error analyzing document with OpenAI Agent: {str(e)}")
        return {"error": str(e)}

def translate_with_agent(content, target_language, model="gpt-4o"):
    """
    Translate content using OpenAI's Agent architecture.
    
    Args:
        content (str or dict): The content to translate
        target_language (str): The target language code
        model (str): The OpenAI model to use, defaults to gpt-4o
        
    Returns:
        str or dict: Translated content
    """
    api_key = get_openai_api_key()
    if not api_key:
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
        
        # Clean up the translation to remove any JSON structure or explanatory text
        translated_text = clean_translation(translated_text)
        
        logger.info(f"Successfully translated content to {target_language}")
        return translated_text.strip()
            
    except Exception as e:
        logger.error(f"Error translating content with OpenAI Agent: {str(e)}")
        return {"error": str(e)}
