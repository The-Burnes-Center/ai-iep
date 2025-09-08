"""
Record failure state and error information
"""
import json
import traceback
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_utils import update_progress, create_step_function_response

def lambda_handler(event, context):
    """
    Record failure state and error information.
    Updates current_step="error", status="FAILED"
    """
    print(f"RecordFailure handler received: {json.dumps(event)}")
    
    try:
        iep_id = event.get('iep_id', 'unknown')
        user_id = event.get('user_id', 'unknown')
        child_id = event.get('child_id', 'unknown')
        
        # Extract error information from the event
        error_info = event.get('error', {})
        error_message = "Processing failed"
        
        if isinstance(error_info, dict):
            if 'Error' in error_info:
                error_message = str(error_info['Error'])
            elif 'Cause' in error_info:
                try:
                    cause = json.loads(error_info['Cause'])
                    error_message = cause.get('errorMessage', 'Processing failed')
                except:
                    error_message = str(error_info['Cause'])
            else:
                error_message = str(error_info)
        elif isinstance(error_info, str):
            error_message = error_info
        
        print(f"Recording failure for iepId: {iep_id}, error: {error_message}")
        
        # Update progress to error state
        try:
            update_progress(
                iep_id=iep_id,
                child_id=child_id,
                progress=0,  # Reset progress on failure
                current_step="error",
                status="FAILED",
                error_message=error_message
            )
            print(f"Successfully recorded failure for iepId: {iep_id}")
            
        except Exception as update_error:
            print(f"Failed to update failure status in DynamoDB: {str(update_error)}")
            # Continue even if DynamoDB update fails
        
        # Return failure response
        response = {
            'iep_id': iep_id,
            'user_id': user_id,
            'child_id': child_id,
            'status': 'FAILED',
            'current_step': 'error',
            'progress': 0,
            'error_message': error_message,
            'execution_failed': True
        }
        
        return response
        
    except Exception as e:
        print(f"Error in RecordFailure handler itself: {str(e)}")
        print(traceback.format_exc())
        
        # Return basic failure response even if handler fails
        return {
            'iep_id': event.get('iep_id', 'unknown'),
            'user_id': event.get('user_id', 'unknown'),
            'child_id': event.get('child_id', 'unknown'),
            'status': 'FAILED',
            'current_step': 'error',
            'progress': 0,
            'error_message': f"Critical failure in error handler: {str(e)}",
            'execution_failed': True
        }
