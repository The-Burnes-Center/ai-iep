"""
DynamoDB Service Lambda - Centralized database operations for Step Functions workflow
Handles all DynamoDB read/write operations with standardized interface
"""
import json
import os
import boto3
import traceback
from datetime import datetime
from decimal import Decimal

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['IEP_DOCUMENTS_TABLE'])

def lambda_handler(event, context):
    """
    Central DynamoDB service for all database operations.
    
    Expected event structure:
    {
        "operation": "update_progress|get_user_prefs|save_results|record_failure|get_document|save_ocr_data|get_ocr_data|get_analysis_data|save_final_results",
        "params": {
            // operation-specific parameters
        }
    }
    """
    print(f"DDB Service received: {json.dumps(event, default=str)}")
    
    try:
        operation = event.get('operation')
        params = event.get('params', {})
        
        if operation == 'update_progress':
            return update_progress(params)
        elif operation == 'get_user_prefs':
            return get_user_preferences(params)
        elif operation == 'save_results':
            return save_results(params)
        elif operation == 'record_failure':
            return record_failure(params)
        elif operation == 'get_document':
            return get_document(params)
        elif operation == 'save_ocr_data':
            return save_ocr_data(params)
        elif operation == 'get_ocr_data':
            return get_ocr_data(params)
        elif operation == 'get_analysis_data':
            return get_analysis_data(params)
        elif operation == 'save_final_results':
            return save_final_results(params)
        else:
            raise ValueError(f"Unknown operation: {operation}")
            
    except Exception as e:
        print(f"DDB Service error: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'operation': event.get('operation', 'unknown')
            }, default=str)
        }

def update_progress(params):
    """Update document processing progress and status"""
    iep_id = params['iep_id']
    child_id = params['child_id'] 
    user_id = params['user_id']
    status = params.get('status', 'PROCESSING')
    current_step = params['current_step']
    progress = params['progress']
    error_message = params.get('error_message')
    last_error = params.get('last_error')
    
    update_expression = "SET #status = :status, current_step = :current_step, progress = :progress, updated_at = :updated_at"
    expression_values = {
        ':status': status,
        ':current_step': current_step,
        ':progress': progress,
        ':updated_at': datetime.utcnow().isoformat()
    }
    expression_names = {'#status': 'status'}
    
    if error_message:
        update_expression += ", error_message = :error_message"
        expression_values[':error_message'] = error_message
        
    if last_error:
        update_expression += ", last_error = :last_error"
        expression_values[':last_error'] = last_error
    
    table.update_item(
        Key={
            'iepId': iep_id,
            'childId': child_id
        },
        UpdateExpression=update_expression,
        ExpressionAttributeNames=expression_names,
        ExpressionAttributeValues=expression_values
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Progress updated successfully',
            'iep_id': iep_id,
            'status': status,
            'progress': progress,
            'current_step': current_step
        }, default=str)
    }

def get_user_preferences(params):
    """Get user language preferences from profile"""
    user_id = params['user_id']
    
    # Use the user profiles table instead of documents table
    user_table = dynamodb.Table(os.environ['USER_PROFILES_TABLE'])
    response = user_table.get_item(
        Key={'userId': user_id}
    )
    
    if 'Item' not in response:
        # Default to English only
        return {
            'statusCode': 200,
            'body': json.dumps({
                'languages': ['en'],
                'default_language': 'en'
            })
        }
    
    profile = response['Item']
    languages = profile.get('languages', ['en'])
    default_language = profile.get('default_language', 'en')
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'languages': languages,
            'default_language': default_language
        })
    }

def save_results(params):
    """Save processing results to DynamoDB"""
    iep_id = params['iep_id']
    child_id = params['child_id']
    user_id = params['user_id']
    results = params['results']
    result_type = params.get('result_type', 'analysis')  # 'analysis', 'missing_info', 'translations'
    
    update_expression = f"SET {result_type} = :results, updated_at = :updated_at"
    expression_values = {
        ':results': results,
        ':updated_at': datetime.utcnow().isoformat()
    }
    
    table.update_item(
        Key={
            'iepId': iep_id,
            'childId': child_id
        },
        UpdateExpression=update_expression,
        ExpressionAttributeValues=expression_values
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': f'{result_type} results saved successfully',
            'iep_id': iep_id
        }, default=str)
    }

def record_failure(params):
    """Record processing failure"""
    iep_id = params['iep_id']
    child_id = params['child_id']
    user_id = params['user_id']
    error_message = params['error_message']
    failed_step = params.get('failed_step', 'unknown')
    
    table.update_item(
        Key={
            'iepId': iep_id,
            'childId': child_id
        },
        UpdateExpression="SET #status = :status, error_message = :error_message, last_error = :last_error, failed_step = :failed_step, updated_at = :updated_at",
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':status': 'FAILED',
            ':error_message': error_message,
            ':last_error': error_message,
            ':failed_step': failed_step,
            ':updated_at': datetime.utcnow().isoformat()
        }
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Failure recorded successfully',
            'iep_id': iep_id,
            'error': error_message
        }, default=str)
    }

def get_document(params):
    """Get document metadata and current processing status"""
    iep_id = params['iep_id']
    child_id = params['child_id']
    user_id = params['user_id']
    
    response = table.get_item(
        Key={
            'iepId': iep_id,
            'childId': child_id
        }
    )
    
    if 'Item' not in response:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Document not found'})
        }
    
    # Convert Decimal types to float for JSON serialization
    item = response['Item']
    
    return {
        'statusCode': 200,
        'body': json.dumps(item, default=str)
    }

def save_ocr_data(params):
    """Save OCR data to DynamoDB"""
    iep_id = params['iep_id']
    child_id = params['child_id']
    user_id = params['user_id']
    ocr_data = params['ocr_data']
    data_type = params.get('data_type', 'ocr_result')  # 'ocr_result' or 'redacted_ocr_result'
    
    update_expression = f"SET {data_type} = :ocr_data, updated_at = :updated_at"
    expression_values = {
        ':ocr_data': ocr_data,
        ':updated_at': datetime.utcnow().isoformat()
    }
    
    table.update_item(
        Key={
            'iepId': iep_id,
            'childId': child_id
        },
        UpdateExpression=update_expression,
        ExpressionAttributeValues=expression_values
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': f'{data_type} saved successfully',
            'iep_id': iep_id
        }, default=str)
    }

def get_ocr_data(params):
    """Get OCR data from DynamoDB"""
    iep_id = params['iep_id']
    child_id = params['child_id']
    user_id = params['user_id']
    data_type = params.get('data_type', 'ocr_result')  # 'ocr_result' or 'redacted_ocr_result'
    
    response = table.get_item(
        Key={
            'iepId': iep_id,
            'childId': child_id
        }
    )
    
    if 'Item' not in response:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Document not found'})
        }
    
    item = response['Item']
    
    if data_type not in item:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': f'{data_type} not found'})
        }
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'data': item[data_type]
        }, default=str)
    }

def save_final_results(params):
    """Save final results to DynamoDB in API-compatible format"""
    iep_id = params['iep_id']
    child_id = params['child_id']
    user_id = params['user_id']
    final_result = params['final_result']
    
    # Extract individual components from final result
    summaries = final_result.get('summaries', {})
    sections = final_result.get('sections', {})
    document_index = final_result.get('document_index', {})
    abbreviations = final_result.get('abbreviations', {})
    missing_info = final_result.get('missingInfo', [])
    
    # Build update expression for all fields
    update_expression = "SET summaries = :summaries, sections = :sections, document_index = :document_index, abbreviations = :abbreviations, missingInfo = :missing_info, updated_at = :updated_at"
    
    expression_values = {
        ':summaries': summaries,
        ':sections': sections,
        ':document_index': document_index,
        ':abbreviations': abbreviations,
        ':missing_info': missing_info,
        ':updated_at': datetime.utcnow().isoformat()
    }
    
    table.update_item(
        Key={
            'iepId': iep_id,
            'childId': child_id
        },
        UpdateExpression=update_expression,
        ExpressionAttributeValues=expression_values
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Final results saved successfully',
            'iep_id': iep_id,
            'summaries_languages': list(summaries.keys()),
            'sections_languages': list(sections.keys()),
            'missing_info_count': len(missing_info)
        }, default=str)
    }

def get_analysis_data(params):
    """Get analysis data from DynamoDB (english_result, missing_info_result, etc.)"""
    iep_id = params['iep_id']
    child_id = params['child_id']
    user_id = params['user_id']
    data_type = params.get('data_type', 'english_result')  # 'english_result', 'missing_info_result', etc.
    
    response = table.get_item(
        Key={
            'iepId': iep_id,
            'childId': child_id
        }
    )
    
    if 'Item' not in response:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Document not found'})
        }
    
    item = response['Item']
    
    if data_type not in item:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': f'{data_type} not found'})
        }
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'data': item[data_type]
        }, default=str)
    }

def save_final_results(params):
    """Save final results to DynamoDB in API-compatible format"""
    iep_id = params['iep_id']
    child_id = params['child_id']
    user_id = params['user_id']
    final_result = params['final_result']
    
    # Extract individual components from final result
    summaries = final_result.get('summaries', {})
    sections = final_result.get('sections', {})
    document_index = final_result.get('document_index', {})
    abbreviations = final_result.get('abbreviations', {})
    missing_info = final_result.get('missingInfo', [])
    
    # Build update expression for all fields
    update_expression = "SET summaries = :summaries, sections = :sections, document_index = :document_index, abbreviations = :abbreviations, missingInfo = :missing_info, updated_at = :updated_at"
    
    expression_values = {
        ':summaries': summaries,
        ':sections': sections,
        ':document_index': document_index,
        ':abbreviations': abbreviations,
        ':missing_info': missing_info,
        ':updated_at': datetime.utcnow().isoformat()
    }
    
    table.update_item(
        Key={
            'iepId': iep_id,
            'childId': child_id
        },
        UpdateExpression=update_expression,
        ExpressionAttributeValues=expression_values
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Final results saved successfully',
            'iep_id': iep_id,
            'summaries_languages': list(summaries.keys()),
            'sections_languages': list(sections.keys()),
            'missing_info_count': len(missing_info)
        }, default=str)
    }
