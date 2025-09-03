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
        param = os.environ.get('OPENAI_API_KEY_PARAMETER_NAME')
        if param:
            ssm = boto3.client('ssm')
            resp = ssm.get_parameter(Name=param, WithDecryption=True)
            key = resp['Parameter']['Value']
            os.environ['OPENAI_API_KEY'] = key
    if not key:
        logger.error('OPENAI_API_KEY not available')
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


def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")
    iep_id = event.get('iepId') or event.get('iep_id')
    child_id = event.get('childId') or event.get('child_id')
    if not iep_id:
        logger.error("iepId is required in event")
        return { 'statusCode': 400, 'body': json.dumps({'message': 'iepId required'}) }

    item = _get_document_item(iep_id, child_id)
    if not item:
        logger.warning(f"IEP document not found for iepId={iep_id}, childId={child_id}")
        return { 'statusCode': 404, 'body': json.dumps({'message': 'Document not found'}) }

    # Prefer array of redacted page texts, fallback to compact text
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

    logger.info(f"Identify missing info result for {iep_id}: {json.dumps(analysis)}")

    # Persist results back to the same item
    try:
        table = _get_table()
        key: Dict[str, Any] = {'iepId': iep_id}
        if child_id:
            key['childId'] = child_id
        items = analysis.get('items') if isinstance(analysis, dict) else None
        table.update_item(
            Key=key,
            UpdateExpression='SET missingInfo = :mi',
            ExpressionAttributeValues={ ':mi': (items if isinstance(items, list) else []) }
        )
    except Exception as e:
        logger.warning(f"Failed to write missing info: {str(e)}")

    return { 'statusCode': 200, 'body': json.dumps({'iepId': iep_id, 'items': analysis.get('items', [])}) }


