# IEP Document Metadata Handler

This Lambda function processes IEP documents uploaded to S3 and extracts metadata, summaries, and structured information using LLM-based processing.

## Key Features

- **OCR Processing**: Extracts text from PDF documents using Mistral OCR API
- **LLM Processing**: 
  - Document analysis and summarization using OpenAI's Agent architecture
  - Section identification and classification
  - Multi-language translation support
- **Database Integration**: Stores document metadata in DynamoDB tables
- **User Profile Integration**: Links documents to user profiles
- **API Access**: Provides endpoints for retrieving document metadata

## Processing Workflow

1. **Document Upload**: User uploads IEP document to S3 bucket
2. **OCR Processing**: System extracts text using Mistral OCR API
3. **LLM Processing**: 
   - Document is analyzed using OpenAI's Agent architecture
   - Content is structured into sections (Services, Goals, Accommodations, etc.)
   - Summaries are generated in multiple languages
4. **Storage**: 
   - Structured data stored in DynamoDB with proper type formatting
   - User profile updated with document reference
5. **API Access**: Document data available via API endpoints with language support

## Technical Components

- **lambda_function.py**: Main Lambda handler for processing documents and serving API requests
- **mistral_ocr.py**: Handles integration with Mistral's OCR API
- **open_ai_agent.py**: Manages OpenAI Agent-based document processing
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
    "M": {
      "en": {
        "S": "English summary..."
      },
      "es": {
        "S": "Spanish summary..."
      }
    }
  },
  "sections": {
    "M": {
      "en": {
        "M": {
          "Services": {
            "M": {
              "content": {
                "S": "Service details..."
              }
            }
          },
          "Goals": {
            "M": {
              "content": {
                "S": "Goal details..."
              }
            }
          }
        }
      },
      "es": {
        "M": {
          "Services": {
            "M": {
              "content": {
                "S": "Detalles de servicios..."
              }
            }
          }
        }
      }
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
  "createdAt": 1672531200000,
  "updatedAt": "2023-01-01T12:05:00Z"
}
```

## API Endpoints

### Get Document Metadata
- **Path**: `/document/{iepId}`
- **Method**: GET
- **Query Parameters**:
  - `lang` (optional): Language code (defaults to 'en')
- **Response**: Document metadata including summary and sections in the requested language

## Environment Variables
- `IEP_DOCUMENTS_TABLE`: DynamoDB table for document storage
- `USER_PROFILES_TABLE`: DynamoDB table for user profiles
- `BUCKET`: S3 bucket for document storage
- `OPENAI_API_KEY_PARAMETER_NAME`: SSM Parameter Store name for OpenAI API key
- `MISTRAL_API_KEY_PARAMETER_NAME`: SSM Parameter Store name for Mistral API key

## Error Handling
- Each major operation is wrapped in try/except blocks
- Document status is updated to reflect processing state (PROCESSING, PROCESSED, FAILED)
- Detailed logging is provided for troubleshooting
- Fallback mechanisms for DynamoDB operations when primary methods fail

## Deployment
The function is deployed as part of the AWS CDK stack in the `lib/chatbot-api/functions/functions.ts` file. The deployment includes all necessary IAM permissions for DynamoDB, S3, and SSM Parameter Store. 