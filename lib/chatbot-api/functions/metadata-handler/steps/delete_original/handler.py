"""
Delete the original uploaded file from S3
"""
import json
import traceback
import boto3
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_utils import update_progress, create_step_function_response, handle_step_error

def delete_s3_object(bucket, key):
    """Delete an object from S3"""
    try:
        s3 = boto3.client('s3')
        # Check if object exists before deleting
        try:
            s3.head_object(Bucket=bucket, Key=key)
            s3.delete_object(Bucket=bucket, Key=key)
            print(f"Deleted S3 object: {bucket}/{key}")
        except s3.exceptions.ClientError as e:
            if e.response['Error']['Code'] == '404':
                print(f"S3 object does not exist, no need to delete: {bucket}/{key}")
            else:
                raise
    except Exception as e:
        print(f"Failed to delete S3 object: {bucket}/{key} - {e}")
        raise

def lambda_handler(event, context):
    """
    Delete the original uploaded file from S3.
    Updates progress=22, current_step="cleanup_original"
    """
    print(f"DeleteOriginal handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        s3_bucket = event['s3_bucket']
        s3_key = event['s3_key']
        
        print(f"Deleting original file for iepId: {iep_id}, s3Key: {s3_key}")
        
        # Update progress to cleanup stage
        update_progress(
            iep_id=iep_id,
            child_id=child_id,
            progress=22,
            current_step="cleanup_original"
        )
        
        # Delete the original file from S3
        delete_s3_object(s3_bucket, s3_key)
        
        print(f"Successfully deleted original file for iepId: {iep_id}")
        
        # Return event with updated progress
        response = create_step_function_response(event)
        response['progress'] = 22
        response['current_step'] = "cleanup_original"
        
        return response
        
    except Exception as e:
        print(f"Error in DeleteOriginal: {str(e)}")
        print(traceback.format_exc())
        
        iep_id = event.get('iep_id', 'unknown')
        child_id = event.get('child_id', 'unknown')
        
        return handle_step_error(iep_id, child_id, "DeleteOriginal", e, 22)
