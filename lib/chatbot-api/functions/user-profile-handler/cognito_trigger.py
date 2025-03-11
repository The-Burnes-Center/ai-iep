import json
import os
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
user_profiles_table = dynamodb.Table(os.environ['USER_PROFILES_TABLE'])

def lambda_handler(event, context):
    """
    Cognito Post Confirmation Lambda Trigger.
    Creates a default user profile after user confirms their account.
    
    Args:
        event: Cognito trigger event containing user data
        context: Lambda context
        
    Returns:
        event: Returns the event object back to Cognito
    """
    try:
        # Get user attributes from the event
        user_id = event['userName']
        
        # Create timestamp
        current_time = int(datetime.now().timestamp())
        
        # Create default profile
        new_profile = {
            'userId': user_id,
            'createdAt': current_time,
            'updatedAt': current_time,
            'children': [],  # Initialize empty children array
            'consentGiven': False  # Add new field with default value of false
        }
        
        # Save to DynamoDB
        user_profiles_table.put_item(Item=new_profile)
        
        print(f"Created default profile for user {user_id}")
        
        # Return the event back to Cognito
        return event
    except Exception as e:
        print(f"Error creating user profile: {str(e)}")
        # Still return event to allow user creation even if profile creation fails
        return event 