"""
Generate English summary, sections, and document index using OpenAI
"""
import json
import traceback
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))
from shared_utils import update_progress, create_step_function_response, handle_step_error
from open_ai_agent import OpenAIAgent

def lambda_handler(event, context):
    """
    Generate English-only analysis using OpenAI.
    Updates progress=65, current_step="analyze_english"
    """
    print(f"ParsingAgent handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id'] 
        child_id = event['child_id']
        redacted_ocr_result = event.get('redacted_ocr_result')
        
        print(f"Starting English analysis for iepId: {iep_id}")
        
        # Update progress to English analysis stage
        update_progress(
            iep_id=iep_id,
            child_id=child_id,
            progress=65,
            current_step="analyze_english"
        )
        
        # Create OpenAI Agent with redacted OCR data
        agent = OpenAIAgent(ocr_data=redacted_ocr_result)
        
        # Analyze the document in English only
        print("Starting English-only document analysis...")
        english_result = agent.analyze_document()
        
        # Check for error in the English analysis
        if "error" in english_result:
            error_message = f"English document analysis failed: {english_result.get('error')}"
            print(error_message)
            raise Exception(error_message)
        
        print(f"English analysis completed for iepId: {iep_id}")
        print(f"Generated {len(english_result.get('sections', []))} sections")
        
        # Return event with English analysis results
        response = create_step_function_response(event)
        response['english_result'] = english_result
        response['progress'] = 65
        response['current_step'] = "analyze_english"
        
        return response
        
    except Exception as e:
        print(f"Error in ParsingAgent: {str(e)}")
        print(traceback.format_exc())
        
        iep_id = event.get('iep_id', 'unknown')
        child_id = event.get('child_id', 'unknown')
        
        return handle_step_error(iep_id, child_id, "ParsingAgent", e, 65)
