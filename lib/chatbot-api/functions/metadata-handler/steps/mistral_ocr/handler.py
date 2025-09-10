"""
Process document with Mistral OCR API - Core business logic only
"""
import json
import traceback
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
        
        # Store large OCR result in S3 to avoid Step Functions data limits
        import boto3
        import json as json_lib
        from datetime import datetime
        
        s3_client = boto3.client('s3')
        
        # Create OCR result S3 key
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        ocr_s3_key = f"{event['user_id']}/{event['child_id']}/{event['iep_id']}/ocr_result_{timestamp}.json"
        
        # Store full OCR result in S3
        s3_client.put_object(
            Bucket=s3_bucket,
            Key=ocr_s3_key,
            Body=json_lib.dumps(ocr_result),
            ContentType='application/json'
        )
        
        print(f"Stored OCR result in S3: s3://{s3_bucket}/{ocr_s3_key}")
        
        # Return only metadata to avoid Step Functions size limits
        ocr_metadata = {
            'page_count': len(ocr_result.get('pages', [])),
            'has_images': any(page.get('images') for page in ocr_result.get('pages', [])),
            'total_text_length': sum(len(page.get('markdown', '') + page.get('text', '') + page.get('content', '')) 
                                   for page in ocr_result.get('pages', [])),
            's3_bucket': s3_bucket,
            's3_key': ocr_s3_key,
            'stored_at': timestamp
        }
        
        # Add OCR metadata to the payload for next step
        return {
            **event,  # Pass through all input data
            'ocr_result': ocr_metadata  # Only metadata, not full content
        }
        
    except Exception as e:
        print(f"MistralOCR error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error