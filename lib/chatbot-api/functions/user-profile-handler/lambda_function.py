import json
import os
import boto3
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Literal

dynamodb = boto3.resource('dynamodb')
user_profiles_table = dynamodb.Table(os.environ['USER_PROFILES_TABLE'])
iep_documents_table = dynamodb.Table(os.environ['IEP_DOCUMENTS_TABLE'])

SUPPORTED_LANGUAGES = ['en', 'zh', 'es', 'vi']
DEFAULT_LANGUAGE = 'en'

# Document processing statuses
DocumentStatus = Literal['PROCESSING', 'PROCESSED', 'FAILED']
DOCUMENT_STATUSES: List[DocumentStatus] = ['PROCESSING', 'PROCESSED', 'FAILED']

def create_response(status_code: int, body: Dict) -> Dict:
    """
    Create a standardized API response with CORS headers.
    
    Args:
        status_code (int): HTTP status code
        body (Dict): Response body to be JSON serialized
        
    Returns:
        Dict: API Gateway response object with CORS headers
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
        },
        'body': json.dumps(body)
    }

def handle_options() -> Dict:
    """
    Handle OPTIONS requests for CORS preflight.
    
    Returns:
        Dict: API Gateway response with CORS headers
    """
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
        },
        'body': ''
    }

def validate_language(lang: str) -> bool:
    """
    Validate if the provided language code is supported.
    
    Args:
        lang (str): Language code to validate
        
    Returns:
        bool: True if language is supported, False otherwise
    """
    return lang in SUPPORTED_LANGUAGES

def get_user_profile(event: Dict) -> Dict:
    """
    Get user profile information. If profile doesn't exist, creates a default one.
    
    Args:
        event (Dict): API Gateway event object containing user context
        
    Returns:
        Dict: API Gateway response containing user profile or error
        
    Raises:
        Exception: If there's an error accessing DynamoDB
    """
    try:
        # Get userId from the requestContext (set by Cognito authorizer)
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        email = event['requestContext']['authorizer']['jwt']['claims'].get('email', '')
        
        response = user_profiles_table.get_item(
            Key={'userId': user_id}
        )
        
        if 'Item' not in response:
            # Create a new profile if it doesn't exist (fallback in case Cognito trigger failed)
            current_time = int(datetime.now().timestamp())
            new_profile = {
                'userId': user_id,
                'email': email,
                'createdAt': current_time,
                'updatedAt': current_time,
                'kids': []  # Initialize empty kids array
            }
            user_profiles_table.put_item(Item=new_profile)
            return create_response(200, {'profile': new_profile})
            
        return create_response(200, {'profile': response['Item']})
        
    except Exception as e:
        return create_response(500, {'message': f'Error getting user profile: {str(e)}'})

def update_user_profile(event: Dict) -> Dict:
    """
    Update user profile information. Supports partial updates - only provided fields will be updated.
    
    Args:
        event (Dict): API Gateway event object containing user context and profile data
        
    Returns:
        Dict: API Gateway response indicating success or error
        
    Raises:
        Exception: If there's an error accessing DynamoDB
    """
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        body = json.loads(event['body'])
        current_time = int(datetime.now().timestamp())
        
        # Start building update expression and values
        update_parts = []
        expr_values = {
            ':updatedAt': current_time
        }
        update_parts.append('updatedAt = :updatedAt')
        
        # Handle optional fields
        optional_fields = {
            'email': 'email',
            'phone': 'phone',
            'city': 'city',
            'primaryLanguage': 'primaryLanguage',
            'secondaryLanguage': 'secondaryLanguage'
        }
        
        for field, attr_name in optional_fields.items():
            if field in body:
                # Special validation for language fields
                if field in ['primaryLanguage', 'secondaryLanguage']:
                    if body[field] and not validate_language(body[field]):
                        return create_response(400, {
                            'message': f'Unsupported language for {field}. Supported languages: {SUPPORTED_LANGUAGES}'
                        })
                
                update_parts.append(f'{attr_name} = :{field}')
                expr_values[f':{field}'] = body[field]
            
        # Handle kids array if present
        if 'kids' in body:
            # Validate kid data
            for kid in body['kids']:
                if 'name' not in kid or 'schoolCity' not in kid:
                    return create_response(400, {'message': 'Each kid must have name and schoolCity'})
                if 'kidId' not in kid:
                    kid['kidId'] = str(uuid.uuid4())
            
            update_parts.append('kids = :kids')
            expr_values[':kids'] = body['kids']
        
        # If no fields to update
        if len(update_parts) == 1:  # only updatedAt
            return create_response(400, {'message': 'No fields to update provided'})
            
        # Construct final update expression
        update_expr = 'SET ' + ', '.join(update_parts)
            
        user_profiles_table.update_item(
            Key={'userId': user_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values
        )
        
        return create_response(200, {'message': 'Profile updated successfully'})
        
    except Exception as e:
        return create_response(500, {'message': f'Error updating user profile: {str(e)}'})

def add_kid(event: Dict) -> Dict:
    """
    Add a new child to user's profile.
    
    Args:
        event (Dict): API Gateway event object containing user context and child data
        
    Returns:
        Dict: API Gateway response containing new kidId or error
        
    Raises:
        Exception: If there's an error accessing DynamoDB
    """
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        body = json.loads(event['body'])
        current_time = int(datetime.now().timestamp())
        
        # Validate required fields
        if 'name' not in body or 'schoolCity' not in body:
            return create_response(400, {'message': 'Missing required fields: name and schoolCity required'})
            
        # Generate new kidId
        kid_id = str(uuid.uuid4())
        new_kid = {
            'kidId': kid_id,
            'name': body['name'],
            'schoolCity': body['schoolCity'],
            'createdAt': current_time,
            'updatedAt': current_time
        }
        
        # Add kid to user's profile and update timestamps
        user_profiles_table.update_item(
            Key={'userId': user_id},
            UpdateExpression='SET #kids = list_append(if_not_exists(#kids, :empty_list), :new_kid), updatedAt = :updatedAt',
            ExpressionAttributeNames={'#kids': 'kids'},
            ExpressionAttributeValues={
                ':empty_list': [],
                ':new_kid': [new_kid],
                ':updatedAt': current_time
            }
        )
        
        return create_response(200, {
            'message': 'Kid added successfully',
            'kidId': kid_id,
            'createdAt': current_time,
            'updatedAt': current_time
        })
        
    except Exception as e:
        return create_response(500, {'message': f'Error adding kid: {str(e)}'})

def get_document_status(event: Dict) -> Dict:
    """
    Get the processing status of a document.
    
    Args:
        event (Dict): API Gateway event object containing user context and iepId
        
    Returns:
        Dict: API Gateway response containing document status or error
        
    Raises:
        Exception: If there's an error accessing DynamoDB
    """
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        iep_id = event['pathParameters']['iepId']
        
        # Get document
        response = iep_documents_table.get_item(
            Key={'iepId': iep_id}
        )
        
        if 'Item' not in response:
            return create_response(404, {'message': 'Document not found'})
            
        document = response['Item']
        
        # Verify document belongs to requesting user
        if document['userId'] != user_id:
            return create_response(403, {'message': 'Not authorized to access this document'})
            
        return create_response(200, {
            'status': document.get('status', 'PROCESSING'),
            'documentUrl': document['documentUrl'],
            'createdAt': document['createdAt'],
            'updatedAt': document['updatedAt']
        })
        
    except Exception as e:
        return create_response(500, {'message': f'Error getting document status: {str(e)}'})

def get_kid_documents(event: Dict) -> Dict:
    """
    Get documents associated with a specific child.
    
    Args:
        event (Dict): API Gateway event object containing user context and kidId
        
    Returns:
        Dict: API Gateway response containing list of documents or error
        
    Raises:
        Exception: If there's an error accessing DynamoDB
    """
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        kid_id = event['pathParameters']['kidId']
        
        # Query documents by kidId
        response = iep_documents_table.query(
            IndexName='byKidId',
            KeyConditionExpression='kidId = :kidId',
            ExpressionAttributeValues={':kidId': kid_id}
        )
        
        # Verify the documents belong to the requesting user and include status
        documents = [
            {
                'iepId': doc['iepId'],
                'kidId': doc['kidId'],
                'documentUrl': doc['documentUrl'],
                'status': doc.get('status', 'PROCESSING'),
                'summaries': doc.get('summaries', {}),
                'createdAt': doc['createdAt'],
                'updatedAt': doc['updatedAt']
            }
            for doc in response['Items']
            if doc['userId'] == user_id
        ]
        
        return create_response(200, {'documents': documents})
        
    except Exception as e:
        return create_response(500, {'message': f'Error getting kid documents: {str(e)}'})

def get_document_summary(event: Dict) -> Dict:
    """
    Get document summary in specified language.
    
    Args:
        event (Dict): API Gateway event object containing user context, iepId and language code
        
    Returns:
        Dict: API Gateway response containing document summary or error
        
    Raises:
        Exception: If there's an error accessing DynamoDB
    """
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        body = json.loads(event['body'])
        
        if 'iepId' not in body or 'langCode' not in body:
            return create_response(400, {'message': 'Missing required fields: iepId and langCode'})
            
        if not validate_language(body['langCode']):
            return create_response(400, {'message': f'Unsupported language. Supported languages: {SUPPORTED_LANGUAGES}'})
            
        # Get document
        response = iep_documents_table.get_item(
            Key={'iepId': body['iepId']}
        )
        
        if 'Item' not in response:
            return create_response(404, {'message': 'Document not found'})
            
        document = response['Item']
        
        # Verify document belongs to requesting user
        if document['userId'] != user_id:
            return create_response(403, {'message': 'Not authorized to access this document'})

        # Check if document is processed
        if document.get('status') != 'PROCESSED':
            return create_response(400, {
                'message': 'Document is not yet processed',
                'status': document.get('status', 'PROCESSING')
            })
            
        # Get summary in requested language
        if 'summaries' not in document or body['langCode'] not in document['summaries']:
            return create_response(404, {'message': f'Summary not available in {body["langCode"]}'})
            
        return create_response(200, {
            'summary': document['summaries'][body['langCode']],
            'documentUrl': document['documentUrl'],
            'status': document['status']
        })
        
    except Exception as e:
        return create_response(500, {'message': f'Error getting document summary: {str(e)}'})

def lambda_handler(event: Dict, context) -> Dict:
    """
    Main Lambda handler function that routes requests to appropriate handlers.
    
    Args:
        event (Dict): API Gateway event object
        context: Lambda context object
        
    Returns:
        Dict: API Gateway response
    """
    http_method = event['requestContext']['http']['method']
    route_key = event.get('routeKey', '')
    
    if http_method == 'OPTIONS':
        return handle_options()
    elif http_method == 'GET' and 'kidId' in event.get('pathParameters', {}):
        return get_kid_documents(event)
    elif http_method == 'GET' and 'iepId' in event.get('pathParameters', {}):
        return get_document_status(event)
    elif http_method == 'GET':
        return get_user_profile(event)
    elif http_method == 'PUT':
        return update_user_profile(event)
    elif http_method == 'POST' and route_key == 'POST /profile/kids':
        return add_kid(event)
    elif http_method == 'POST' and route_key == 'POST /summary':
        return get_document_summary(event)
    else:
        return create_response(400, {'message': 'Invalid route'}) 