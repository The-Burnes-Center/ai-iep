"""
Generate English summary, sections, and document index using OpenAI - Core business logic only
"""
import json
import os
import boto3
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
        
        # Handle Lambda invoke response safely
        payload_response = ddb_response['Payload'].read()
        print(f"DDB raw response: {payload_response}")
        
        if not payload_response:
            raise Exception("Empty response from DDB service")
        
        try:
            ddb_result = json.loads(payload_response)
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse DDB service response as JSON: {e}. Response: {payload_response}")
        
        print(f"DDB parsed result: {ddb_result}")
        
        if not ddb_result or ddb_result.get('statusCode') != 200:
            raise Exception(f"Failed to get redacted OCR data from DDB: {ddb_result}")
        
        # Extract redacted OCR data from DDB response
        response_body = json.loads(ddb_result['body'])
        actual_redacted_ocr = response_body['data']
        
        print(f"Retrieved redacted OCR data from DynamoDB: {len(actual_redacted_ocr.get('pages', []))} pages")
        
        # Create OpenAI Agent with redacted OCR data and SSM fallback
        api_key = os.environ.get('OPENAI_API_KEY')
        
        # If encrypted or missing, fetch from SSM
        if not api_key or api_key.startswith('AQICA'):
            param_name = os.environ.get('OPENAI_API_KEY_PARAMETER_NAME')
            if param_name:
                try:
                    ssm = boto3.client('ssm')
                    response = ssm.get_parameter(Name=param_name, WithDecryption=True)
                    api_key = response['Parameter']['Value']
                    # Cache in environment for future use
                    os.environ['OPENAI_API_KEY'] = api_key
                    print("Successfully retrieved OPENAI_API_KEY from SSM")
                except Exception as e:
                    print(f"Error retrieving OPENAI_API_KEY from SSM: {str(e)}")
                    raise Exception("Failed to retrieve OPENAI_API_KEY from SSM")
        
        if not api_key:
            raise Exception("OPENAI_API_KEY not available from environment or SSM")
            
        agent = OpenAIAgent(ocr_data=actual_redacted_ocr, api_key=api_key)
        
        # Analyze the document in English only
        english_result = agent.analyze_document()
        
        # Check for error in the English analysis
        if "error" in english_result:
            error_message = f"English document analysis failed: {english_result.get('error')}"
            print(error_message)
            raise Exception(error_message)
        
        print(f"English analysis completed. Generated {len(english_result.get('sections', []))} sections")
        
        # Save English analysis result to DynamoDB for later retrieval by CombineResults
        save_payload = {
            'operation': 'save_results',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'results': english_result,
                'result_type': 'english_result'
            }
        }
        
        save_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(save_payload)
        )
        
        # Handle Lambda invoke response safely
        save_payload_response = save_response['Payload'].read()
        
        if not save_payload_response:
            raise Exception("Empty response from DDB service during save")
        
        try:
            save_result = json.loads(save_payload_response)
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse save DDB service response as JSON: {e}. Response: {save_payload_response}")
        
        if not save_result or save_result.get('statusCode') != 200:
            raise Exception(f"Failed to save English result to DDB: {save_result}")
        
        print("English analysis result saved to DDB successfully")
        
        # Return minimal event (no need to pass large data through Step Functions)
        # Note: Don't pass through progress/current_step as they're managed by state machine
        event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
        return {
            **event_copy,  # Pass through input data except progress tracking
            'parsing_completed': True,
            'sections_count': len(english_result.get('sections', [])),
            'has_summary': bool(english_result.get('summaries', '').strip()),
            'has_document_index': bool(english_result.get('document_index', '').strip())
        }
        
    except Exception as e:
        print(f"ParsingAgent error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error