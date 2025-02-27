import os
import json
import urllib.parse
import boto3
from botocore.exceptions import ClientError
from config import get_full_prompt, get_all_tags, IEP_SECTIONS, CUSTOM_TAGS

# AWS clients
s3 = boto3.client('s3')
bedrock_retrieve = boto3.client('bedrock-runtime', region_name='us-east-1')  # for knowledge base retrieval
bedrock_invoke = boto3.client('bedrock-runtime', region_name='us-east-1')    # for model invocation

# Google Document AI client import
from google.cloud import documentai
from google_auth import get_documentai_client

# Knowledge Base ID for retrieval (set in environment)
kb_id = os.environ.get('KB_ID')

def retrieve_kb_docs(file_name, knowledge_base_id):
    """Retrieve document content from Bedrock knowledge base by file name."""
    try:
        query = os.path.splitext(file_name)[0]
        print(f"Searching knowledge base for document: {query}")
        response = bedrock_retrieve.retrieve(
            knowledgeBaseId=knowledge_base_id,
            retrievalQuery={'text': query},
            retrievalConfiguration={
                'vectorSearchConfiguration': {'numberOfResults': 20}
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
    except ClientError as e:
        print(f"Error fetching knowledge base docs: {e}")
        return {'content': None, 'uri': None}

def summarize_and_categorize(key, content_text):
    """Use Claude 3 via Bedrock to summarize the document and extract structured tags."""
    try:
        # Invoke the Claude model with the full prompt
        response = bedrock_invoke.invoke_model(
            modelId=os.environ.get('CLAUDE_MODEL_ID', 'anthropic.claude-3-sonnet-20240229-v1:0'),
            contentType='application/json',
            accept='application/json',
            body=json.dumps({
                "prompt": get_full_prompt(key, content_text),
                "max_tokens": 5000,
                "temperature": 0.0
            })
        )
        raw_response = response['body'].read().decode()
        print(f"Raw LLM output: {raw_response[:1000]}...")  # log the first part of response for debugging
        # The model's response is expected to be JSON. Parse it safely:
        try:
            ai_result = json.loads(raw_response)
        except json.JSONDecodeError:
            # If the response is not directly JSON, assume it's wrapped and extract content
            ai_result = json.loads(json.loads(raw_response)['content'])
        summary_and_tags = ai_result if isinstance(ai_result, dict) else ai_result[0]
        # Validate and normalize tags values
        all_tags = get_all_tags()
        for tag, value in summary_and_tags.get('tags', {}).items():
            if tag in all_tags:
                if all_tags[tag] and value not in all_tags[tag]:
                    summary_and_tags['tags'][tag] = 'unknown'
            else:
                summary_and_tags['tags'][tag] = 'unknown'
        return summary_and_tags
    except Exception as e:
        print(f"Error during summarize_and_categorize: {e}")
        return {"summary": "Error generating summary", "sections": {}, "tags": {"language": "unknown", "school_year": "", "review_date": ""}}

def get_metadata(bucket, key):
    """Retrieve the metadata of a single S3 object."""
    response = s3.head_object(Bucket=bucket, Key=key)
    return response.get('Metadata', {})

def get_complete_metadata(bucket):
    """Retrieve metadata for all objects in the bucket (and save to metadata.txt in the bucket)."""
    all_metadata = {}
    try:
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket):
            if 'Contents' in page:
                for obj in page['Contents']:
                    key = obj['Key']
                    try:
                        all_metadata[key] = get_metadata(bucket, key)
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

def lambda_handler(event, context):
    """AWS Lambda handler for processing document events (either on upload or on-demand)."""
    # Skip events triggered by our own copy/metadata operations to prevent recursion
    try:
        if event['Records'][0]['eventSource'] == 'aws:s3' and event['Records'][0]['eventName'].startswith('ObjectCreated:Copy'):
            print("Skipping Lambda trigger from S3 copy operation.")
            return {'statusCode': 200, 'body': json.dumps("Skipped event triggered by copy operation")}
    except Exception as e:
        print(f"Error checking event source: {e}")
    
    # Main processing
    try:
        # Parse S3 information from the event
        bucket = event['Records'][0]['s3']['bucket']['name']
        raw_key = event['Records'][0]['s3']['object']['key']
        key = urllib.parse.unquote_plus(raw_key)
        # Prevent recursive processing of the metadata file itself
        if key.endswith("metadata.txt") or key.endswith(".analysis.json"):
            print(f"Skipping processing for {key}")
            return {'statusCode': 200, 'body': json.dumps(f"Skipped processing for {key}")}
        print(f"Lambda triggered for file: s3://{bucket}/{key}")
        
        # Attempt to retrieve content via Knowledge Base
        file_name = key.split('/')[-1]
        document_content = retrieve_kb_docs(file_name, kb_id)
        content_text = document_content.get('content')
        if not content_text:
            # Fallback: fetch from S3 and parse using Document AI if needed
            print(f"No KB content found for {file_name}. Falling back to direct S3 retrieval and parsing.")
            obj = s3.get_object(Bucket=bucket, Key=key)
            file_bytes = obj['Body'].read()
            file_name_lower = file_name.lower()
            content_text = None
            # Use Document AI for PDFs or non-text formats
            if file_name_lower.endswith(('.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png')):
                try:
                    project_id = os.environ['DOCUMENT_AI_PROJECT_ID']
                    location = os.environ.get('DOCUMENT_AI_LOCATION', 'us')
                    processor_id = os.environ['DOCUMENT_AI_PROCESSOR_ID']
                    print(f"Using Document AI to parse {file_name} (Processor ID: {processor_id})")
                    docai_client = get_documentai_client()
                    name = docai_client.processor_path(project_id, location, processor_id)
                    raw_document = documentai.RawDocument(content=file_bytes, mime_type=obj.get('ContentType', 'application/pdf'))
                    result = docai_client.process_document(request={"name": name, "raw_document": raw_document})
                    content_text = result.document.text
                except Exception as e:
                    print(f"Document AI parsing failed for {file_name}: {e}")
                    return {'statusCode': 500, 'body': json.dumps("Document AI parsing failed")}
            else:
                # Decode text files directly
                content_text = file_bytes.decode('utf-8', errors='ignore')
        
        # Summarize and extract tags using the AI model
        summary_and_tags = summarize_and_categorize(file_name, content_text)
        if "Error generating summary" in summary_and_tags.get('summary', ''):
            # If summarization failed
            return {'statusCode': 500, 'body': json.dumps("Error generating summary and tags")}
        
        # (Here, you could add code to store or return the result as needed)
        print(f"Summary and extracted data: {json.dumps(summary_and_tags)[:500]}...")  # log partial result
        return {
            'statusCode': 200,
            'body': json.dumps(summary_and_tags)
        }
    except Exception as e:
        print(f"Unhandled exception in lambda_handler: {e}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
