"""
Generate English summary, sections, and document index using OpenAI - Core business logic only
"""
import json
import traceback
from open_ai_agent import OpenAIAgent

def lambda_handler(event, context):
    """
    Generate English-only analysis using OpenAI.
    Core analysis logic only - DDB operations handled by centralized service.
    """
    print(f"ParsingAgent handler received: {json.dumps(event)}")
    
    try:
        redacted_ocr_result = event.get('redacted_ocr_result')
        
        print("Starting English-only document analysis...")
        
        # Create OpenAI Agent with redacted OCR data
        agent = OpenAIAgent(ocr_data=redacted_ocr_result)
        
        # Analyze the document in English only
        english_result = agent.analyze_document()
        
        # Check for error in the English analysis
        if "error" in english_result:
            error_message = f"English document analysis failed: {english_result.get('error')}"
            print(error_message)
            raise Exception(error_message)
        
        print(f"English analysis completed. Generated {len(english_result.get('sections', []))} sections")
        
        # Return event with English analysis results
        return {
            **event,  # Pass through all input data
            'english_result': english_result
        }
        
    except Exception as e:
        print(f"ParsingAgent error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error