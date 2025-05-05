# Metadata Handler

The Metadata Handler is a core component in the AI-IEP backend that processes uploaded IEP documents, extracts information, and generates summaries using AI technologies. This documentation provides details about its implementation, configuration, and usage.

## Overview

This Lambda function is triggered whenever a document is uploaded to the knowledge S3 bucket. It performs the following key operations:

1. **Document Retrieval**: Downloads the document from S3
2. **OCR Processing**: Uses Mistral AI to extract text from documents
3. **PII Redaction**: Uses AWS Comprehend to detect and redact Personally Identifiable Information
4. **Content Analysis**: Processes the extracted text using OpenAI or AWS Bedrock to generate structured metadata
5. **Summary Generation**: Creates summaries of different IEP sections
6. **Status Updates**: Updates document status in DynamoDB 
7. **User Profile Updates**: Associates document metadata with user profiles

## Architecture

```
Document Upload → S3 Event → Lambda Trigger → OCR Processing → Content Analysis → DynamoDB Updates
```

## Dependencies

The function requires the following components:

- **AWS Services**:
  - S3: For document storage and retrieval
  - DynamoDB: For storing document metadata and processing status
  - Comprehend: For PII detection and redaction
  - Systems Manager Parameter Store: For accessing API keys
  - Bedrock: For AI model access (optional)

- **External APIs**:
  - Mistral AI: For OCR processing
  - OpenAI: For document analysis and summarization

## Configuration

### Environment Variables

- `BUCKET`: Name of the S3 bucket containing IEP documents
- `IEP_DOCUMENTS_TABLE`: Name of the DynamoDB table for document metadata
- `USER_PROFILES_TABLE`: Name of the DynamoDB table for user profiles
- `MISTRAL_API_KEY_PARAMETER_NAME`: SSM parameter name for Mistral API key
- `OPENAI_API_KEY_PARAMETER_NAME`: SSM parameter name for OpenAI API key

### Required Permissions

The Lambda function requires permissions to:

- Read from and write to S3 buckets
- Read from and write to DynamoDB tables
- Access AWS Comprehend for PII detection
- Access AWS Bedrock models (if used)
- Retrieve parameters from SSM Parameter Store

## Implementation Details

### Main Processing Pipeline

The document processing pipeline is implemented in `lambda_function.py` and follows these steps:

1. **Event Processing**: Extract S3 object information from the event
2. **Document Retrieval**: Download the document from S3
3. **Format Detection**: Identify document format (PDF, image, etc.)
4. **OCR Processing**: Send document to Mistral AI for text extraction
5. **PII Redaction**: Use AWS Comprehend to detect and redact personal information
6. **Content Analysis**: Process extracted text with LLMs to identify key sections
7. **Summary Generation**: Create concise summaries of each section
8. **Metadata Storage**: Update document status and metadata in DynamoDB
9. **User Profile Update**: Associate document with user profile

### OCR Processing (mistral_ocr.py)

The OCR module uses Mistral AI's capabilities to:

1. Extract text from documents while preserving layout information
2. Handle various document formats including PDFs and images
3. Process multiple pages with efficient batching
4. Return extracted text with positional data

### Content Analysis (open_ai_agent.py)

The OpenAI Agent module:

1. Processes extracted text to identify IEP sections
2. Uses prompt engineering to extract structured data
3. Generates summaries of key sections
4. Formats data for storage in DynamoDB

### PII Redaction (comprehend_redactor.py)

The PII redaction module:

1. Uses AWS Comprehend to detect various types of PII
2. Redacts sensitive information from extracted text
3. Maintains context while protecting privacy
4. Supports multiple types of PII entities

## Workflow

1. User uploads an IEP document through the frontend
2. Upload is stored in S3 bucket
3. S3 event triggers the metadata handler Lambda
4. Lambda updates document status to "PROCESSING"
5. Document is sent to Mistral AI for OCR processing
6. Extracted text is processed to redact PII
7. Content is analyzed and structured data is extracted
8. Document status is updated to "PROCESSED" with metadata
9. If any errors occur, status is set to "FAILED" with error information

## Error Handling

The Lambda function implements comprehensive error handling:

- Each processing step is wrapped in try/except blocks
- Detailed error information is logged to CloudWatch
- Document status is updated with error information if processing fails
- S3 objects are retained even if processing fails
- Retry mechanism for transient errors

## Development Guidelines

When modifying this component:

1. Update the OCR prompt in `mistral_ocr.py` to improve extraction quality
2. Modify prompts in `open_ai_agent.py` to enhance analysis
3. Adjust error handling logic in `lambda_function.py` as needed
4. Update the data model in `data_model.py` if new fields are required

## Performance Considerations

- The function has a timeout of 900 seconds (15 minutes) to handle large documents
- Memory is set to 2048MB to provide sufficient resources for AI processing
- Large documents may take longer to process
- Consider cost implications of API calls to external services

## Testing

When testing changes:

1. Use sample documents of various formats and sizes
2. Validate OCR quality with different document layouts
3. Test error handling by introducing failures at different stages
4. Verify DynamoDB updates are correct after processing
5. Check CloudWatch logs for any warnings or errors

## Monitoring

The function is monitored via:

- CloudWatch Logs for detailed execution information
- DynamoDB table metrics for document status updates
- S3 event notifications for upload tracking
- Lambda execution metrics for performance analysis 