# IEP Document Metadata Handler

This Lambda function processes IEP documents uploaded to S3 and extracts metadata, summaries, and structured information.

## Key Features

- **OCR Processing**: Extracts text from PDF documents using Mistral OCR API
- **Text Extraction**: Extracts text from PDF documents using PyPDF2
- **Summarization**: Generates concise summaries of IEP documents using Amazon Bedrock
- **Section Classification**: Identifies and classifies key sections of IEP documents
- **Translation**: Supports translating summaries and sections into multiple languages
- **Database Integration**: Stores document metadata in DynamoDB tables
- **User Profile Integration**: Links documents to user profiles

## Processing Workflow

1. **Document Upload**: User uploads IEP document to S3 bucket
2. **Text Extraction**: System extracts text using Mistral OCR API or PyPDF2
3. **Processing**: 
   - Document is summarized and sections are identified
   - Content is translated based on user language preferences
4. **Storage**: 
   - Summaries and structured data stored in DynamoDB
   - User profile updated with document reference
5. **API Access**: Document data available via API endpoints

## Technical Components

- **lambda_function.py**: Main Lambda handler for processing documents and serving API requests
- **mistral_ocr.py**: Handles integration with Mistral's OCR API
- **config.py**: Contains configuration settings and prompt templates
- **requirements.txt**: Lists required Python packages

## DynamoDB Tables

### IEP Documents Table
Contains document metadata, summaries, and section information:
```json
{
  "iepId": "uuid-123",
  "childId": "child-123",
  "userId": "user-123",
  "documentUrl": "s3://bucket/path/to/document.pdf",
  "status": "PROCESSED",
  "summaries": {
    "en": "English summary...",
    "es": "Spanish summary..."
  },
  "sections": {
    "en": {
      "section1": "Content...",
      "section2": "Content..."
    }
  },
  "ocrData": {
    "pages": [
      {
        "index": 0,
        "markdown": "Page content in markdown",
        "dimensions": {
          "dpi": 300,
          "height": 792,
          "width": 612
        }
      }
    ],
    "model": "mistral-ocr-2503-completion",
    "usage": {
      "pages_processed": 10,
      "document_size_bytes": 500000
    }
  },
  "createdAt": "2023-01-01T12:00:00Z",
  "updatedAt": "2023-01-01T12:05:00Z"
}
```

## API Endpoints

### Get Document Metadata
- **Path**: `/document/{iepId}`
- **Method**: GET
- **Query Parameters**:
  - `lang` (optional): Language code (defaults to 'en')
  - `include_ocr` (optional): Whether to include OCR data (defaults to 'true')
- **Response**: Document metadata including summary, sections, and OCR data

## Environment Variables
- `IEP_DOCUMENTS_TABLE`: DynamoDB table for document storage
- `USER_PROFILES_TABLE`: DynamoDB table for user profiles
- `BUCKET`: S3 bucket for document storage
- `KNOWLEDGE_BASE_ID`: Bedrock Knowledge Base ID
- `ANTHROPIC_MODEL`: Claude model ID for content analysis and translation
- `MISTRAL_API_KEY_PARAMETER_NAME`: SSM Parameter Store name for Mistral API key

## Error Handling
- Each major operation is wrapped in try/except blocks
- System falls back to alternative methods when primary methods fail
- Document status is updated to reflect processing failures
- Detailed logging is provided for troubleshooting

## Deployment
The function is deployed as part of the AWS CDK stack in the `lib/chatbot-api/functions/functions.ts` file. The deployment includes all necessary IAM permissions for DynamoDB, S3, AWS Bedrock, and SSM Parameter Store. 