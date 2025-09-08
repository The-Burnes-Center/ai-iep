"""
Shared utilities for Step Functions handlers
"""
import os
import boto3
import json
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, Optional

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')

def update_progress(
    iep_id: str,
    child_id: str,
    progress: int,
    current_step: str,
    status: Optional[str] = None,
    error_message: Optional[str] = None,
    additional_fields: Optional[Dict[str, Any]] = None
) -> None:
    """
    Update progress tracking in DynamoDB for the IEP document.
    
    Args:
        iep_id: The IEP document ID
        child_id: The child ID
        progress: Progress percentage (0-100)
        current_step: Current processing step name
        status: Optional status update
        error_message: Optional error message
        additional_fields: Optional additional fields to update
    """
    try:
        table = dynamodb.Table(os.environ['IEP_DOCUMENTS_TABLE'])
        current_time = datetime.now().isoformat()
        
        # Build update expression
        update_expr = "SET progress = :progress, current_step = :current_step, updatedAt = :updated_at"
        expr_values = {
            ':progress': progress,
            ':current_step': current_step,
            ':updated_at': current_time
        }
        
        if status:
            update_expr += ", #status = :status"
            expr_values[':status'] = status
        
        if error_message:
            update_expr += ", last_error = :error"
            expr_values[':error'] = error_message
        
        # Add any additional fields
        if additional_fields:
            for field_name, field_value in additional_fields.items():
                update_expr += f", {field_name} = :add_{field_name}"
                expr_values[f':add_{field_name}'] = field_value
        
        # Expression attribute names if needed
        expr_names = {}
        if status:
            expr_names['#status'] = 'status'
        
        update_params = {
            'Key': {'iepId': iep_id, 'childId': child_id},
            'UpdateExpression': update_expr,
            'ExpressionAttributeValues': expr_values,
            'ReturnValues': 'NONE'
        }
        
        if expr_names:
            update_params['ExpressionAttributeNames'] = expr_names
        
        table.update_item(**update_params)
        print(f"Updated progress: {progress}%, step: {current_step}, status: {status}")
        
    except Exception as e:
        print(f"Error updating progress: {str(e)}")
        raise

def convert_floats_to_decimal(obj):
    """Convert floats to Decimal for DynamoDB compatibility"""
    if isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimal(item) for item in obj]
    elif isinstance(obj, float):
        return Decimal(str(obj))
    else:
        return obj

def format_dynamodb_attribute(data):
    """Format data for DynamoDB attribute format"""
    if isinstance(data, dict):
        return {"M": {k: format_dynamodb_attribute(v) for k, v in data.items()}}
    elif isinstance(data, list):
        return {"L": [format_dynamodb_attribute(item) for item in data]}
    elif isinstance(data, str):
        return {"S": data}
    elif isinstance(data, bool):
        return {"BOOL": data}
    elif isinstance(data, (int, float)):
        return {"N": str(data)}
    elif data is None:
        return {"NULL": True}
    else:
        return {"S": str(data)}

def create_step_function_response(
    event: Dict[str, Any],
    additional_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create a standardized response for Step Function tasks.
    
    Args:
        event: The input event from the previous step
        additional_data: Additional data to include in the response
        
    Returns:
        Dict containing the event data plus any additional fields
    """
    response = {
        'iep_id': event.get('iep_id'),
        'user_id': event.get('user_id'), 
        'child_id': event.get('child_id'),
        's3_bucket': event.get('s3_bucket'),
        's3_key': event.get('s3_key')
    }
    
    # Copy over any existing intermediate results
    for key in ['ocr_result', 'redacted_ocr_result', 'english_result', 'missing_info', 'final_result']:
        if key in event:
            response[key] = event[key]
    
    # Add any additional data
    if additional_data:
        response.update(additional_data)
    
    return response

def get_api_key_from_ssm(param_name: str) -> str:
    """Retrieve API key from SSM Parameter Store"""
    try:
        ssm = boto3.client('ssm')
        response = ssm.get_parameter(Name=param_name, WithDecryption=True)
        return response['Parameter']['Value']
    except Exception as e:
        print(f"Error retrieving parameter {param_name}: {str(e)}")
        raise

def handle_step_error(
    iep_id: str,
    child_id: str,
    step_name: str,
    error: Exception,
    progress: int
) -> Dict[str, Any]:
    """
    Handle errors in step function handlers.
    
    Args:
        iep_id: The IEP document ID
        child_id: The child ID  
        step_name: Name of the current step
        error: The exception that occurred
        progress: Current progress value
        
    Returns:
        Error response dict
    """
    error_message = f"Error in {step_name}: {str(error)}"
    print(error_message)
    
    try:
        update_progress(
            iep_id=iep_id,
            child_id=child_id,
            progress=progress,
            current_step="error",
            status="FAILED",
            error_message=error_message
        )
    except Exception as update_error:
        print(f"Failed to update error status: {str(update_error)}")
    
    return {
        'error': error_message,
        'step': step_name,
        'iep_id': iep_id,
        'child_id': child_id
    }
