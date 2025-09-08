# IEP Processing Step Functions Architecture

This document describes the refactored IEP document processing system that uses AWS Step Functions instead of a monolithic Lambda function.

## Architecture Overview

The IEP document processing workflow has been broken down into orchestrated steps using AWS Step Functions with individual Lambda functions for each processing stage.

### Key Benefits

- **Progress Tracking**: Real-time progress updates (0-100%) visible to users
- **Improved Reliability**: Automatic retries and error handling at each step  
- **Better Observability**: Detailed execution logs and state transitions
- **Parallel Processing**: Parsing and missing info extraction run concurrently
- **Scalability**: Each step can be scaled independently

## Workflow Steps

| Step | Progress | Current Step | Description | Timeout |
|------|----------|-------------|-------------|---------|
| UpdateDDBStart | 5% | "start" | Initialize processing status | 60s |
| MistralOCR | 15% | "ocr" | Extract text using Mistral OCR | 600s |
| RedactOCR | 20% | "pii_redaction" | Remove PII using AWS Comprehend | 300s |
| DeleteOriginal | 22% | "cleanup_original" | Delete uploaded S3 file | 60s |
| **ParallelWork** | - | - | Run parsing and missing info concurrently | - |
| ├─ ParsingAgent | 65% | "analyze_english" | Generate English summary/sections | 900s |
| └─ MissingInfoAgent | 40% | "missing_info" | Extract missing info insights | 300s |
| SaveEnglish | 70% | "english_saved" | Save English results, set PROCESSING_TRANSLATIONS | 120s |
| TransformAgent | 85% | "translations" | Translate based on user preferences | 900s |  
| SaveFinal | 100% | "done" | Save final results, set PROCESSED | 120s |
| RecordFailure | 0% | "error" | Record failure state and error details | 60s |

## State Machine Components

### Input Format
```json
{
  "iep_id": "iep-123-abc", 
  "user_id": "user-456-def",
  "child_id": "child-789-ghi", 
  "s3_bucket": "knowledge-bucket",
  "s3_key": "user-456-def/child-789-ghi/iep-123-abc/document.pdf"
}
```

### Progress Tracking
Each step updates the DynamoDB record with:
- `progress`: Integer 0-100 representing completion percentage
- `current_step`: String identifier for the current processing stage  
- `status`: Overall document status (PROCESSING → PROCESSING_TRANSLATIONS → PROCESSED)
- `updated_at`: ISO timestamp of last update

### Error Handling
- Each step has automatic retry policy: 3 attempts with exponential backoff
- Any unhandled errors route to `RecordFailure` step
- Failure state sets `status="FAILED"`, `current_step="error"`, and `last_error` message

## Lambda Functions

### Orchestrator (`orchestrator.py`)
- **Trigger**: S3 OBJECT_CREATED events
- **Role**: Starts Step Functions execution with parsed S3 event data
- **Timeout**: 60 seconds
- **Environment**: `STATE_MACHINE_ARN`

### Step Handlers

Each step handler follows the same pattern:
- Import `shared_utils` for progress tracking
- Update DynamoDB with progress and current step
- Process the specific task (OCR, translation, etc.)  
- Return event data with additional results
- Handle errors gracefully with `handle_step_error`

#### Key Environment Variables
- `BUCKET`: S3 knowledge bucket name
- `IEP_DOCUMENTS_TABLE`: DynamoDB table for document records
- `USER_PROFILES_TABLE`: DynamoDB table for user profiles
- `MISTRAL_API_KEY_PARAMETER_NAME`: SSM parameter for Mistral API key
- `OPENAI_API_KEY_PARAMETER_NAME`: SSM parameter for OpenAI API key

## Frontend Integration

### Polling Behavior
The existing frontend polling mechanism (`useDocumentFetch` + `PollingManager`) continues to work unchanged:
- Polls `GET /profile/children/{childId}/documents` every 5 seconds
- Displays progress percentage and current step to users
- Stops polling when `status="PROCESSED"` or `status="FAILED"`

### Progress Display
Frontend should show:
- Progress bar: `progress` field (0-100)
- Status text: `current_step` field mapped to user-friendly messages
- Error state: When `status="FAILED"`, show `last_error` message

Example progress mapping:
```javascript
const stepMessages = {
  "start": "Initializing...",
  "ocr": "Extracting text from document...", 
  "pii_redaction": "Removing sensitive information...",
  "cleanup_original": "Cleaning up files...",
  "analyze_english": "Analyzing document content...",
  "missing_info": "Identifying missing information...", 
  "english_saved": "English analysis complete...",
  "translations": "Translating to your preferred languages...",
  "done": "Processing complete!",
  "error": "Processing failed"
};
```

## Deployment Notes

### Migration Strategy
1. Deploy the new Step Functions infrastructure alongside the old monolithic Lambda
2. Update the S3 trigger to use the new orchestrator Lambda
3. Verify progress tracking and document processing work correctly
4. Monitor for any issues and rollback if needed
5. Remove the old monolithic Lambda after validation

### Monitoring
- Step Functions execution logs are sent to the existing CloudWatch log group
- Each Lambda function has individual CloudWatch logs
- State machine provides visual execution flow in AWS Console
- DynamoDB items include `progress`, `current_step`, and `updated_at` for debugging

### Rollback Plan
If issues arise:
1. Revert S3 trigger to use the old monolithic Lambda
2. The old processing code remains unchanged and functional
3. Frontend polling will continue to work with either system

## File Structure
```
lib/chatbot-api/
├── state-machines/
│   └── iep-processing.asl.json          # Step Functions definition
├── functions/
│   ├── functions.ts                      # Updated CDK infrastructure  
│   └── metadata-handler/
│       ├── orchestrator.py               # Thin S3 event handler
│       └── steps/
│           ├── shared_utils.py           # Common progress tracking utilities
│           ├── update_ddb_start/
│           │   ├── handler.py           
│           │   └── requirements.txt
│           ├── mistral_ocr/
│           │   ├── handler.py
│           │   └── requirements.txt
│           ├── redact_ocr/
│           │   ├── handler.py  
│           │   └── requirements.txt
│           ├── delete_original/
│           │   ├── handler.py
│           │   └── requirements.txt
│           ├── parsing_agent/
│           │   ├── handler.py
│           │   └── requirements.txt
│           ├── missing_info_agent/
│           │   ├── handler.py
│           │   └── requirements.txt
│           ├── save_english/
│           │   ├── handler.py
│           │   └── requirements.txt
│           ├── transform_agent/
│           │   ├── handler.py
│           │   └── requirements.txt
│           ├── save_final/
│           │   ├── handler.py
│           │   └── requirements.txt
│           └── record_failure/
│               ├── handler.py
│               └── requirements.txt
```

## Testing

To test the new system:
1. Upload a document through the UI
2. Observe progress updates in the document polling API
3. Verify final status transitions from PROCESSING → PROCESSING_TRANSLATIONS → PROCESSED
4. Check that document summaries and translations are saved correctly
5. Test error scenarios (invalid files, API failures) to ensure proper error handling

## Business Logic Preservation

⚠️ **Important**: No prompts or business logic have been changed. The refactoring only:
- Broke down the monolithic function into orchestrated steps
- Added progress tracking and better error handling  
- Improved observability and reliability
- All OpenAI prompts, data processing, and translation logic remain identical
