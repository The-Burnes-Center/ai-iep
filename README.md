# A-IEP

A serverless CDK project for processing and serving Individualized Education Program (IEP) documents via Generative AI.

---

## Table of Contents

1. [Project Overview](#project-overview)  
2. [Prerequisites](#prerequisites)  
3. [Getting Started](#getting-started)  
4. [Project Structure](#project-structure)  
5. [Deploying](#deploying)  
6. [Testing](#testing)  
7. [Logging & Monitoring](#logging--monitoring)  
8. [Contributing](#contributing)  
9. [License](#license)  

---

## Project Overview

This infrastructure-as-code repo (written in TypeScript + AWS CDK) provisions:

- **API Gateway** + Lambda handlers for document upload & retrieval  
- **Cognito User Pool** with email & phone/SMS authentication  
- **S3 buckets** for raw & processed IEP storage  
- **DynamoDB** tables for metadata and status tracking  

It integrates OpenAI (or other LLMs) to extract, translate, and summarize IEP sections for parents.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+  
- AWS CLI configured with permissions for CDK, IAM, SNS, Cognito, S3, DynamoDB, Lambda  
- AWS CDK Toolkit (`npm install -g aws-cdk`)  
- An AWS account with an SNS SMS sandbox exit (for phone auth)
- Docker Desktop installed and running
- OpenAI API key (to be stored in AWS Parameter Store)
- Mistral API key (to be stored in AWS Parameter Store)

---

## Getting Started

1. **Clone the repo**  
   ```bash
   git clone https://github.com/The-Burnes-Center/ai-iep.git
   cd ai-iep
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API Keys**
   Store API keys in AWS Parameter Store:
   ```bash
   aws ssm put-parameter --name "/ai-iep/OPENAI_API_KEY" --value "your-openai-key" --type "SecureString" --overwrite
   aws ssm put-parameter --name "/ai-iep/MISTRAL_API_KEY" --value "your-mistral-key" --type "SecureString" --overwrite
   ```

4. **Bootstrap your AWS environment** (if not done already)
   ```bash
   cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
   ```

## Project Structure
```
a-iep/
├── .github/             # CI/CD workflows
├── bin/                 # CDK entrypoint scripts
│   └── a-iep.ts
├── lib/                 # CDK TypeScript source
│   ├── authorization/   # Cognito + SMS configuration
│   ├── chatbot-api/    # API stack & Lambda handlers
│   ├── user-interface/ # Frontend deployment stack
│   ├── shared/         # Shared utilities
│   ├── constants.ts    # Global constants
│   ├── tags.ts         # AWS resource tagging
│   └── gen-ai-mvp-stack.ts  # Main stack definition
├── test/               # Jest unit tests
├── cdk.json           # CDK configuration
├── package.json       # Node.js dependencies
├── tsconfig.json      # TypeScript configuration
└── README.md
```

The project follows a modular architecture:

- `authorization/` handles user authentication and SMS verification
- `chatbot-api/` contains the API Gateway setup and Lambda functions
- `user-interface/` manages the frontend deployment configuration
- `shared/` contains common utilities and helper functions
- `gen-ai-mvp-stack.ts` is the main CDK stack that brings everything together

## Deploying

1. **Update Configuration**
   Update `lib/constants.ts` with your values:
   ```typescript
   export const cognitoDomainName = "your-unique-domain-name"  // Must be globally unique
   export const OIDCIntegrationName = ""  // Set if using SSO
   export const stackName = "AIEPStack"  // Your stack name
   ```

2. **Build**
   ```bash
   npm run build
   ```

3. **Deploy the full stack**
   ```bash
   cdk deploy --all
   ```

4. **Verify**
   - In the AWS Console, go to Cognito → User Pools → [Your Pool] → Message customizations
   - Ensure your SNS caller role ARN and External ID are applied
   - Test user signup via the hosted UI to confirm SMS delivery and verification

## Testing

Unit tests live in `test/`.

Run:
```bash
npm test
```

## Logging & Monitoring

- All stacks use the shared logger utility for structured, JSON‑friendly logs
- CloudWatch Log Groups are automatically created per Lambda
- For custom SMS flows, see the Custom SMS Sender Lambda trigger in `authorization-stack.ts`

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add some feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

Please follow existing naming, logging, and formatting conventions.

## License

MIT © The Burnes Center for Social Change
