import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

// Import Lambda L2 construct
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { getTagProps, tagResource } from '../../tags';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { Bucket } from 'aws-cdk-lib/aws-s3';

export interface LambdaFunctionStackProps {
  readonly knowledgeBucket : s3.Bucket;
  readonly userProfilesTable : Table;
  readonly iepDocumentsTable : Table;
  readonly userPool: cognito.UserPool;
  readonly logGroup: logs.LogGroup;
  readonly logRole: iam.Role;
}

export class LambdaFunctionStack extends cdk.Stack {  
  public readonly deleteS3Function : lambda.Function;
  public readonly getS3KnowledgeFunction : lambda.Function;
  public readonly uploadS3KnowledgeFunction : lambda.Function;
  public readonly metadataHandlerFunction : lambda.Function;
  public readonly userProfileFunction : lambda.Function;
  public readonly cognitoTriggerFunction : lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionStackProps) {
    super(scope, id);    

    // Create a helper function to add standard tags and handle Lambda function creation
    const createTaggedLambda = (id: string, config: lambda.FunctionProps): lambda.Function => {
      const func = new lambda.Function(scope, id, {
        ...config
      });
      
      // Apply standard tags plus Lambda-specific tags
      tagResource(func, {
        'Resource': 'Lambda',
        'Function': id,
        'Runtime': config.runtime?.name || 'unknown'
      });
      
      return func;
    };
    
    const deleteS3APIHandlerFunction = new lambda.Function(scope, 'DeleteS3FilesHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/delete-s3')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.knowledgeBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_YEAR
    });

    deleteS3APIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:DeleteObject'],
      resources: [props.knowledgeBucket.bucketArn + "/*"]
    }));

    this.deleteS3Function = deleteS3APIHandlerFunction;

    const getS3APIHandlerFunction = new lambda.Function(scope, 'GetS3FilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/get-s3')), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.knowledgeBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_YEAR
    });

    getS3APIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject'],
      resources: [props.knowledgeBucket.bucketArn + "/*"]
    }));

    getS3APIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucket'],
      resources: [props.knowledgeBucket.bucketArn]
    }));

    this.getS3KnowledgeFunction = getS3APIHandlerFunction;

    const uploadS3APIHandlerFunction = new lambda.Function(scope, 'UploadS3FilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/upload-s3')), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.knowledgeBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_YEAR
    });

    uploadS3APIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject'],
      resources: [props.knowledgeBucket.bucketArn + "/*"]
    }));

    this.uploadS3KnowledgeFunction = uploadS3APIHandlerFunction;

    const metadataHandlerFunction = new lambda.Function(scope, 'MetadataHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, 'metadata-handler')),
      handler: 'lambda_function.lambda_handler',
      environment: {
        "BUCKET": props.knowledgeBucket.bucketName,
        "USER_PROFILES_TABLE": props.userProfilesTable.tableName,
        "IEP_DOCUMENTS_TABLE": props.iepDocumentsTable.tableName
      },
      timeout: cdk.Duration.seconds(300),
      logRetention: logs.RetentionDays.ONE_YEAR
    });

    // Grant S3 permissions
    metadataHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject'
      ],
      resources: [props.knowledgeBucket.bucketArn + "/*"]
    }));

    // Grant DynamoDB permissions
    metadataHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan'
      ],
      resources: [
        props.userProfilesTable.tableArn,
        props.userProfilesTable.tableArn + "/index/*",
        props.iepDocumentsTable.tableArn,
        props.iepDocumentsTable.tableArn + "/index/*"
      ]
    }));

    // Grant Comprehend permissions
    metadataHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'comprehend:DetectPiiEntities',
        'comprehend:ContainsPiiEntities'
      ],
      resources: ['*']
    }));

    // Grant Bedrock permissions
    metadataHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: ['*']
    }));

    this.metadataHandlerFunction = metadataHandlerFunction;

    metadataHandlerFunction.addEventSource(new S3EventSource(props.knowledgeBucket, {
      events: [s3.EventType.OBJECT_CREATED],
    }));

    const userProfileHandlerFunction = new lambda.Function(scope, 'UserProfileHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, 'user-profile-handler')),
      handler: 'lambda_function.lambda_handler',
      environment: {
        "USER_PROFILES_TABLE": props.userProfilesTable.tableName,
        "IEP_DOCUMENTS_TABLE": props.iepDocumentsTable.tableName,
        "BUCKET": props.knowledgeBucket.bucketName
      },
      timeout: cdk.Duration.seconds(300),
      logRetention: logs.RetentionDays.ONE_YEAR
    });

    // Add permissions for DynamoDB tables
    userProfileHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan'
      ],
      resources: [
        props.userProfilesTable.tableArn,
        props.userProfilesTable.tableArn + "/index/*",
        props.iepDocumentsTable.tableArn,
        props.iepDocumentsTable.tableArn + "/index/*"
      ]
    }));
    
    // Add S3 permissions
    userProfileHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:ListBucket',
        's3:GetObject',
        's3:DeleteObject'
      ],
      resources: [
        props.knowledgeBucket.bucketArn,
        props.knowledgeBucket.bucketArn + "/*"
      ]
    }));

    this.userProfileFunction = userProfileHandlerFunction;

    // Add Cognito Post Confirmation Trigger Lambda
    const cognitoTriggerFunction = new lambda.Function(scope, 'CognitoTriggerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, 'user-profile-handler')),
      handler: 'cognito_trigger.lambda_handler',
      environment: {
        "USER_PROFILES_TABLE": props.userProfilesTable.tableName
      },
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_YEAR
    });

    // Grant DynamoDB permissions to Cognito trigger
    cognitoTriggerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:PutItem'
      ],
      resources: [props.userProfilesTable.tableArn]
    }));

    // Allow Cognito to invoke the Lambda
    cognitoTriggerFunction.addPermission('CognitoInvocation', {
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: props.userPool.userPoolArn
    });

    // Add the Lambda trigger to Cognito User Pool
    props.userPool.addTrigger(
      cdk.aws_cognito.UserPoolOperation.POST_CONFIRMATION,
      cognitoTriggerFunction
    );

    this.cognitoTriggerFunction = cognitoTriggerFunction;

    // Create a layer for logging
    const loggingLayer = new lambda.LayerVersion(this, 'LoggingLayer', {
      code: lambda.Code.fromAsset('lib/chatbot-api/logging'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Layer for logging functionality',
    });

    // Common environment variables for all functions
    const commonEnvVars = {
      LOG_GROUP_NAME: props.logGroup.logGroupName,
      ENVIRONMENT: process.env.ENVIRONMENT || 'development',
    };

    // Common IAM permissions for logging
    const loggingPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [props.logGroup.logGroupArn],
    });

    // Add logging permissions to each function
    this.userProfileFunction.addToRolePolicy(loggingPolicy);
  }
}
