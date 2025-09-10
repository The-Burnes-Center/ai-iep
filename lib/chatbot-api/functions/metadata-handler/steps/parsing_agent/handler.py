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
        
        # Check if redacted OCR result is stored in S3
        actual_redacted_ocr = redacted_ocr_result
        
        if isinstance(redacted_ocr_result, dict) and 's3_bucket' in redacted_ocr_result and 's3_key' in redacted_ocr_result:
            print(f"Redacted OCR result is stored in S3: s3://{redacted_ocr_result['s3_bucket']}/{redacted_ocr_result['s3_key']}")
            
            # Retrieve redacted OCR result from S3
            import boto3
            import json as json_lib
            
            s3_client = boto3.client('s3')
            
            response = s3_client.get_object(
                Bucket=redacted_ocr_result['s3_bucket'],
                Key=redacted_ocr_result['s3_key']
            )
            
            actual_redacted_ocr = json_lib.loads(response['Body'].read().decode('utf-8'))
            print(f"Retrieved redacted OCR result from S3: {len(actual_redacted_ocr.get('pages', []))} pages")
        
        # Create OpenAI Agent with redacted OCR data
        agent = OpenAIAgent(ocr_data=actual_redacted_ocr)
        
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