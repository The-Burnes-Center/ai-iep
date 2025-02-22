# User Profile Management System

This system manages user profiles, their children's information, and associated IEP documents in the AI-IEP platform.

## Profile Creation

User profiles are automatically created in two ways:

1. **Primary Method - Cognito Post Confirmation Trigger**:
   - A profile is automatically created when a user confirms their account
   - The trigger creates a basic profile with:
     - User ID (from Cognito)
     - Email (from Cognito attributes)
     - Creation timestamp
     - Empty kids array

2. **Fallback Method - API Endpoint**:
   - If a profile doesn't exist when accessing `/profile` endpoint
   - Handles cases where:
     - The Cognito trigger failed
     - Legacy users from before trigger implementation
     - Profile was accidentally deleted

## Database Schema

### UserProfilesTable
```typescript
{
  userId: string,           // Partition key (from Cognito)
  email: string,           // User's email address
  phone: string,           // User's phone number
  primaryLanguage: string, // Primary language preference
  secondaryLanguage?: string, // Optional secondary language
  city: string,           // User's city of residence
  kids: [                 // Array of children
    {
      kidId: string,      // Unique identifier for child
      name: string,       // Child's name
      schoolCity: string  // City where child attends school
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
  kidId: string,          // Sort key
  userId: string,         // Owner's user ID
  documentUrl: string,    // S3 URL to the document
  summaries: {            // Document summaries in different languages
    [languageCode: string]: string
  },
  status: string,         // Document processing status (PROCESSING, PROCESSED, FAILED)
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
  "kidId": "string"
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
s3://<bucket>/<userId>/<kidId>/<iepId>/<fileName>
```

### 3. Document Processing
After upload:
1. Document record is created in IepDocumentsTable
2. Automatic processing begins for generating summaries
3. Status is tracked and can be monitored via API

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
    "email": "string",
    "phone": "string",
    "primaryLanguage": "string",
    "secondaryLanguage": "string",
    "city": "string",
    "kids": [
      {
        "kidId": "string",
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
  "email": "string",
  "phone": "string",
  "primaryLanguage": "string",
  "secondaryLanguage": "string",
  "city": "string",
  "kids": [
    {
      "kidId": "string",
      "name": "string",
      "schoolCity": "string"
    }
  ]
}
```

**Response (200)**
```json
{
  "message": "Profile updated successfully"
}
```

### 3. Add Child
```http
POST /profile/kids
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
  "kidId": "string",
  "createdAt": number,
  "updatedAt": number
}
```

### 4. Get Child's Documents
```http
GET /profile/kids/{kidId}/documents
Authorization: Bearer <jwt-token>
```

**Response (200)**
```json
{
  "documents": [
    {
      "iepId": "string",
      "kidId": "string",
      "documentUrl": "string",
      "status": "string",
      "summaries": {
        "en": "string",
        "es": "string",
        "zh": "string",
        "vi": "string"
      },
      "createdAt": number,
      "updatedAt": number
    }
  ]
}
```

### 5. Get Document Status
```http
GET /documents/{iepId}/status
Authorization: Bearer <jwt-token>
```

**Response (200)**
```json
{
  "status": "string",
  "documentUrl": "string",
  "createdAt": number,
  "updatedAt": number
}
```

### 6. Get Document Summary
```http
POST /summary
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "iepId": "string",
  "langCode": "string"
}
```

**Response (200)**
```json
{
  "summary": "string",
  "documentUrl": "string",
  "status": "string"
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
- 404: Not Found
- 500: Internal Server Error

Error responses include a message:
```json
{
  "message": "Error description"
}
```

## Security

1. **Authentication**
   - All endpoints require JWT token from Cognito
   - Token must be included in Authorization header
   - Profile creation tied to Cognito user confirmation

2. **Authorization**
   - Users can only access their own profile
   - Users can only access documents belonging to their children
   - Document uploads are automatically linked to the correct user and child

3. **CORS**
   - Cross-Origin Resource Sharing enabled
   - Supports OPTIONS preflight requests
   - Configurable allowed origins

4. **File Upload Security**
   - Pre-signed URLs with 5-minute expiration
   - Automatic file path isolation by user and child
   - Content type verification
   - Secure S3 bucket configuration

## Database Indexes

### IepDocumentsTable Indexes
1. **byUserId** (GSI)
   - Partition Key: userId
   - Sort Key: createdAt
   - Use: Retrieve all documents for a user

2. **byKidId** (GSI)
   - Partition Key: kidId
   - Sort Key: createdAt
   - Use: Retrieve all documents for a specific child

## Infrastructure

The system is deployed using AWS CDK and includes:
1. DynamoDB tables with auto-scaling
2. S3 bucket for document storage
3. Lambda functions:
   - Main API handler for profile operations
   - Cognito Post Confirmation trigger for automatic profile creation
   - Upload handler for generating pre-signed URLs
   - Document processing handler
4. API Gateway v2 HTTP API endpoints
5. Cognito integration for authentication
6. IAM roles and permissions
7. CORS configuration

## Dependencies
- AWS SDK for Python (boto3)
- AWS SDK for JavaScript (v3)
- AWS CDK
- API Gateway v2
- Cognito User Pools
- DynamoDB
- Lambda
- S3 