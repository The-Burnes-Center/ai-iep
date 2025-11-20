"""
Extract IEP meeting notes verbatim - Core business logic only
Consolidates OCR retrieval, OpenAI extraction, and DDB storage
"""
import json
import os
import traceback
import boto3
import logging
from typing import Any, Dict
from openai import OpenAI
from prompts import BASE_INSTRUCTIONS, SYSTEM_PROMPT
from pydantic import BaseModel, ValidationError, field_validator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global cache for API key (reused across Lambda invocations)
_cached_openai_api_key = None

def _get_openai_client() -> OpenAI | None:
    global _cached_openai_api_key
    
    # Return cached client if available
    if _cached_openai_api_key:
        return OpenAI(api_key=_cached_openai_api_key)
    
    # First try direct environment variable
    key = os.environ.get('OPENAI_API_KEY')
    
    if key and not key.startswith('AQICA'):
        _cached_openai_api_key = key
        return OpenAI(api_key=key)
    
    # Fetch from SSM Parameter Store with decryption
    param = os.environ.get('OPENAI_API_KEY_PARAMETER_NAME')
    if param:
        try:
            ssm = boto3.client('ssm')
            resp = ssm.get_parameter(Name=param, WithDecryption=True)
            key = resp['Parameter']['Value']
            _cached_openai_api_key = key
            logger.info('Successfully retrieved and cached OPENAI_API_KEY from SSM')
            return OpenAI(api_key=key)
        except Exception as e:
            logger.error(f'Error retrieving OPENAI_API_KEY from SSM: {str(e)}')
    
    logger.error('OPENAI_API_KEY not available from environment or SSM')
    return None


class MeetingNotesExtraction(BaseModel):
    meeting_notes: str = "" 

    @field_validator('meeting_notes')
    def meeting_notes_validator(cls, v: str) -> str:
        if not isinstance(v, str):
            return ""
        return v.strip()


def _extract_meeting_notes(ocr_text: str) -> Dict[str, Any]:
    """Extract IEP meeting notes section verbatim using OpenAI"""
    client = _get_openai_client()
    if not client:
        return {'error': 'openai-key-missing'}
    
    try:
        messages = [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': f"{BASE_INSTRUCTIONS}\n\nOCR_TEXT:\n{ocr_text}"}
        ]
        resp = client.chat.completions.create(
            model='gpt-4o',
            messages=messages,
            temperature=0.0
        )
        content = resp.choices[0].message.content if resp and resp.choices else ''
        
        try:
            cleaned = content.replace('```json', '').replace('```', '').strip()
            data = json.loads(cleaned)
        except Exception:
            # If JSON parsing fails, try to extract as plain text
            data = {'meeting_notes': content}
        
        try:
            validated = MeetingNotesExtraction.model_validate(data)
            return {'meeting_notes': validated.meeting_notes}
        except ValidationError as ve:
            logger.error(f"Validation error: {str(ve)}")
            return {'meeting_notes': ''}
    except Exception as e:
        logger.error(f"OpenAI request failed: {str(e)}")
        return {'error': str(e)}


def lambda_handler(event, context):
    """
    Extract IEP meeting notes verbatim.
    Core extraction logic with DDB operations handled by centralized service.
    """
    print(f"ExtractMeetingNotes handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        
        print(f"Starting meeting notes extraction for iepId: {iep_id}")
        
        # Get redacted OCR data from DynamoDB via centralized DDB service
        lambda_client = boto3.client('lambda')
        ddb_service_name = os.environ.get('DDB_SERVICE_FUNCTION_NAME', 'DDBService')
        
        ddb_payload = {
            'operation': 'get_ocr_data',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'data_type': 'redacted_ocr_result'
            }
        }
        
        print(f"Retrieving redacted OCR data from DynamoDB...")
        ddb_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(ddb_payload)
        )
        
        # Parse the response
        payload_response = ddb_response['Payload'].read()
        
        if not payload_response:
            raise Exception("Empty response from DDB service")
        
        try:
            ddb_result = json.loads(payload_response)
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse DDB service response as JSON: {e}")
        
        print(f"DDB response: {ddb_result}")
        
        if ddb_result.get('statusCode') != 200:
            raise Exception(f"Failed to get redacted OCR data from DDB: {ddb_result}")
        
        # Extract redacted OCR data from DDB response
        response_body = json.loads(ddb_result['body'])
        redacted_ocr_data = response_body['data']
        
        # Extract text from redacted OCR data
        ocr_text = ''
        if isinstance(redacted_ocr_data, dict):
            pages = redacted_ocr_data.get('pages', [])
            if isinstance(pages, list):
                numbered = []
                for i, page in enumerate(pages, 1):
                    page_text = ''
                    if isinstance(page, dict):
                        # Priority: content → text → markdown
                        page_text = page.get('content') or page.get('text') or page.get('markdown', '')
                    elif isinstance(page, str):
                        page_text = page
                    
                    if page_text:
                        numbered.append(f"\n\n=== Page {i} ===\n{page_text}")
                        
                ocr_text = ''.join(numbered)
        
        print(f"Successfully extracted {len(ocr_text)} characters of redacted OCR text")
        
        # Extract meeting notes using OpenAI
        meeting_notes_result = _extract_meeting_notes(ocr_text)
        
        # Check for error in extraction
        if "error" in meeting_notes_result:
            error_message = f"Meeting notes extraction failed: {meeting_notes_result.get('error')}"
            print(error_message)
            raise Exception(error_message)
        
        print(f"Meeting notes extraction completed for iepId: {iep_id}")
        
        # Extract meeting notes text from result structure
        meeting_notes_text = meeting_notes_result.get('meeting_notes', '')
        
        # Save meeting notes directly to API-compatible field (meetingNotes.en)
        field_updates = {
            'meetingNotes.en': meeting_notes_text
        }
        
        save_payload = {
            'operation': 'save_api_fields',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id,
                'field_updates': field_updates
            }
        }
        
        save_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(save_payload)
        )
        
        # Handle Lambda invoke response safely
        save_payload_response = save_response['Payload'].read()
        
        if save_payload_response:
            try:
                save_result = json.loads(save_payload_response)
                if save_result and save_result.get('statusCode') == 200:
                    print("Meeting notes saved directly to API field (meetingNotes.en)")
                else:
                    print(f"Warning: Failed to save meeting notes to API field: {save_result}")
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to parse save DDB service response: {e}")
        else:
            print("Warning: Empty response from DDB service during meeting notes save")
        
        # Return minimal event (no need to pass large data through Step Functions)
        event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
        return {
            **event_copy,  # Pass through input data except progress tracking  
            'meeting_notes_completed': True,
            'meeting_notes_length': len(meeting_notes_text)
        }
        
    except Exception as e:
        print(f"ExtractMeetingNotes error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error
