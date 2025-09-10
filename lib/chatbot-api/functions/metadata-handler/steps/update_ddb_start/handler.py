"""
Initialize DynamoDB record and set processing status
"""
import json
import traceback
import boto3

def lambda_handler(event, context):
    """
    Initialize processing status in DynamoDB using centralized DDB service.
    Sets status="PROCESSING", progress=5, current_step="initializing"
    """
    print(f"UpdateDDBStart handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        s3_bucket = event['s3_bucket']
        s3_key = event['s3_key']
        
        print(f"Initializing processing for iepId: {iep_id}")
        
        # Call centralized DDB service
        lambda_client = boto3.client('lambda')
        ddb_service_name = event.get('ddb_service_arn', 'DDBService')  # Fallback name
        
        ddb_payload = {
            'operation': 'update_progress',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'progress': 0,
                'current_step': 'initializing',
                'status': 'PROCESSING'
            }
        }
        
        ddb_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(ddb_payload)
        )
        
        ddb_result = json.loads(ddb_response['Payload'].read())
        print(f"DDB service response: {ddb_result}")
        
        # Return event with progress tracking and DDB result
        response = {
            **event,  # Pass through all input data
            'progress': 0,
            'current_step': 'initializing',
            'ddb_result': ddb_result
        }
        
        print(f"Successfully initialized processing for iepId: {iep_id}")
        return response
        
    except Exception as e:
        print(f"Error in UpdateDDBStart: {str(e)}")
        print(traceback.format_exc())
        
        # Return error but don't fail the workflow
        return {
            **event,
            'progress': 0,
            'current_step': 'initializing',
            'ddb_result': {
                'statusCode': 500,
                'body': json.dumps({
                    'error': str(e),
                    'operation': 'update_progress'
                })
            }
        }
