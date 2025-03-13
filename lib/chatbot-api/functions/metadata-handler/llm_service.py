import os
import json
import boto3
import logging
import traceback
from enum import Enum

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Boto3 clients
bedrock_runtime = boto3.client('bedrock-runtime')

# Configure default models
CLAUDE_MODELS = {
    "default": os.environ.get('ANTHROPIC_MODEL', 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
    "sonnet_3_7": os.environ.get('ANTHROPIC_MODEL_3_7', 'anthropic.claude-3-7-sonnet-20250219-v1:0')
}

class LLMProvider(Enum):
    """Enum representing different LLM providers."""
    CLAUDE = "claude"
    OPENAI = "openai"  # Placeholder for future integration

class LLMService:
    """Service for interacting with various LLM providers."""
    
    @staticmethod
    def invoke_llm(
        prompt, 
        temperature=0, 
        max_tokens=8000, 
        provider=LLMProvider.CLAUDE,
        model=None
    ):
        """
        Invoke a language model with the given prompt.
        
        Args:
            prompt: The prompt to send to the language model
            temperature: Temperature setting for response generation (default: 0)
            max_tokens: Maximum tokens in the response (default: 8000)
            provider: LLM provider to use (default: Claude)
            model: Specific model to use (defaults to the configured model for the provider)
        
        Returns:
            str: LLM's text response
        
        Raises:
            Exception: If there's an error invoking the LLM
        """
        if provider == LLMProvider.CLAUDE:
            return LLMService._invoke_claude(prompt, temperature, max_tokens, model)
        elif provider == LLMProvider.OPENAI:
            # Placeholder for future OpenAI implementation
            raise NotImplementedError("OpenAI integration not yet implemented")
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")
    
    @staticmethod
    def _invoke_claude(prompt, temperature=0, max_tokens=8000, model=None):
        """
        Invoke Claude model with the given prompt.
        
        Args:
            prompt: The prompt to send to Claude
            temperature: Temperature setting for response generation (default: 0)
            max_tokens: Maximum tokens in the response (default: 8000)
            model: Specific Claude model to use (defaults to the configured model)
        
        Returns:
            str: Claude's text response
        
        Raises:
            Exception: If there's an error invoking Claude
        """
        if model is None:
            model = CLAUDE_MODELS["default"]  # Use Claude 3.5 Sonnet by default
            
        try:
            # Call Claude
            response = bedrock_runtime.invoke_model(
                modelId=model,
                body=json.dumps({
                    'anthropic_version': 'bedrock-2023-05-31',
                    'max_tokens': max_tokens,
                    'temperature': temperature,
                    'messages': [
                        {'role': 'user', 'content': prompt}
                    ]
                })
            )
            
            # Parse the response
            response_body = json.loads(response['body'].read().decode('utf-8'))
            
            # Extract the content
            content = ""
            if 'content' in response_body:
                if isinstance(response_body['content'], list):
                    for block in response_body['content']:
                        if 'text' in block:
                            content += block['text']
                else:
                    content = response_body['content']
            elif 'completion' in response_body:
                content = response_body['completion']
                
            return content
        
        except Exception as e:
            logger.error(f"Error invoking Claude: {str(e)}")
            traceback.print_exc()
            raise

# Convenience functions with default settings
def invoke_llm(prompt, temperature=0, max_tokens=8000, provider=LLMProvider.CLAUDE, model=None):
    """
    Convenience function to invoke a language model.
    See LLMService.invoke_llm for full documentation.
    """
    return LLMService.invoke_llm(prompt, temperature, max_tokens, provider, model)

def invoke_claude(prompt, temperature=0, max_tokens=8000, model=None):
    """
    Convenience function to invoke Claude.
    This function maintains backward compatibility with existing code.
    """
    return LLMService._invoke_claude(prompt, temperature, max_tokens, model)

def invoke_claude_3_5(prompt, temperature=0, max_tokens=8000):
    """Invoke Claude 3.5 Sonnet model (default)"""
    return invoke_claude(prompt, temperature, max_tokens, CLAUDE_MODELS["default"])

def invoke_claude_3_7(prompt, temperature=0, max_tokens=8000):
    """Invoke Claude 3.7 Sonnet model"""
    return invoke_claude(prompt, temperature, max_tokens, CLAUDE_MODELS["sonnet_3_7"])

# Future function for OpenAI integration
# def invoke_openai(prompt, temperature=0, max_tokens=8000, model="gpt-4"):
#     pass 