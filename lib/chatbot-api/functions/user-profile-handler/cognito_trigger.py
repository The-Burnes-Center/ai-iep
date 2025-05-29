import json
import os
import boto3
from datetime import datetime
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
user_profiles_table = dynamodb.Table(os.environ['USER_PROFILES_TABLE'])

def lambda_handler(event, context):
    """
    Cognito Post Confirmation Lambda Trigger.
    Creates a default user profile after user confirms their account.
    Only creates profile if one doesn't already exist.
    
    Args:
        event: Cognito trigger event containing user data
        context: Lambda context
        
    Returns:
        event: Returns the event object back to Cognito
    """
    try:
        # Get user attributes from the event
        user_id = event['userName']
        
        # Check if profile already exists
        try:
            existing_profile = user_profiles_table.get_item(
                Key={'userId': user_id}
            )
            
            if 'Item' in existing_profile:
                print(f"Profile already exists for user {user_id}, skipping creation")
                return event
                
        except ClientError as e:
            print(f"Error checking existing profile: {str(e)}")
            # Continue with profile creation if check fails
        
        # Create timestamp
        current_time = int(datetime.now().timestamp())
        
        # Create default profile only if one doesn't exist
        new_profile = {
            'userId': user_id,
            'createdAt': current_time,
            'updatedAt': current_time,
            'children': [],  # Initialize empty children array
            'consentGiven': False  # Add new field with default value of false
        }
        
        # Use put_item with condition to prevent overwriting
        user_profiles_table.put_item(
            Item=new_profile,
            ConditionExpression='attribute_not_exists(userId)'
        )
        
        print(f"Created default profile for user {user_id}")
        
        # Return the event back to Cognito
        return event
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            print(f"Profile already exists for user {user_id}, no action needed")
        else:
            print(f"Error creating user profile: {str(e)}")
        # Still return event to allow user creation even if profile creation fails
        return event
    except Exception as e:
        print(f"Error creating user profile: {str(e)}")
        # Still return event to allow user creation even if profile creation fails
        return event 