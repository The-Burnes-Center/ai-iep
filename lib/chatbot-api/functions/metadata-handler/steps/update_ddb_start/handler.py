"""
Initialize DynamoDB record and set processing status
"""
import json
import traceback
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_utils import update_progress, create_step_function_response, handle_step_error

def lambda_handler(event, context):
    """
    Initialize processing status in DynamoDB.
    Sets status="PROCESSING", progress=5, current_step="start"
    """
    print(f"UpdateDDBStart handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        s3_bucket = event['s3_bucket']
        s3_key = event['s3_key']
        
        print(f"Initializing processing for iepId: {iep_id}")
        
        # Update DynamoDB with initial processing status
        update_progress(
            iep_id=iep_id,
            child_id=child_id,
            progress=5,
            current_step="start",
            status="PROCESSING"
        )
        
        # Return event with progress tracking
        response = create_step_function_response(event)
        response['progress'] = 5
        response['current_step'] = "start"
        
        print(f"Successfully initialized processing for iepId: {iep_id}")
        return response
        
    except Exception as e:
        print(f"Error in UpdateDDBStart: {str(e)}")
        print(traceback.format_exc())
        
        # Try to get IDs for error handling
        iep_id = event.get('iep_id', 'unknown')
        child_id = event.get('child_id', 'unknown')
        
        return handle_step_error(iep_id, child_id, "UpdateDDBStart", e, 5)
