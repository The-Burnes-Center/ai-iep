"""
Extract missing information insights for parents - Core business logic only
"""
import json
import os
import traceback
import boto3

def lambda_handler(event, context):
    """
    Extract missing information insights for parents.
    Core missing info logic only - DDB operations handled by centralized service.
    Invokes the existing identify-missing-info Lambda function.
    """
    print(f"MissingInfoAgent handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        
        print(f"Starting missing info extraction for iepId: {iep_id}")
        
        # Create payload for the existing identify-missing-info function
        lambda_payload = {
            'iep_id': iep_id,
            'user_id': user_id,
            'child_id': child_id
        }
        
        # Invoke the existing identify-missing-info Lambda function
        lambda_client = boto3.client('lambda')
        missing_info_function_name = os.environ.get('IDENTIFY_MISSING_INFO_FUNCTION_NAME', 'IdentifyMissingInfoFunction')
        
        print(f"Invoking missing info function: {missing_info_function_name}")
        
        response = lambda_client.invoke(
            FunctionName=missing_info_function_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(lambda_payload)
        )
        
        # Parse the response
        response_payload = json.loads(response['Payload'].read())
        
        if response.get('StatusCode') != 200:
            raise Exception(f"Missing info function failed with status {response.get('StatusCode')}")
        
        # Check if the function returned an error
        if 'errorMessage' in response_payload:
            raise Exception(f"Missing info function error: {response_payload['errorMessage']}")
        
        print(f"Missing info extraction completed for iepId: {iep_id}")
        
        # Extract the missing info result from the response
        missing_info_result = response_payload.get('body', {})
        if isinstance(missing_info_result, str):
            missing_info_result = json.loads(missing_info_result)
        
        # Save missing info result to DynamoDB for later retrieval by CombineResults
        lambda_client = boto3.client('lambda')
        ddb_service_name = os.environ.get('DDB_SERVICE_FUNCTION_NAME', 'DDBService')
        
        save_payload = {
            'operation': 'save_results',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'results': missing_info_result,
                'result_type': 'missing_info_result'
            }
        }
        
        save_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(save_payload)
        )
        
        # Handle Lambda invoke response safely
        save_payload_response = save_response['Payload'].read()
        
        if save_payload_response:
            try:
                save_result = json.loads(save_payload_response)
                if save_result and save_result.get('statusCode') == 200:
                    print("Missing info result saved to DDB successfully")
                else:
                    print(f"Warning: Failed to save missing info result to DDB: {save_result}")
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to parse save DDB service response: {e}")
        else:
            print("Warning: Empty response from DDB service during missing info save")
        
        # Return minimal event (no need to pass large data through Step Functions)
        event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
        return {
            **event_copy,  # Pass through input data except progress tracking  
            'missing_info_completed': True,
            'missing_info_count': len(missing_info_result) if isinstance(missing_info_result, list) else 0
        }
        
    except Exception as e:
        print(f"MissingInfoAgent error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error