"""
Process document with Mistral OCR API - Core business logic only
"""
import json
import traceback
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))
from mistral_ocr import process_document_with_mistral_ocr

def lambda_handler(event, context):
    """
    Extract text from document using Mistral OCR API.
    Core OCR logic only - DDB operations handled by centralized service.
    """
    print(f"MistralOCR handler received: {json.dumps(event)}")
    
    try:
        s3_bucket = event['s3_bucket']
        s3_key = event['s3_key']
        
        # Process document with Mistral OCR
        print(f"Processing document: s3://{s3_bucket}/{s3_key}")
        ocr_result = process_document_with_mistral_ocr(s3_bucket, s3_key)
        
        # Check if OCR was successful
        if "error" in ocr_result:
            error_message = f"OCR processing failed: {ocr_result['error']}"
            print(error_message)
            raise Exception(error_message)
        
        print(f"OCR completed successfully. Found {len(ocr_result.get('pages', []))} pages")
        
        # Add OCR result to the payload for next step
        return {
            **event,  # Pass through all input data
            'ocr_result': ocr_result
        }
        
    except Exception as e:
        print(f"MistralOCR error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error