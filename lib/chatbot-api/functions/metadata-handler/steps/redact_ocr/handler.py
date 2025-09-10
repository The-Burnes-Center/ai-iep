"""
Redact PII from OCR text using AWS Comprehend - Core business logic only
"""
import json
import traceback
from comprehend_redactor import redact_pii_from_texts

def lambda_handler(event, context):
    """
    Redact PII from OCR text using AWS Comprehend.
    Core redaction logic only - DDB operations handled by centralized service.
    """
    print(f"RedactOCR handler received: {json.dumps(event)}")
    
    try:
        ocr_result = event['ocr_result']
        
        print("Starting PII redaction")
        print(f"OCR result type: {type(ocr_result)}")
        print(f"OCR result keys: {list(ocr_result.keys()) if isinstance(ocr_result, dict) else 'Not a dict'}")
        
        # Handle Step Functions nested structure - the actual OCR result may be nested
        actual_ocr_result = ocr_result
        if isinstance(ocr_result, dict) and 'ocr_result' in ocr_result:
            print("Found nested OCR result from Step Functions")
            actual_ocr_result = ocr_result['ocr_result']
            print(f"Nested OCR result keys: {list(actual_ocr_result.keys()) if isinstance(actual_ocr_result, dict) else 'Not a dict'}")
        
        # Handle different OCR result formats
        page_texts = []
        
        # Format 1: OCR format with 'pages' array (Mistral and legacy)
        if actual_ocr_result and 'pages' in actual_ocr_result and isinstance(actual_ocr_result['pages'], list):
            print(f"Processing OCR format with {len(actual_ocr_result['pages'])} pages")
            
            for page in actual_ocr_result['pages']:
                # Follow original monolithic lambda priority: content → text → markdown → fallback
                if 'content' in page and page.get('content'):
                    page_texts.append(page.get('content', ''))
                elif 'text' in page and page.get('text'):
                    page_texts.append(page.get('text', ''))
                elif 'markdown' in page and page.get('markdown'):
                    page_texts.append(page.get('markdown', ''))
                else:
                    # Fallback: find any string field with substantial content
                    text_fields = [v for k, v in page.items() 
                                  if isinstance(v, str) and len(v) > 20]
                    if text_fields:
                        page_texts.append(text_fields[0])
                    else:
                        page_texts.append('')
        
        # Format 2: Mistral OCR format with 'document' structure
        elif actual_ocr_result and 'document' in actual_ocr_result:
            print("Processing Mistral OCR format")
            document = actual_ocr_result['document']
            
            if 'pages' in document and isinstance(document['pages'], list):
                print(f"Found {len(document['pages'])} pages in document format")
                for page in document['pages']:
                    if 'content' in page and page.get('content'):
                        page_texts.append(page.get('content', ''))
                    elif 'text' in page and page.get('text'):
                        page_texts.append(page.get('text', ''))
                    elif 'markdown' in page and page.get('markdown'):
                        page_texts.append(page.get('markdown', ''))
                    else:
                        # Fallback
                        text_fields = [v for k, v in page.items() 
                                      if isinstance(v, str) and len(v) > 20]
                        if text_fields:
                            page_texts.append(text_fields[0])
                        else:
                            page_texts.append('')
            elif 'text' in document:
                # Single text field for entire document
                print("Found single text field in Mistral document")
                page_texts.append(document['text'])
        
        # Format 3: Direct text content (fallback)
        elif actual_ocr_result and 'text' in actual_ocr_result:
            print("Processing direct text format")
            page_texts.append(actual_ocr_result['text'])
        
        # Format 4: Check if it's a string directly
        elif isinstance(actual_ocr_result, str):
            print("Processing string format")
            page_texts.append(actual_ocr_result)
        
        else:
            print(f"Unrecognized OCR format. Available keys: {list(actual_ocr_result.keys()) if isinstance(actual_ocr_result, dict) else 'N/A'}")
            print(f"OCR result sample: {str(actual_ocr_result)[:500]}")
            raise Exception("Invalid OCR result format for redaction")
        
        if page_texts:
            print(f"Redacting PII from {len(page_texts)} pages of text")
            
            # Use Comprehend to redact PII
            redacted_texts, stats = redact_pii_from_texts(page_texts)
            
            if redacted_texts:
                # Create redacted OCR result maintaining original structure
                redacted_ocr_result = {**ocr_result}  # Copy original structure
                
                # Get reference to the actual OCR data to update
                target_ocr_result = redacted_ocr_result
                if 'ocr_result' in redacted_ocr_result:
                    target_ocr_result = redacted_ocr_result['ocr_result']
                
                # Update based on detected format
                if 'pages' in actual_ocr_result and isinstance(actual_ocr_result['pages'], list):
                    # Follow original monolithic lambda priority: content → text → markdown
                    for i, page in enumerate(target_ocr_result['pages']):
                        if i < len(redacted_texts):
                            if 'content' in page:
                                page['content'] = redacted_texts[i]
                            elif 'text' in page:
                                page['text'] = redacted_texts[i]
                            elif 'markdown' in page:
                                page['markdown'] = redacted_texts[i]
                elif 'document' in actual_ocr_result:
                    # Document format
                    if 'pages' in actual_ocr_result['document']:
                        for i, page in enumerate(target_ocr_result['document']['pages']):
                            if i < len(redacted_texts):
                                if 'content' in page:
                                    page['content'] = redacted_texts[i]
                                elif 'text' in page:
                                    page['text'] = redacted_texts[i]
                                elif 'markdown' in page:
                                    page['markdown'] = redacted_texts[i]
                    elif 'text' in actual_ocr_result['document']:
                        target_ocr_result['document']['text'] = redacted_texts[0]
                elif 'text' in actual_ocr_result:
                    # Direct text format
                    target_ocr_result['text'] = redacted_texts[0]
                elif isinstance(actual_ocr_result, str):
                    # String format - this case is more complex with nested structure
                    if 'ocr_result' in redacted_ocr_result:
                        redacted_ocr_result['ocr_result'] = redacted_texts[0]
                    else:
                        redacted_ocr_result = redacted_texts[0]
                
                print(f"PII redaction completed successfully. Stats: {stats}")
                
                return {
                    **event,  # Pass through all input data
                    'redacted_ocr_result': redacted_ocr_result,
                    'redaction_stats': stats
                }
            else:
                raise Exception("PII redaction failed - no redacted text returned")
        else:
            raise Exception("No text found in OCR result for redaction")
            
    except Exception as e:
        print(f"RedactOCR error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error