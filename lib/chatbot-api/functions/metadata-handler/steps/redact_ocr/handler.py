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
        
        # Process OCR result for PII redaction
        if ocr_result and 'pages' in ocr_result and isinstance(ocr_result['pages'], list):
            print(f"Processing OCR result with {len(ocr_result['pages'])} pages for PII redaction")
            
            # Get text content from each page
            page_texts = []
            for page in ocr_result['pages']:
                if 'text' in page:
                    page_texts.append(page['text'])
            
            if page_texts:
                print(f"Redacting PII from {len(page_texts)} pages of text")
                
                # Use Comprehend to redact PII
                redacted_texts = redact_pii_from_texts(page_texts)
                
                if redacted_texts:
                    # Create redacted OCR result
                    redacted_ocr_result = {**ocr_result}  # Copy original structure
                    
                    # Update pages with redacted text
                    for i, page in enumerate(redacted_ocr_result['pages']):
                        if i < len(redacted_texts):
                            page['text'] = redacted_texts[i]
                    
                    print(f"PII redaction completed successfully")
                    
                    return {
                        **event,  # Pass through all input data
                        'redacted_ocr_result': redacted_ocr_result
                    }
                else:
                    raise Exception("PII redaction failed - no redacted text returned")
            else:
                raise Exception("No text found in OCR pages for redaction")
        else:
            raise Exception("Invalid OCR result format for redaction")
            
    except Exception as e:
        print(f"RedactOCR error: {str(e)}")
        print(traceback.format_exc())
        raise  # Let Step Functions retry policy handle the error