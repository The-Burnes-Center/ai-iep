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
        
        return {
            **event,  # Pass through all input data
            'missing_info_result': missing_info_result
        }
        
    except Exception as e:
        print(f"MissingInfoAgent error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error