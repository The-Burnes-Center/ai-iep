import os
import boto3
import json
import logging

def get_logger():
    """
    Get a configured logger instance.
    
    Returns:
        logging.Logger: A configured logger instance
    """
    logger = logging.getLogger()
    
    # Only add handler if not already present
    if not logger.handlers:
        # Configure handler for Lambda environment
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s\n%(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    # Set log level
    logger.setLevel(logging.INFO)
    
    return logger

def get_document_metadata(bucket, key):
    """Retrieve the metadata of a single S3 object."""
    s3 = boto3.client('s3')
    response = s3.head_object(Bucket=bucket, Key=key)
    return response.get('Metadata', {})

def get_all_documents_metadata(bucket):
    """Retrieve metadata for all objects in the bucket (and save to metadata.txt in the bucket)."""
    s3 = boto3.client('s3')
    all_metadata = {}
    try:
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket):
            if 'Contents' in page:
                for obj in page['Contents']:
                    key = obj['Key']
                    try:
                        all_metadata[key] = get_document_metadata(bucket, key)
                    except Exception as e:
                        print(f"Error fetching metadata for {key}: {e}")
        # Save the collected metadata to an S3 object (for debugging or analysis)
        metadata_json = json.dumps(all_metadata, indent=4)
        s3.put_object(Bucket=bucket, Key="metadata.txt", Body=metadata_json, ContentType='application/json')
        print(f"Metadata snapshot saved to s3://{bucket}/metadata.txt")
        return all_metadata
    except Exception as e:
        print(f"Error occurred in fetching complete metadata: {e}")
        return None

def retrieve_knowledge_base_documents(file_name, knowledge_base_id):
    """Retrieve document content from Bedrock knowledge base by file name."""
    try:
        bedrock_retrieve = boto3.client('bedrock-agent-runtime', region_name='us-east-1')
        query = os.path.splitext(file_name)[0]
        print(f"Searching knowledge base for document: {query}")
        response = bedrock_retrieve.retrieve(
            knowledgeBaseId=knowledge_base_id,
            retrievalQuery={
                'text': query
            },
            # Use the correct parameter structure with vectorSearchConfiguration
            retrievalConfiguration={
                'vectorSearchConfiguration': {
                    'numberOfResults': 20
                }
            }
        )
        full_content = []
        file_uri = None
        if response.get('retrievalResults'):
            for result in response['retrievalResults']:
                uri = result['location']['s3Location']['uri']
                if file_name in uri:
                    # Collect all content segments that belong to this file
                    full_content.append(result['content']['text'])
                    file_uri = uri
            if full_content:
                return {'content': "\n".join(full_content), 'uri': file_uri}
        # If no results or no matching file content found:
        return {'content': None, 'uri': None}
    except boto3.exceptions.ClientError as e:
        print(f"Error fetching knowledge base docs: {e}")
        return {'content': None, 'uri': None, 'error': str(e)} 