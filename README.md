# AI-IEP Project

This is a CDK TypeScript project that implements an AI-powered IEP system using AWS services.

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

## Architecture

The stack deploys:
- Cognito User Pool for authentication
- API Gateway (WebSocket and REST APIs)
- Lambda functions for business logic
- S3 buckets for storage
- OpenSearch for knowledge base
- CloudFront distribution for web interface

## Security Notes

- All S3 buckets have versioning enabled
- Public access is blocked by default
- HTTPS/TLS is enforced for all endpoints
- Authentication is required for API access
