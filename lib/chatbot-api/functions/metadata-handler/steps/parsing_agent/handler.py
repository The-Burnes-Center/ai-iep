"""
Generate English summary, sections, and document index using OpenAI - Core business logic only
"""
import json
import os
import traceback
from open_ai_agent import OpenAIAgent

def lambda_handler(event, context):
    """
    Generate English-only analysis using OpenAI.
    Core analysis logic only - DDB operations handled by centralized service.
    """
    print(f"ParsingAgent handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        
        print("Starting English-only document analysis...")
        print(f"Getting redacted OCR data from DynamoDB for iepId: {iep_id}")
        
        # Get redacted OCR result from DynamoDB via centralized DDB service
        import boto3
        
        lambda_client = boto3.client('lambda')
        ddb_service_name = event.get('ddb_service_arn') or os.environ.get('DDB_SERVICE_FUNCTION_NAME', 'DDBService')
        
        ddb_payload = {
            'operation': 'get_ocr_data',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'data_type': 'redacted_ocr_result'
            }
        }
        
        ddb_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(ddb_payload)
        )
        
        ddb_result = json.loads(ddb_response['Payload'].read())
        print(f"DDB get result: {ddb_result}")
        
        if ddb_result.get('statusCode') != 200:
            raise Exception(f"Failed to get redacted OCR data from DDB: {ddb_result}")
        
        # Extract redacted OCR data from DDB response
        response_body = json.loads(ddb_result['body'])
        actual_redacted_ocr = response_body['data']
        
        print(f"Retrieved redacted OCR data from DynamoDB: {len(actual_redacted_ocr.get('pages', []))} pages")
        
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
        # Note: Don't pass through progress/current_step as they're managed by state machine
        event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
        return {
            **event_copy,  # Pass through input data except progress tracking
            'english_result': english_result
        }
        
    except Exception as e:
        print(f"ParsingAgent error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error