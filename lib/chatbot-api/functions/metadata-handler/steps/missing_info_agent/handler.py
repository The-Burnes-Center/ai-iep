"""
Extract missing information insights for parents using existing identify-missing-info logic
"""
import json
import traceback
import boto3
import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_utils import update_progress, create_step_function_response, handle_step_error

def lambda_handler(event, context):
    """
    Extract missing information insights for parents.
    Updates progress=40, current_step="missing_info"
    Invokes the existing identify-missing-info Lambda function.
    """
    print(f"MissingInfoAgent handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        
        print(f"Starting missing info extraction for iepId: {iep_id}")
        
        # Update progress to missing info stage
        update_progress(
            iep_id=iep_id,
            child_id=child_id,
            progress=40,
            current_step="missing_info"
        )
        
        # Invoke the existing identify-missing-info Lambda function
        lambda_client = boto3.client('lambda')
        target_function_name = os.environ.get('IDENTIFY_MISSING_INFO_FUNCTION_NAME')
        
        if target_function_name and iep_id:
            payload = {
                'iepId': iep_id,
                'childId': child_id
            }
            
            print(f"Invoking {target_function_name} synchronously with payload: {json.dumps(payload)}")
            
            # Invoke synchronously to get the results
            response = lambda_client.invoke(
                FunctionName=target_function_name,
                InvocationType='RequestResponse',  # Synchronous
                Payload=json.dumps(payload).encode('utf-8')
            )
            
            # Parse the response
            response_payload = json.loads(response['Payload'].read().decode('utf-8'))
            print(f"Missing info extraction completed for iepId: {iep_id}")
            
            # Extract missing info from the response if available
            missing_info = response_payload.get('missing_info', [])
            
        else:
            print("IDENTIFY_MISSING_INFO_FUNCTION_NAME not set or iepId missing; skipping missing info extraction")
            missing_info = []
        
        # Return event with missing info results
        response = create_step_function_response(event)
        response['missing_info'] = missing_info
        response['progress'] = 40
        response['current_step'] = "missing_info"
        
        return response
        
    except Exception as e:
        print(f"Error in MissingInfoAgent: {str(e)}")
        print(traceback.format_exc())
        
        # Missing info extraction is non-critical, so we can continue without it
        print("Missing info extraction failed, continuing without missing info data")
        
        iep_id = event.get('iep_id', 'unknown')
        child_id = event.get('child_id', 'unknown')
        
        # Return successful response with empty missing info
        response = create_step_function_response(event)
        response['missing_info'] = []
        response['progress'] = 40
        response['current_step'] = "missing_info"
        
        return response
