import json
import os
import boto3
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Literal
from router import Router, UserProfileRouter, RouteNotFoundException
import base64

dynamodb = boto3.resource('dynamodb')
user_profiles_table = dynamodb.Table(os.environ['USER_PROFILES_TABLE'])
iep_documents_table = dynamodb.Table(os.environ['IEP_DOCUMENTS_TABLE'])

SUPPORTED_LANGUAGES = ['en', 'zh', 'es', 'vi']
DEFAULT_LANGUAGE = 'en'

# Document processing statuses
DocumentStatus = Literal['PROCESSING', 'PROCESSED', 'FAILED']
DOCUMENT_STATUSES: List[DocumentStatus] = ['PROCESSING', 'PROCESSED', 'FAILED']

class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle Decimal types from DynamoDB."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def get_origin_from_event(event: Dict) -> str:
    """
    Extract origin from event headers in a case-insensitive way.
    
    Args:
        event (Dict): The API Gateway event object
        
    Returns:
        str: The origin header value or default localhost
    """
    headers = event.get('headers', {})
    print("Request headers:", json.dumps(headers, indent=2))
    
    # Case-insensitive search for origin header
    origin_header = next(
        (headers[key] for key in headers if key.lower() == 'origin'),
        'http://localhost:3000'
    )
    print("Found origin:", origin_header)
    return origin_header

def create_response(event: Dict, status_code: int, body: Dict) -> Dict:
    """
    Create a standardized API response with CORS headers.
    
    Args:
        event (Dict): The API Gateway event object
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
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST, PUT, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }

def handle_options(event: Dict) -> Dict:
    """
    Handle OPTIONS requests for CORS preflight.
    
    Args:
        event (Dict): The API Gateway event object
        
    Returns:
        Dict: API Gateway response with CORS headers
    """
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST, PUT, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
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

def get_timestamps() -> Dict[str, any]:
    """
    Generate both Unix timestamp in milliseconds and human-readable ISO format.
    
    Returns:
        Dict containing both timestamp formats
    """
    now = datetime.utcnow()
    return {
        'timestamp': int(now.timestamp() * 1000),  # Unix timestamp in milliseconds
        'datetime': now.isoformat() + 'Z'  # ISO 8601 format with Z suffix for UTC
    }

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
        claims = event['requestContext']['authorizer']['jwt']['claims']
        print("Full Cognito claims:", json.dumps(claims, indent=2))
        
        user_id = claims['sub']
        print(f"Retrieved from Cognito - userId: {user_id}")
        
        response = user_profiles_table.get_item(
            Key={'userId': user_id}
        )
        
        times = get_timestamps()
        
        if 'Item' not in response:
            print(f"No existing profile found for userId: {user_id}, creating new profile")
            new_profile = {
                'userId': user_id,
                'createdAt': times['timestamp'],
                'createdAtISO': times['datetime'],
                'updatedAt': times['timestamp'],
                'updatedAtISO': times['datetime'],
                'children': []
            }
            user_profiles_table.put_item(Item=new_profile)
            return create_response(event, 200, {'profile': new_profile})
        
        existing_profile = response['Item']
        return create_response(event, 200, {'profile': existing_profile})
        
    except Exception as e:
        print(f"Error in get_user_profile: {str(e)}")
        print(f"Event data: {json.dumps(event, default=str)}")
        return create_response(event, 500, {'message': f'Error getting user profile: {str(e)}'})

def update_user_profile(event: Dict) -> Dict:
    """
    Update user profile information. Supports partial updates - only provided fields will be updated.
    Email cannot be updated directly as it is managed by Cognito.
    
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
        times = get_timestamps()
        
        # Start building update expression and values
        update_parts = []
        expr_values = {
            ':updatedAt': times['timestamp'],
            ':updatedAtISO': times['datetime']
        }
        update_parts.append('updatedAt = :updatedAt')
        update_parts.append('updatedAtISO = :updatedAtISO')
        
        # Handle optional fields
        optional_fields = {
            'phone': 'phone',
            'city': 'city',
            'primaryLanguage': 'primaryLanguage',
            'secondaryLanguage': 'secondaryLanguage'
        }

        # If email is in the request, return an error
        if 'email' in body:
            return create_response(event, 400, {
                'message': 'Email cannot be updated directly. Please update your email through account settings.'
            })
        
        for field, attr_name in optional_fields.items():
            if field in body:
                # Special validation for language fields
                if field in ['primaryLanguage', 'secondaryLanguage']:
                    if body[field] and not validate_language(body[field]):
                        return create_response(event, 400, {
                            'message': f'Unsupported language for {field}. Supported languages: {SUPPORTED_LANGUAGES}'
                        })
                
                update_parts.append(f'{attr_name} = :{field}')
                expr_values[f':{field}'] = body[field]
            
        # Handle children array if present
        if 'children' in body:
            # Validate child data
            for child in body['children']:
                if 'name' not in child or 'schoolCity' not in child:
                    return create_response(event, 400, {'message': 'Each child must have name and schoolCity'})
                if 'childId' not in child:
                    child['childId'] = str(uuid.uuid4())
            
            update_parts.append('children = :children')
            expr_values[':children'] = body['children']
        
        # If no fields to update
        if len(update_parts) == 1:  # only updatedAt
            return create_response(event, 400, {'message': 'No fields to update provided'})
            
        # Construct final update expression
        update_expr = 'SET ' + ', '.join(update_parts)
            
        user_profiles_table.update_item(
            Key={'userId': user_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values
        )
        
        return create_response(event, 200, {'message': 'Profile updated successfully'})
        
    except Exception as e:
        return create_response(event, 500, {'message': f'Error updating user profile: {str(e)}'})

def add_child(event: Dict) -> Dict:
    """
    Add a new child to user's profile.
    
    Args:
        event (Dict): API Gateway event object containing user context and child data
        
    Returns:
        Dict: API Gateway response containing new childId or error
        
    Raises:
        Exception: If there's an error accessing DynamoDB
    """
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        body = json.loads(event['body'])
        times = get_timestamps()
        
        # Validate required fields
        if 'name' not in body or 'schoolCity' not in body:
            return create_response(event, 400, {'message': 'Missing required fields: name and schoolCity required'})
            
        # Generate new childId
        child_id = str(uuid.uuid4())
        new_child = {
            'childId': child_id,
            'name': body['name'],
            'schoolCity': body['schoolCity'],
            'createdAt': times['timestamp'],
            'createdAtISO': times['datetime'],
            'updatedAt': times['timestamp'],
            'updatedAtISO': times['datetime']
        }
        
        # Add child to user's profile and update timestamps
        user_profiles_table.update_item(
            Key={'userId': user_id},
            UpdateExpression='SET #children = list_append(if_not_exists(#children, :empty_list), :new_child), updatedAt = :updatedAt, updatedAtISO = :updatedAtISO',
            ExpressionAttributeNames={'#children': 'children'},
            ExpressionAttributeValues={
                ':empty_list': [],
                ':new_child': [new_child],
                ':updatedAt': times['timestamp'],
                ':updatedAtISO': times['datetime']
            }
        )
        
        return create_response(event, 200, {
            'message': 'Child added successfully',
            'childId': child_id,
            'createdAt': times['timestamp'],
            'createdAtISO': times['datetime'],
        })
        
    except Exception as e:
        return create_response(event, 500, {'message': f'Error adding child: {str(e)}'})

def get_child_documents(event: Dict) -> Dict:
    """
    Get document associated with a specific child.
    
    Args:
        event (Dict): API Gateway event object containing user context and childId
        
    Returns:
        Dict: API Gateway response containing the document or error.
        Only returns the most recent document for the child.
        
    Raises:
        Exception: If there's an error accessing DynamoDB
    """
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        child_id = event['pathParameters']['childId']
        
        # Query documents by childId
        response = iep_documents_table.query(
            IndexName='byChildId',
            KeyConditionExpression='childId = :childId',
            ExpressionAttributeValues={':childId': child_id}
        )
        
        # Find the latest document
        latest_doc = None
        latest_timestamp = 0
        
        for doc in response['Items']:
            # Only include document if userId is not present or it matches the authenticated user
            if 'userId' not in doc or doc['userId'] == user_id:
                # Find the document with the latest createdAt timestamp
                created_at = doc.get('createdAt', 0)
                if created_at > latest_timestamp:
                    latest_timestamp = created_at
                    latest_doc = {
                        'iepId': doc['iepId'],
                        'childId': doc['childId'],
                        'documentUrl': doc.get('documentUrl', f"s3://{os.environ.get('BUCKET', '')}/{doc['iepId']}"),
                        'status': doc.get('status', 'PROCESSING'),
                        'summaries': doc.get('summaries', {}),
                        'sections': doc.get('sections', {}),
                        'createdAt': doc.get('createdAt', ''),
                        'updatedAt': doc.get('updatedAt', '')
                    }
        
        # If no document found
        if not latest_doc:
            return create_response(event, 404, {'message': 'No document found for this child'})
        
        return create_response(event, 200, latest_doc)
        
    except Exception as e:
        return create_response(event, 500, {'message': f'Error retrieving document: {str(e)}'})

def lambda_handler(event: Dict, context) -> Dict:
    """
    Main Lambda handler function that routes requests to appropriate handlers using the router.
    
    Args:
        event (Dict): API Gateway event object
        context: Lambda context object
        
    Returns:
        Dict: API Gateway response
    """
    print(f"Lambda handler invoked with event: {json.dumps(event, default=str)}")
    
    try:
        # Handle OPTIONS request for CORS
        if event['requestContext']['http']['method'] == 'OPTIONS':
            print("Handling OPTIONS request for CORS")
            return handle_options(event)

        # Get path and method
        path = event['rawPath']
        method = event['requestContext']['http']['method']
        print(f"Processing {method} request for path: {path}")

        # Initialize router
        router = Router()
        profile_router = UserProfileRouter()

        # Register routes from UserProfileRouter
        for attr_name in dir(profile_router):
            attr = getattr(profile_router, attr_name)
            if hasattr(attr, 'path') and hasattr(attr, 'method'):
                router.add_route(attr.path, attr.method, getattr(profile_router, attr_name))
                
        print(f"Attempting to match route for path: {path}, method: {method}")
        # Match and execute route
        handler, path_params = router.match_route(path, method)
        print(f"Route matched. Handler: {handler.__name__}, Path params: {path_params}")
        
        # Update path parameters
        if not event.get('pathParameters'):
            event['pathParameters'] = {}
        event['pathParameters'].update(path_params)
        
        print(f"Invoking handler: {handler.__name__} with updated pathParameters: {event.get('pathParameters')}")
        return handler(event)

    except RouteNotFoundException as e:
        print(f"Route not found: {path} with method {method}")
        return create_response(event, 404, {'message': str(e)})
    except Exception as e:
        error_message = f"Error processing request: {str(e)}, Type: {type(e).__name__}"
        print(error_message)
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return create_response(event, 500, {'message': f'Internal server error: {str(e)}'}) 