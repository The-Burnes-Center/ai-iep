# User Profile Management System

This system manages user profiles, their children's information, and associated IEP documents in the AI-IEP platform.

## Profile Creation

User profiles are automatically created in two ways:

1. **Primary Method - Cognito Post Confirmation Trigger**:
   - A profile is automatically created when a user confirms their account
   - The trigger creates a basic profile with:
     - User ID (from Cognito)
     - Creation timestamp
     - Empty children array
     - consentGiven set to false by default

2. **Fallback Method - API Endpoint**:
   - If a profile doesn't exist when accessing `/profile` endpoint
   - Handles cases where:
     - The Cognito trigger failed
     - Legacy users from before trigger implementation
     - Profile was accidentally deleted

## User Identity Management

User identity information (email, etc.) is managed exclusively through Amazon Cognito:
- Email addresses are stored and managed in Cognito User Pool
- Email verification and updates must be done through Cognito
- Applications should retrieve email from Cognito tokens/claims
- Profile data focuses on application-specific information only

## Database Schema

### UserProfilesTable
```typescript
{
  userId: string,           // Partition key (from Cognito)
  phone: string,           // User's phone number (optional)
  primaryLanguage: string, // Primary language preference
  secondaryLanguage?: string, // Optional secondary language
  city: string,           // User's city of residence
  consentGiven: boolean,    // User's consent status (defaults to false)
  children: [                 // Array of children
    {
      childId: string,      // Unique identifier for child
      name: string,       // Child's name
      schoolCity: string,  // City where child attends school
      iepDocument: {        // Most recent IEP document for this child
        iepId: string,      // Unique document ID
        documentUrl: string, // S3 URL to the document
        updatedAt: string    // Last update timestamp
      }
    }
  ],
  createdAt: number,      // Creation timestamp
  updatedAt: number,      // Last update timestamp
  ttl?: number           // Optional TTL for record expiration
}
```

### IepDocumentsTable
```typescript
{
  iepId: string,          // Partition key
  childId: string,          // Sort key
  userId: string,         // Owner's user ID
  documentUrl: string,    // S3 URL to the document
  summaries: {            // Document summaries in different languages
    [languageCode: string]: string
  },
  sections: {             // Document sections in different languages
    [languageCode: string]: {
      [sectionTitle: string]: string
    }
  },
  status: string,         // Document processing status (PROCESSING, PROCESSED, FAILED, OCR_COMPLETED, OCR_FAILED)
  ocrData: {              // OCR extraction data from Mistral API
    pages: [              // Array of pages with extracted text
      {
        index: number,    // Page index (0-based)
        markdown: string, // Extracted text in markdown format
        images: any[],    // Any images found in the document
        dimensions: {     // Page dimensions
          dpi: number,    // Dots per inch
          height: number, // Page height
          width: number   // Page width
        }
      }
    ],
    model: string,        // Model used for OCR (e.g., "mistral-ocr-2503-completion")
    usage: {              // Usage statistics 
      pages_processed: number,    // Number of pages processed
      document_size_bytes: number // Document size in bytes
    },
    success: boolean      // Whether OCR processing was successful
  },
  ocrCompletedAt: string, // ISO timestamp when OCR processing completed
  createdAt: number,      // Creation timestamp
  updatedAt: number,      // Last update timestamp
  ttl?: number           // Optional TTL for record expiration
}
```

## File Upload Process

### 1. Get Upload URL
```http
POST /signed-url-knowledge
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "fileName": "string",
  "fileType": "string",
  "operation": "upload",
  "childId": "string"
}
```

**Response (200)**
```json
{
  "signedUrl": "string",    // Pre-signed S3 URL for upload
  "iepId": "string",        // Unique document ID
  "documentUrl": "string"   // S3 URL where document will be stored
}
```

### 2. File Storage Structure
Files are stored in S3 with the following path structure:
```
s3://<bucket>/<userId>/<childId>/<iepId>/<fileName>
```

### 3. Document Processing
After upload:
1. Document record is created in IepDocumentsTable (replacing any existing documents for that child)
2. Automatic processing begins for generating summaries
3. Status is tracked and can be monitored via API

**Note**: Each child can only have one active IEP document at a time. When a new document is uploaded, any existing document for that child is automatically deleted and replaced with the new one.

## API Endpoints

### 1. Get User Profile
```http
GET /profile
Authorization: Bearer <jwt-token>
```
Returns the user's profile information. Creates a default profile if none exists.

**Response (200)**
```json
{
  "profile": {
    "userId": "string",
    "phone": "string",
    "primaryLanguage": "string",
    "secondaryLanguage": "string",
    "city": "string",
    "consentGiven": boolean,
    "children": [
      {
        "childId": "string",
        "name": "string",
        "schoolCity": "string"
      }
    ],
    "createdAt": number,
    "updatedAt": number
  }
}
```

### 2. Update User Profile
```http
PUT /profile
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "phone": "string",
  "primaryLanguage": "string",
  "secondaryLanguage": "string",
  "city": "string",
  "consentGiven": boolean,
  "children": [
    {
      "childId": "string",
      "name": "string",
      "schoolCity": "string"
    }
  ]
}
```

**Note**: Email updates must be performed through Cognito user management, not through this API. The consentGiven field must be a valid JSON boolean value (true or false, lowercase without quotes).

**Response (200)**
```json
{
  "message": "Profile updated successfully"
}
```

**Response (400) - Invalid consentGiven type**
```json
{
  "message": "consentGiven must be a boolean value (true or false)"
}
```

### 3. Add Child
```http
POST /profile/children
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "string",
  "schoolCity": "string"
}
```

**Response (200)**
```json
{
  "message": "Kid added successfully",
  "childId": "string",
  "createdAt": number,
  "updatedAt": number
}
```

### 4. Get Child's Documents
```http
GET /profile/children/{childId}/documents
Authorization: Bearer <jwt-token>
```

Query Parameters:
- `include_ocr` (optional): Boolean flag to include OCR data in response (default: true)

**Response (200) - Document Found**
```json
{
  "iepId": "string",
  "childId": "string",
  "documentUrl": "string",
  "status": "string",
  "summaries": {
    "en": "string",
    "es": "string",
    "zh": "string",
    "vi": "string"
  },
  "sections": {
    "en": {
      "section1": "string",
      "section2": "string"
    }
  },
  "ocrData": {
    "pages": [
      {
        "index": 0,
        "markdown": "string",
        "images": [],
        "dimensions": {
          "dpi": number,
          "height": number,
          "width": number
        }
      }
    ],
    "model": "string",
    "usage": {
      "pages_processed": number,
      "document_size_bytes": number
    },
    "success": boolean
  },
  "ocrCompletedAt": "string",
  "createdAt": number,
  "updatedAt": number
}
```

**Response (200) - No Document Found**
```json
{
  "documents": [],
  "message": "No document found for this child"
}
```

**Note**: Only the most recent document for a child is returned. When a new document is uploaded for a child, any existing documents for that child are automatically deleted. The document response now includes OCR data that provides detailed text extraction from the IEP document in markdown format, organized by page.

### 5. Delete Child's IEP Documents
```http
DELETE /profile/children/{childId}/documents
Authorization: Bearer <jwt-token>
```

Deletes all IEP-related data for a specific child, including:
1. All IEP documents stored in S3
2. All IEP document records in the database
3. IEP document references in the user's profile

This operation does not delete the child's profile information, only their IEP-related data.

**S3 Deletion Process:**
- The operation identifies all S3 objects with the prefix `{userId}/{childId}/`
- Each object is individually deleted from the S3 bucket
- The process is resilient: if S3 deletion fails, the function will still attempt to clean up database records

**Response (200)**
```json
{
  "message": "IEP documents successfully deleted",
  "childId": "string"
}
```

**Response (500)**
```json
{
  "message": "Error deleting IEP documents: [error details]"
}
```

## Language Support

The system supports the following languages:
- English (en) - Default
- Chinese (zh)
- Spanish (es)
- Vietnamese (vi)

## Error Handling

All endpoints return appropriate HTTP status codes:
- 200: Success
- 400: Bad Request (invalid input)
- 401: Unauthorized (invalid/missing token)
- 403: Forbidden (accessing unauthorized resource)
- 404: Not Found (endpoint not found)
- 500: Internal Server Error

Error responses include a message:
```json
{
  "message": "Error description"
}
```

## Security