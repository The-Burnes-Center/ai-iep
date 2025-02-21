# User Profile Management System

This system manages user profiles, their children's information, and associated IEP documents in the AI-IEP platform.

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
  status: string,         // Document processing status: PROCESSING | PROCESSED | FAILED
  summaries: {            // Document summaries in different languages
    [languageCode: string]: string
  },
  createdAt: number,      // Creation timestamp
  updatedAt: number,      // Last update timestamp
  ttl?: number           // Optional TTL for record expiration
}
```

## API Endpoints

### 1. Get User Profile
```http
GET /profile
Authorization: Bearer <jwt-token>
```
Returns the user's profile information.

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
    ]
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
  "kidId": "string"
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
      "status": "PROCESSING|PROCESSED|FAILED",
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
  "status": "PROCESSING|PROCESSED|FAILED",
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
  "status": "PROCESSED"
}
```

**Response (400) - If document is not processed**
```json
{
  "message": "Document is not yet processed",
  "status": "PROCESSING"
}
```

## Document Processing Status

Documents can have one of three statuses:
- `PROCESSING`: Initial state when document is uploaded, being processed
- `PROCESSED`: Document has been successfully processed, summaries are available
- `FAILED`: Document processing failed

## Language Support

The system supports the following languages:
- English (en) - Default
- Chinese (zh)
- Spanish (es)
- Vietnamese (vi)

## Error Handling

All endpoints return appropriate HTTP status codes:
- 200: Success
- 400: Bad Request (invalid input or document not processed)
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

2. **Authorization**
   - Users can only access their own profile
   - Users can only access documents belonging to their children

3. **CORS**
   - Cross-Origin Resource Sharing enabled
   - Supports OPTIONS preflight requests
   - Configurable allowed origins

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

3. **byStatus** (GSI)
   - Partition Key: status
   - Sort Key: createdAt
   - Use: Query documents by processing status

## Infrastructure

The system is deployed using AWS CDK and includes:
1. DynamoDB tables with auto-scaling
2. Lambda function with Python 3.12 runtime
3. API Gateway v2 HTTP API endpoints
4. Cognito integration for authentication
5. IAM roles and permissions
6. CORS configuration

## Dependencies
- AWS SDK for Python (boto3)
- AWS CDK
- API Gateway v2
- Cognito User Pools
- DynamoDB
- Lambda 