import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class FunctionsStack extends cdk.Stack {
  public readonly metadataHandlerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);

    // Create the metadata handler function
    this.metadataHandlerFunction = new lambda.Function(this, 'MetadataHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, 'functions/metadata-handler')),
      handler: 'lambda_function.lambda_handler',
      timeout: cdk.Duration.minutes(5)
    });

    // Add Bedrock permissions for knowledge base operations
    this.metadataHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:IngestKnowledgeBaseDocuments',
          'bedrock:ListKnowledgeBaseDocuments',
          'bedrock:GetKnowledgeBaseDocument'
        ],
        resources: [`arn:aws:bedrock:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:knowledge-base/*`]
      })
    );
  }
} 