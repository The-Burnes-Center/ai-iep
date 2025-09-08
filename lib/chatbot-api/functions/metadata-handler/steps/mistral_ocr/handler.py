"""
Process document with Mistral OCR API
"""
import json
import traceback
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))
from shared_utils import update_progress, create_step_function_response, handle_step_error
from mistral_ocr import process_document_with_mistral_ocr

def lambda_handler(event, context):
    """
    Extract text from document using Mistral OCR API.
    Updates progress=15, current_step="ocr"
    """
    print(f"MistralOCR handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        s3_bucket = event['s3_bucket']
        s3_key = event['s3_key']
        
        print(f"Starting OCR processing for iepId: {iep_id}, s3Key: {s3_key}")
        
        # Update progress to OCR stage
        update_progress(
            iep_id=iep_id,
            child_id=child_id,
            progress=15,
            current_step="ocr"
        )
        
        # Process document with Mistral OCR
        ocr_result = process_document_with_mistral_ocr(s3_bucket, s3_key)
        
        # Check if OCR was successful
        if "error" in ocr_result:
            error_message = f"OCR processing failed: {ocr_result['error']}"
            print(error_message)
            raise Exception(error_message)
        
        print(f"OCR processing completed for iepId: {iep_id}")
        print(f"OCR result contains {len(ocr_result.get('pages', []))} pages")
        
        # Return event with OCR results
        response = create_step_function_response(event)
        response['ocr_result'] = ocr_result
        response['progress'] = 15
        response['current_step'] = "ocr"
        
        return response
        
    except Exception as e:
        print(f"Error in MistralOCR: {str(e)}")
        print(traceback.format_exc())
        
        iep_id = event.get('iep_id', 'unknown')
        child_id = event.get('child_id', 'unknown')
        
        return handle_step_error(iep_id, child_id, "MistralOCR", e, 15)
