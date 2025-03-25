import json
import boto3
import os

# Retrieve environment variables for Knowledge Base index and source index
kb_index = os.environ['KB_ID']
source_index = os.environ['SOURCE']

# Initialize a Bedrock Agent client
client = boto3.client('bedrock-agent')

def check_running():
    """
    Check if any sync jobs for the specified data source and index are currently running.

    Returns:
        bool: True if there are any ongoing sync or sync-indexing jobs, False otherwise.
    """
    # List ongoing sync jobs with status 'SYNCING'
    syncing = client.list_ingestion_jobs(
        dataSourceId=source_index,
        knowledgeBaseId=kb_index,
        filters=[{
            'attribute': 'STATUS',
            'operator': 'EQ',
            'values': [
                'IN_PROGRESS',
            ]
        }]
    )
    
    # List ongoing sync jobs with status 'STARTING'
    starting = client.list_ingestion_jobs(
        dataSourceId=source_index,
        knowledgeBaseId=kb_index,
        filters=[{
            'attribute': 'STATUS',
            'operator': 'EQ',
            'values': [
                'STARTING',
            ]
        }]
    )
    
    # Combine the history of both job types
    hist = starting['ingestionJobSummaries'] + syncing['ingestionJobSummaries']
    
    # Check if there are any jobs in the history
    if len(hist) > 0:
        return True
    return False

def get_last_sync():    
    syncs = client.list_ingestion_jobs(
        dataSourceId=source_index,
        knowledgeBaseId=kb_index,
        filters=[{
            'attribute': 'STATUS',
            'operator': 'EQ',
            'values': [
                'COMPLETE',
            ]
        }]
    )
    hist = syncs["ingestionJobSummaries"]
    time = hist[0]["updatedAt"].strftime('%B %d, %Y, %I:%M%p UTC')
    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(time)
    }

def check_sync_status(event):
    if check_running():
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps('STILL SYNCING')
        }
    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps('DONE SYNCING')
    }

def start_sync(event):
    if check_running():
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps('STILL SYNCING')
        }
    
    client.start_ingestion_job(
        dataSourceId=source_index,
        knowledgeBaseId=kb_index
    )
    
    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps('STARTED SYNCING')
    }

def lambda_handler(event, context):
    """
    AWS Lambda handler function for handling requests.

    Args:
        event (dict): The event dictionary containing request data.
        context (dict): The context dictionary containing information about the Lambda function execution.

    Returns:
        dict: A response dictionary with a status code, headers, and body.
    """
    
    # Retrieve the resource path from the event dictionary
    resource_path = event.get('rawPath', '')
    
    # Process the request based on the resource path
    if resource_path == '/kb-sync/still-syncing':
        return check_sync_status(event)
    elif resource_path == '/kb-sync/sync-kb':
        return start_sync(event)
    elif resource_path == '/kb-sync/get-last-sync':
        return get_last_sync()
    else:
        return {
            'statusCode': 404,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps('Not Found')
        }