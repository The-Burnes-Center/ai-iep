import json
import boto3
import os
from datetime import datetime
from .config import get_full_prompt, IEP_SECTIONS, get_translation_prompt

bedrock = boto3.client('bedrock-runtime')
s3 = boto3.client('s3')
dynamodb = boto3.client('dynamodb')

def translate_content(content, target_language):
    """Translate content to target language using Claude"""
    prompt = get_translation_prompt(content, target_language)
    response = bedrock.invoke_model(
        modelId='anthropic.claude-3-sonnet-20240229-v1:0',
        body=json.dumps({
            "prompt": prompt,
            "max_tokens": 4096,
            "temperature": 0.0
        })
    )
    translation_response = json.loads(response['body'].read().decode())
    return json.loads(translation_response['content'])

def get_user_languages(user_id):
    """Get user's primary and secondary languages from user profile"""
    try:
        response = dynamodb.get_item(
            TableName=os.environ['USER_PROFILES_TABLE'],
            Key={'userId': {'S': user_id}}
        )
        if 'Item' in response:
            return {
                'primary': response['Item'].get('primaryLanguage', {}).get('S', 'english'),
                'secondary': response['Item'].get('secondaryLanguage', {}).get('S', None)
            }
        return {'primary': 'english', 'secondary': None}
    except Exception as e:
        print(f"Error getting user languages: {str(e)}")
        return {'primary': 'english', 'secondary': None}

def update_user_documents(user_id, kid_id, document_data):
    """Update user profile with document information"""
    try:
        # Get existing documents list
        response = dynamodb.get_item(
            TableName=os.environ['USER_PROFILES_TABLE'],
            Key={'userId': {'S': user_id}}
        )
        
        existing_docs = {}
        if 'Item' in response and 'documents' in response['Item']:
            existing_docs = response['Item']['documents'].get('M', {})
        
        # Update documents for the specific kid
        kid_docs = existing_docs.get(kid_id, {'L': []}).get('L', [])
        kid_docs.append({'M': document_data})
        
        existing_docs[kid_id] = {'L': kid_docs}
        
        # Update user profile
        dynamodb.update_item(
            TableName=os.environ['USER_PROFILES_TABLE'],
            Key={'userId': {'S': user_id}},
            UpdateExpression='SET documents = :docs',
            ExpressionAttributeValues={
                ':docs': {'M': existing_docs}
            }
        )
    except Exception as e:
        print(f"Error updating user documents: {str(e)}")

def process_document(event, context):
    try:
        # Get the S3 bucket and key from the event
        bucket = event['Records'][0]['s3']['bucket']['name']
        key = event['Records'][0]['s3']['object']['key']
        
        # Extract user and kid IDs from the key
        # key format: userId/kidId/iepId/fileName
        parts = key.split('/')
        user_id = parts[0]
        kid_id = parts[1]
        iep_id = parts[2] if len(parts) >= 4 else None
        
        if not iep_id:
            raise ValueError("Could not extract IEP ID from document key")
        
        # Get user's language preferences
        user_languages = get_user_languages(user_id)
        
        # Get the document content from S3
        response = s3.get_object(Bucket=bucket, Key=key)
        content = response['Body'].read().decode('utf-8')
        
        # Generate the prompt for AI analysis
        prompt = get_full_prompt(key, content)
        
        # Call Bedrock with Claude model for analysis
        bedrock_response = bedrock.invoke_model(
            modelId='anthropic.claude-3-sonnet-20240229-v1:0',
            body=json.dumps({
                "prompt": prompt,
                "max_tokens": 4096,
                "temperature": 0.0
            })
        )
        
        # Parse the AI response
        ai_response = json.loads(bedrock_response['body'].read().decode())
        analysis = json.loads(ai_response['content'])
        
        # Generate translations if needed
        translations = {
            'english': {
                'summary': analysis['summary'],
                'sections': analysis['sections']
            }
        }
        
        # Translate to primary language if not English
        if user_languages['primary'] != 'english':
            translations[user_languages['primary']] = translate_content(
                json.dumps({
                    'summary': analysis['summary'],
                    'sections': analysis['sections']
                }),
                user_languages['primary']
            )
        
        # Translate to secondary language if specified
        if user_languages['secondary'] and user_languages['secondary'] != 'english':
            translations[user_languages['secondary']] = translate_content(
                json.dumps({
                    'summary': analysis['summary'],
                    'sections': analysis['sections']
                }),
                user_languages['secondary']
            )
            
        # Update DynamoDB with metadata
        table_name = os.environ['IEP_DOCUMENTS_TABLE']
        
        # Prepare the sections data
        sections_data = {}
        for section, details in analysis['sections'].items():
            if details['present']:
                sections_data[section] = {
                    'summary': details['summary'],
                    'location': details['location']
                }
        
        # Update DynamoDB document record
        dynamodb.update_item(
            TableName=table_name,
            Key={
                'iepId': {'S': iep_id}
            },
            UpdateExpression="""
            SET summary = :summary,
                sections = :sections,
                metadata = :metadata,
                translations = :translations,
                status = :status,
                updatedAt = :timestamp
            """,
            ExpressionAttributeValues={
                ':summary': {'S': analysis['summary']},
                ':sections': {'M': {
                    section: {'M': {
                        'summary': {'S': data['summary']},
                        'location': {'S': data['location']}
                    }} for section, data in sections_data.items()
                }},
                ':metadata': {'M': {
                    'language': {'S': analysis['tags']['language']},
                    'schoolYear': {'S': analysis['tags']['school_year']},
                    'reviewDate': {'S': analysis['tags']['review_date']}
                }},
                ':translations': {'M': {
                    lang: {'M': {
                        'summary': {'S': trans_data['summary']},
                        'sections': {'M': {
                            section: {'M': {
                                'summary': {'S': section_data['summary']},
                                'location': {'S': section_data['location']}
                            }} for section, section_data in trans_data['sections'].items() if section_data['present']
                        }}
                    }} for lang, trans_data in translations.items()
                }},
                ':status': {'S': 'PROCESSED'},
                ':timestamp': {'S': datetime.utcnow().isoformat()}
            }
        )
        
        # Update user profile with document information
        document_data = {
            'iepId': {'S': iep_id},
            'fileName': {'S': parts[-1]},
            'uploadDate': {'S': datetime.utcnow().isoformat()},
            'summary': {'S': analysis['summary']},
            'translations': {'M': {
                lang: {'M': {'summary': {'S': trans_data['summary']}}}
                for lang, trans_data in translations.items()
            }},
            'metadata': {'M': {
                'language': {'S': analysis['tags']['language']},
                'schoolYear': {'S': analysis['tags']['school_year']},
                'reviewDate': {'S': analysis['tags']['review_date']}
            }}
        }
        update_user_documents(user_id, kid_id, document_data)
        
        # Update S3 object metadata
        s3.copy_object(
            Bucket=bucket,
            Key=key,
            CopySource={'Bucket': bucket, 'Key': key},
            Metadata={
                'summary': analysis['summary'],
                'sections': json.dumps(sections_data),
                'language': analysis['tags']['language'],
                'school_year': analysis['tags']['school_year'],
                'review_date': analysis['tags']['review_date']
            },
            MetadataDirective='REPLACE'
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Document processed successfully',
                'documentId': iep_id
            })
        }
        
    except Exception as e:
        # Update document status to FAILED if we have the iep_id
        if iep_id:
            try:
                dynamodb.update_item(
                    TableName=table_name,
                    Key={
                        'iepId': {'S': iep_id}
                    },
                    UpdateExpression='SET status = :status, errorMessage = :error, updatedAt = :timestamp',
                    ExpressionAttributeValues={
                        ':status': {'S': 'FAILED'},
                        ':error': {'S': str(e)},
                        ':timestamp': {'S': datetime.utcnow().isoformat()}
                    }
                )
            except:
                pass  # If updating status fails, we still want to return the original error
                
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        } 