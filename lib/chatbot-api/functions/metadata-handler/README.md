# IEP Document Metadata Handler

## Overview
The Metadata Handler is a serverless AWS Lambda function that processes IEP (Individualized Education Program) documents uploaded to S3. It extracts text, generates summaries, translates content into multiple languages, and stores structured data in DynamoDB for easy retrieval via API endpoints.

## Key Features
- **Text Extraction**: Extracts text from PDF documents using Google Document AI (primary) with PyPDF2 fallback
- **Content Analysis**: Uses Claude 3.5 Sonnet to generate document summaries, identify sections, and assign tags
- **Multilingual Support**: Translates summaries and sections into multiple languages based on user preferences
- **API Access**: Provides endpoints to retrieve document metadata, summaries, and sections in different languages
- **Structured Storage**: Stores processed data in DynamoDB with proper indexing for efficient retrieval

## Workflow
1. **Document Upload**: PDF is uploaded to S3 bucket, triggering Lambda via S3 event
2. **Text Extraction**: System extracts text using Google Document AI with PyPDF2 fallback
3. **Content Analysis**: Claude analyzes document to generate summary, sections, and tags
4. **Translation**: Content is translated to languages configured in user profiles
5. **Data Storage**: 
   - Processed document data stored in IEP Documents table
   - Reference to document stored in User Profiles table
6. **API Access**: Document content retrieved via API endpoints with language selection

## Components
- **lambda_function.py**: Main handler orchestrating the entire process
- **google_auth.py**: Handles Document AI integration for text extraction
- **config.py**: Contains prompts, section definitions, and language codes
- **requirements.txt**: Dependencies for the Lambda function

## DynamoDB Schema

### IEP Documents Table
- `iepId` (String, Partition Key): UUID of the document
- `childId` (String, Sort Key): ID of the child associated with the IEP
- `userId` (String): ID of the parent/user who owns the document
- `status` (String): Processing status ('PROCESSING', 'PROCESSED', 'FAILED')
- `documentUrl` (String): S3 location of the original document
- `createdAt` (Number): Epoch timestamp for sorting
- `updatedAt` (String): ISO timestamp for last update
- `summaries` (Map): Contains translations of the document summary
- `sections` (Map): Contains structured sections with translations
- `tags` (List): Categorization tags for the document

### User Profiles Reference
Only references to documents are stored in the User Profiles table:
```json
{
  "userId": "user123",
  "children": [
    {
      "childId": "child456",
      "iepDocuments": [
        {
          "iepId": "uuid-123",
          "documentUrl": "s3://bucket/uuid-123",
          "updatedAt": "2023-01-01T12:00:00"
        }
      ]
    }
  ]
}
```

## API Endpoints

### Get Document Metadata
- **Path**: `/document/{iepId}`
- **Method**: GET
- **Query Parameters**:
  - `lang` (optional): Language code (defaults to 'en')
- **Response**: Document metadata including summary, sections, and available languages

## Configuration
The function uses the following environment variables:
- `IEP_DOCUMENTS_TABLE`: DynamoDB table for document storage
- `USER_PROFILES_TABLE`: DynamoDB table for user profiles
- `BUCKET`: S3 bucket for document storage
- `DOCUMENT_AI_PROJECT_ID`: Google Cloud project ID for Document AI
- `DOCUMENT_AI_LOCATION`: Google Cloud region for Document AI
- `DOCUMENT_AI_PROCESSOR_ID`: Document AI processor ID
- `GOOGLE_SERVICE_ACCOUNT_SECRET`: AWS Secrets Manager secret name for Google credentials
- `CLAUDE_MODEL_ID`: Claude model ID for content analysis and translation

## Error Handling
- Each major operation is wrapped in try/except blocks
- System falls back to alternative methods when primary methods fail
- Document status is updated to reflect processing failures
- Detailed logging is provided for troubleshooting

## Deployment
The function is deployed as part of the AWS CDK stack in the `lib/chatbot-api/functions/functions.ts` file. The deployment includes all necessary IAM permissions for DynamoDB, S3, AWS Bedrock, and Secrets Manager. 