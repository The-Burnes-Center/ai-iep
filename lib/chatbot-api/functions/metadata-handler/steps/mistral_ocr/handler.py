"""
Process document with Mistral OCR API - Core business logic only
"""
import json
import traceback
import boto3
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
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        
        # Process document with Mistral OCR
        print(f"Processing document: s3://{s3_bucket}/{s3_key}")
        ocr_result = process_document_with_mistral_ocr(s3_bucket, s3_key)
        
        # Check if OCR was successful
        if "error" in ocr_result:
            error_message = f"OCR processing failed: {ocr_result['error']}"
            print(error_message)
            raise Exception(error_message)
        
        print(f"OCR completed successfully. Found {len(ocr_result.get('pages', []))} pages")
        
        # Save OCR result to DynamoDB via centralized DDB service
        lambda_client = boto3.client('lambda')
        ddb_service_name = event.get('ddb_service_arn', 'DDBService')
        
        ddb_payload = {
            'operation': 'save_ocr_data',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'ocr_data': ocr_result,
                'data_type': 'ocr_result'
            }
        }
        
        ddb_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(ddb_payload)
        )
        
        ddb_result = json.loads(ddb_response['Payload'].read())
        print(f"DDB save result: {ddb_result}")
        
        if ddb_result.get('statusCode') != 200:
            raise Exception(f"Failed to save OCR data to DDB: {ddb_result}")
        
        print(f"Successfully saved OCR data to DynamoDB for iepId: {iep_id}")
        
        # Return minimal metadata (no large OCR data in Step Functions)
        return {
            **event,  # Pass through all input data
            'ocr_status': 'completed',
            'page_count': len(ocr_result.get('pages', [])),
            'ddb_save_result': ddb_result
        }
        
    except Exception as e:
        print(f"MistralOCR error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error