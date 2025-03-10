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
  "children": [
    {
      "childId": "string",
      "name": "string",
      "schoolCity": "string"
    }
  ]
}
```

**Note**: Email updates must be performed through Cognito user management, not through this API.

**Response (200)**
```json
{
  "message": "Profile updated successfully"
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

**Response (200)**
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
  "createdAt": number,
  "updatedAt": number
}
```

**Response (404)**
```json
{
  "message": "No document found for this child"
}
```

**Note**: Only the most recent document for a child is returned. When a new document is uploaded for a child, any existing documents for that child are automatically deleted.

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

2. **byChildId** (GSI)
   - Partition Key: childId
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