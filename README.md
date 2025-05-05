# AI-IEP Project

This is a CDK TypeScript project that implements an AI-powered IEP (Individualized Education Program) system using AWS services. The system helps manage and analyze IEP documents, providing summaries and insights for parents and educators.

## Prerequisites

1. **AWS Account and Credentials**
   - AWS Account with appropriate permissions
   - AWS CLI installed and configured with credentials
   - Region set to us-east-1 (`aws configure set region us-east-1`)

2. **Development Tools**
   - Node.js (v18.x recommended)
   - npm (comes with Node.js)
   - Docker Desktop installed and running
   - AWS CDK CLI (`npm install -g aws-cdk`)

3. **API Keys**
   - OpenAI API key (to be stored in AWS Parameter Store)
   - Mistral API key (to be stored in AWS Parameter Store)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

1. Update `lib/constants.ts` with your values:
   ```typescript
   export const cognitoDomainName = "your-unique-domain-name"  // Must be globally unique
   export const OIDCIntegrationName = ""  // Set if using SSO
   export const stackName = "AIEPStack"  // Your stack name
   ```

2. Store API keys in AWS Parameter Store (required for document processing):
   ```bash
   aws ssm put-parameter --name "/ai-iep/OPENAI_API_KEY" --value "your-openai-key" --type "SecureString" --overwrite
   aws ssm put-parameter --name "/ai-iep/MISTRAL_API_KEY" --value "your-mistral-key" --type "SecureString" --overwrite
   ```

## Deployment Steps

1. Bootstrap CDK (first-time only):
   ```bash
   cdk bootstrap
   ```

2. Build the TypeScript code:
   ```bash
   npm run build
   ```

3. Deploy the stack:
   ```bash
   cdk deploy AIEPStack
   ```

4. After deployment:
   - Configure Cognito using the CDK outputs
   - Note the API endpoints from the stack outputs

## Useful Commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## Backend Architecture

The backend architecture is built using AWS CDK and consists of several components integrated together to provide a comprehensive solution for IEP document management and analysis.

### Core Infrastructure Components

#### Authentication (AuthorizationStack)
- **Cognito User Pool**: Handles user authentication and identity management
- **User Pool Client**: Client application for authentication
- **Domain Configuration**: Custom domain for Cognito login interfaces
- **Optional OIDC Integration**: Support for third-party identity providers

#### API Gateway (ChatBotApi)
- **REST API**: Secured HTTP API with JWT authorization
- **Endpoints**:
  - `/profile`: User profile management
  - `/profile/children`: Child profile management
  - `/profile/children/{childId}/documents`: Document management
  - `/documents/{iepId}/status`: Document status retrieval
  - `/signed-url-knowledge`: Presigned URL generation for uploads
  - `/delete-s3-file`: Document deletion
  - `/s3-knowledge-bucket-data`: Document retrieval
  - `/summary`: Summary generation

#### Storage (S3BucketStack)
- **Knowledge Bucket**: Stores IEP documents with versioning enabled
- **Bucket Policies**: Strict access controls enforcing HTTPS-only
- **CORS Configuration**: Allows cross-origin requests from the frontend

#### Database (TableStack)
- **User Profiles Table**: Stores user profile information
  - Primary Key: `userId`
  - Attributes: contact details, language preferences, associated children
  
- **IEP Documents Table**: Stores IEP document metadata
  - Primary Key: `iepId`
  - Sort Key: `childId`
  - GSIs: `byUserId` (for user-based queries), `byChildId` (for child-based queries)
  - Attributes: document status, creation/update timestamps, summaries

### Lambda Functions (LambdaFunctionStack)

#### Document Processing Pipeline
- **Upload Handler**: `uploadS3KnowledgeFunction`
  - Creates presigned URLs for secure document uploads
  - Registers document metadata in DynamoDB
  
- **Metadata Handler**: `metadataHandlerFunction`
  - Triggered by S3 object creation events
  - Uses Mistral AI for OCR (Optical Character Recognition)
  - Processes documents using Large Language Models (via OpenAI or AWS Bedrock)
  - Extracts key information and generates summaries
  - Updates document status in DynamoDB
  - Integrates with AWS Comprehend for PII redaction

- **Delete Handler**: `deleteS3Function`
  - Removes documents from S3 and corresponding metadata from DynamoDB

#### User Management Functions
- **User Profile Handler**: `userProfileFunction`
  - CRUD operations for user profiles
  - Child management functions
  - Document association with users and children
  
- **Cognito Trigger**: `cognitoTriggerFunction`
  - Triggered on Cognito post-confirmation
  - Creates initial user profile in DynamoDB

### Frontend Deployment (UserInterface)
- **CloudFront Distribution**: CDN for the frontend application
- **S3 Website Bucket**: Hosts the React application
- **Access Logs Bucket**: Stores CloudFront access logs
- **Build Process**: Automated build and deployment


## Security Considerations

- All S3 buckets have versioning enabled
- Public access is blocked by default
- HTTPS/TLS is enforced for all endpoints
- Authentication is required for API access
- JWT tokens used for API authorization
- API keys are stored securely in AWS Parameter Store
- Fine-grained IAM permissions for each Lambda function
- PII (Personally Identifiable Information) redaction in document processing

## Extending and Customizing

### Adding New API Endpoints
1. Add new routes in `lib/chatbot-api/index.ts`
2. Create corresponding Lambda handlers in `lib/chatbot-api/functions/`
3. Update IAM permissions as needed

### Modifying Document Processing
1. Update the OCR implementation in `lib/chatbot-api/functions/metadata-handler/mistral_ocr.py`
2. Configure LLM prompts in `lib/chatbot-api/functions/metadata-handler/open_ai_agent.py`
3. Adjust the processing pipeline in `lib/chatbot-api/functions/metadata-handler/lambda_function.py`

### Adding Database Fields
1. Modify the relevant Lambda handlers to include new fields
2. No schema changes needed as DynamoDB is schema-less

## Troubleshooting

- **Deployment Failures**: Check CloudFormation console for detailed error messages
- **Lambda Errors**: Review CloudWatch Logs for each function
- **API Issues**: Verify API Gateway configuration and test endpoints with Postman
- **Document Processing**: Check metadata handler logs and ensure API keys are correctly configured
- **Authentication Problems**: Verify Cognito setup and JWT token configuration
