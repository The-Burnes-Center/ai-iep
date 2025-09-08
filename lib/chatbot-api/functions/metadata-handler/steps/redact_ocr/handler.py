"""
Redact PII from OCR text using AWS Comprehend
"""
import json
import traceback
import boto3
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))
from shared_utils import update_progress, create_step_function_response, handle_step_error
from comprehend_redactor import redact_pii_from_texts

def lambda_handler(event, context):
    """
    Redact PII from OCR text using AWS Comprehend.
    Updates progress=20, current_step="pii_redaction"
    """
    print(f"RedactOCR handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id']
        child_id = event['child_id']
        ocr_result = event['ocr_result']
        
        print(f"Starting PII redaction for iepId: {iep_id}")
        
        # Update progress to PII redaction stage
        update_progress(
            iep_id=iep_id,
            child_id=child_id,
            progress=20,
            current_step="pii_redaction"
        )
        
        # Process OCR result for PII redaction
        if ocr_result and 'pages' in ocr_result and isinstance(ocr_result['pages'], list):
            print(f"Processing OCR result with {len(ocr_result['pages'])} pages for PII redaction")
            
            # Get text content from each page
            page_contents = []
            for page in ocr_result['pages']:
                if 'content' in page and page.get('content'):
                    page_contents.append(page.get('content', ''))
                elif 'text' in page and page.get('text'):
                    page_contents.append(page.get('text', ''))
                elif 'markdown' in page and page.get('markdown'):
                    page_contents.append(page.get('markdown', ''))
                else:
                    # Try to find any string field that could contain text
                    text_fields = [v for k, v in page.items() 
                                  if isinstance(v, str) and len(v) > 20]
                    if text_fields:
                        page_contents.append(text_fields[0])
                    else:
                        page_contents.append('')
            
            print(f"Beginning PII redaction on {sum(1 for c in page_contents if c)} non-empty pages")
            
            # Redact PII from page contents
            redacted_pages, pii_stats = redact_pii_from_texts(page_contents)
            
            # Update the content in the original structure
            for i, page in enumerate(ocr_result['pages']):
                if 'content' in page:
                    page['content'] = redacted_pages[i]
                elif 'text' in page:
                    page['text'] = redacted_pages[i]
                elif 'markdown' in page:
                    page['markdown'] = redacted_pages[i]
            
            # Add PII redaction stats to OCR result for tracking
            ocr_result['pii_redaction_stats'] = pii_stats
            print(f"PII redaction complete - redacted {pii_stats.get('redacted_entities', 0)} entities")
            
            # Save redacted OCR page texts to DynamoDB for downstream processing
            try:
                ocr_pages_texts = []
                for page in ocr_result['pages']:
                    if 'content' in page and page.get('content') is not None:
                        ocr_pages_texts.append(page.get('content', ''))
                    elif 'text' in page and page.get('text') is not None:
                        ocr_pages_texts.append(page.get('text', ''))
                    elif 'markdown' in page and page.get('markdown') is not None:
                        ocr_pages_texts.append(page.get('markdown', ''))
                    else:
                        # Fallback: any string field
                        text_fields = [v for k, v in page.items() if isinstance(v, str)]
                        ocr_pages_texts.append(text_fields[0] if text_fields else '')

                # Save OCR pages to DynamoDB
                from datetime import datetime
                dynamodb = boto3.resource('dynamodb')
                table = dynamodb.Table(os.environ['IEP_DOCUMENTS_TABLE'])
                
                table.update_item(
                    Key={'iepId': iep_id, 'childId': child_id},
                    UpdateExpression='SET ocrPages = :p, ocrPageCount = :n, ocrSavedAt = :t',
                    ExpressionAttributeValues={
                        ':p': ocr_pages_texts,
                        ':n': len(ocr_pages_texts),
                        ':t': datetime.now().isoformat()
                    }
                )
                print("Saved redacted OCR pages to DynamoDB")
                
            except Exception as save_err:
                print(f"Non-blocking: failed to persist redacted OCR pages to DynamoDB: {str(save_err)}")
        
        print(f"PII redaction completed for iepId: {iep_id}")
        
        # Return event with redacted OCR results
        response = create_step_function_response(event)
        response['redacted_ocr_result'] = ocr_result
        response['progress'] = 20
        response['current_step'] = "pii_redaction"
        
        return response
        
    except Exception as e:
        print(f"Error in RedactOCR: {str(e)}")
        print(traceback.format_exc())
        
        iep_id = event.get('iep_id', 'unknown')
        child_id = event.get('child_id', 'unknown')
        
        return handle_step_error(iep_id, child_id, "RedactOCR", e, 20)
