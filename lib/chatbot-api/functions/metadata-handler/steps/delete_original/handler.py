"""
Delete the original uploaded file from S3 - Core business logic only
"""
import json
import traceback
import boto3

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
    Core deletion logic only - DDB operations handled by centralized service.
    """
    print(f"DeleteOriginal handler received: {json.dumps(event)}")
    
    try:
        s3_bucket = event['s3_bucket']
        s3_key = event['s3_key']
        
        print(f"Deleting original file: s3://{s3_bucket}/{s3_key}")
        
        # Delete the original file from S3
        delete_s3_object(s3_bucket, s3_key)
        
        print("Successfully deleted original file")
        
        return event  # Pass through all input data unchanged
        
    except Exception as e:
        print(f"DeleteOriginal error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error