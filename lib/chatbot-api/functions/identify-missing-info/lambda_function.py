import os
import json
import boto3
import logging
from typing import Any, Dict, List
from openai import OpenAI
from prompts import BASE_INSTRUCTIONS, SYSTEM_PROMPT
from pydantic import BaseModel, ValidationError, field_validator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _get_table():
    dynamodb = boto3.resource('dynamodb')
    table_name = os.environ['IEP_DOCUMENTS_TABLE']
    return dynamodb.Table(table_name)


def _get_document_item(iep_id: str, child_id: str | None) -> Dict[str, Any] | None:
    table = _get_table()
    key: Dict[str, Any] = {'iepId': iep_id}
    if child_id:
        key['childId'] = child_id
    resp = table.get_item(Key=key)
    item = resp.get('Item')
    if item:
        return item
    # Fallback: if no childId was provided but item uses a sort key, try scanning for iepId
    if not child_id:
        try:
            # As a last resort; table size is expected to be small per user context
            scan_resp = table.scan()
            for it in scan_resp.get('Items', []):
                if it.get('iepId') == iep_id:
                    return it
        except Exception as e:
            logger.warning(f"Fallback scan failed: {str(e)}")
    return None


def _get_openai_client() -> OpenAI | None:
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        logger.error('OPENAI_API_KEY not found in environment variables - CDK should pass this directly')
        return None
    return OpenAI(api_key=key)


class MissingInfoItem(BaseModel):
    description: str
    category: str | None = None

    @field_validator('description')
    def description_not_empty(cls, v: str) -> str:
        if not isinstance(v, str) or not v.strip():
            raise ValueError('description must be a non-empty string')
        return v.strip()

class MissingInfoList(BaseModel):
    items: List[MissingInfoItem]

    @classmethod
    def from_any(cls, data: Any) -> 'MissingInfoList':
        # Accept array directly or wrapped shapes like { "missing_items": [...] } or { "items": [...] }
        if isinstance(data, list):
            return cls(items=data)  # pydantic will coerce list[dict] -> list[MissingInfoItem]
        if isinstance(data, dict):
            for key in ['items', 'missing_items', 'weak_items', 'results']:
                val = data.get(key)
                if isinstance(val, list):
                    return cls(items=val)
        # Fallback: wrap single dict or string
        if isinstance(data, dict):
            return cls(items=[data])
        if isinstance(data, str) and data.strip():
            return cls(items=[{'description': data.strip()}])
        return cls(items=[])


def _agentic_missing_info(ocr_text: str) -> Dict[str, Any]:
    client = _get_openai_client()
    if not client:
        return { 'error': 'openai-key-missing' }
    try:
        messages = [
            { 'role': 'system', 'content': SYSTEM_PROMPT },
            { 'role': 'user', 'content': f"{BASE_INSTRUCTIONS}\n\nOCR_TEXT:\n{ocr_text}" }
        ]
        resp = client.chat.completions.create(
            model='gpt-4.1',
            messages=messages,
            temperature=0.0
        )
        content = resp.choices[0].message.content if resp and resp.choices else ''
        try:
            cleaned = content.replace('```json', '').replace('```', '').strip()
            data = json.loads(cleaned)
        except Exception:
            data = content
        try:
            validated = MissingInfoList.from_any(data)
            return { 'items': [item.model_dump() for item in validated.items] }
        except ValidationError as ve:
            logger.error(f"Validation error: {str(ve)}")
            return { 'items': [] }
    except Exception as e:
        logger.error(f"OpenAI request failed: {str(e)}")
        return { 'error': str(e) }


def _fallback_to_original_document(iep_id: str, child_id: str | None):
    """
    Fallback to original document OCR data if redacted data is not available
    """
    logger.info("Falling back to original document OCR data")
    
    item = _get_document_item(iep_id, child_id)
    if not item:
        logger.warning(f"IEP document not found for iepId={iep_id}, childId={child_id}")
        return { 'statusCode': 404, 'body': json.dumps({'message': 'Document not found'}) }

    # Get OCR text from original document
    ocr_text = ''
    if isinstance(item, dict):
        pages = item.get('ocrPages')
        if isinstance(pages, list):
            numbered = []
            for i, txt in enumerate(pages, 1):
                if isinstance(txt, str) and txt:
                    numbered.append(f"\n\n=== Page {i} ===\n{txt}")
            ocr_text = ''.join(numbered)
        if not ocr_text:
            compact = item.get('ocrText')
            if isinstance(compact, dict) and 'S' in compact:
                compact = compact.get('S')
            if isinstance(compact, str):
                ocr_text = compact

    analysis = _agentic_missing_info(ocr_text)
    logger.info(f"Identify missing info result (fallback) for {iep_id}: {json.dumps(analysis)}")

    # Note: Results are now saved by the missing info agent via DDB service
    # No direct table write needed here to avoid conflicts with final results

    return { 'statusCode': 200, 'body': json.dumps({'iepId': iep_id, 'items': analysis.get('items', [])}) }


def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")
    iep_id = event.get('iepId') or event.get('iep_id')
    child_id = event.get('childId') or event.get('child_id')
    user_id = event.get('userId') or event.get('user_id')
    
    if not iep_id:
        logger.error("iepId is required in event")
        return { 'statusCode': 400, 'body': json.dumps({'message': 'iepId required'}) }

    # Get redacted OCR data from DynamoDB via centralized DDB service
    ocr_text = ''
    try:
        logger.info("Retrieving redacted OCR data from DynamoDB...")
        
        # Call DDB service to get redacted OCR result
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
        
        ddb_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(ddb_payload)
        )
        
        ddb_result = json.loads(ddb_response['Payload'].read())
        logger.info(f"DDB response: {ddb_result}")
        
        if ddb_result.get('statusCode') != 200:
            logger.warning(f"Failed to get redacted OCR data from DDB: {ddb_result}")
            # Fallback to original document if redacted data not available
            return _fallback_to_original_document(iep_id, child_id)
        
        # Extract redacted OCR data from DDB response
        response_body = json.loads(ddb_result['body'])
        redacted_ocr_data = response_body['data']
        
        # Extract text from redacted OCR data
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
                
        logger.info(f"Successfully extracted {len(ocr_text)} characters of redacted OCR text")
        
    except Exception as e:
        logger.error(f"Error retrieving redacted OCR data: {str(e)}")
        # Fallback to original document
        return _fallback_to_original_document(iep_id, child_id)

    analysis = _agentic_missing_info(ocr_text)

    logger.info(f"Identify missing info result for {iep_id}: {json.dumps(analysis)}")

    # Note: Results are now saved by the missing info agent via DDB service
    # No direct table write needed here to avoid conflicts with final results

    return { 'statusCode': 200, 'body': json.dumps({'iepId': iep_id, 'items': analysis.get('items', [])}) }


