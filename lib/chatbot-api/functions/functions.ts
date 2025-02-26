import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

// Import Lambda L2 construct
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import { StepFunctionsStack } from './step-functions/step-functions';
import * as cognito from 'aws-cdk-lib/aws-cognito';


interface LambdaFunctionStackProps {  
  readonly wsApiEndpoint : string;  
  readonly sessionTable : Table;  
  readonly feedbackTable : Table;
  readonly feedbackBucket : s3.Bucket;
  readonly knowledgeBucket : s3.Bucket;
  readonly knowledgeBase : bedrock.CfnKnowledgeBase;
  readonly knowledgeBaseSource: bedrock.CfnDataSource;
  readonly evalTestCasesBucket : s3.Bucket;
  readonly stagedSystemPromptsTable : Table;
  readonly activeSystemPromptsTable : Table;
  readonly evalSummariesTable : Table;
  readonly evalResutlsTable : Table;
  readonly userProfilesTable : Table;
  readonly iepDocumentsTable : Table;
  readonly userPool: cognito.UserPool;
}

export class LambdaFunctionStack extends cdk.Stack {  
  public readonly chatFunction : lambda.Function;
  public readonly sessionFunction : lambda.Function;
  public readonly feedbackFunction : lambda.Function;
  public readonly deleteS3Function : lambda.Function;
  public readonly getS3KnowledgeFunction : lambda.Function;
  public readonly getS3TestCasesFunction : lambda.Function;
  public readonly uploadS3KnowledgeFunction : lambda.Function;
  public readonly uploadS3TestCasesFunction : lambda.Function;
  public readonly syncKBFunction : lambda.Function;
  public readonly metadataHandlerFunction : lambda.Function;
  public readonly handleEvalResultsFunction : lambda.Function;
  public readonly stepFunctionsStack : StepFunctionsStack;
  public readonly systemPromptsFunction : lambda.Function;
  public readonly userProfileFunction : lambda.Function;
  public readonly cognitoTriggerFunction : lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionStackProps) {
    super(scope, id);    

    const sessionAPIHandlerFunction = new lambda.Function(scope, 'SessionHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'session-handler')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "DDB_TABLE_NAME" : props.sessionTable.tableName
      },
      timeout: cdk.Duration.seconds(30)
    });
    
    sessionAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan'
      ],
      resources: [props.sessionTable.tableArn, props.sessionTable.tableArn + "/index/*"]
    }));
    this.sessionFunction = sessionAPIHandlerFunction;

    const systemPromptsAPIHandlerFunction = new lambda.Function(scope, 'SystemPromptsHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/system-prompt-handler')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "STAGED_SYSTEM_PROMPTS_TABLE" : props.stagedSystemPromptsTable.tableName, 
        "ACTIVE_SYSTEM_PROMPTS_TABLE" : props.activeSystemPromptsTable.tableName,
        "DEFAULT_PROMPT" : `You are a helpful AI chatbot that will answer questions based on your knowledge. 
        You have access to a search tool that you will use to look up answers to questions.`
       }
    });
    // Add permissions to the lambda function to read/write to the table
    systemPromptsAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan'
      ],
      resources: [props.activeSystemPromptsTable.tableArn, props.activeSystemPromptsTable.tableArn + "/index/*", props.stagedSystemPromptsTable.tableArn, props.stagedSystemPromptsTable.tableArn + "/index/*"]
    }));
    this.systemPromptsFunction = systemPromptsAPIHandlerFunction;
    props.activeSystemPromptsTable.grantReadWriteData(systemPromptsAPIHandlerFunction);
    props.stagedSystemPromptsTable.grantReadWriteData(systemPromptsAPIHandlerFunction);

        // Define the Lambda function resource
        const websocketAPIFunction = new lambda.Function(scope, 'ChatHandlerFunction', {
          runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
          code: lambda.Code.fromAsset(path.join(__dirname, 'websocket-chat')), // Points to the lambda directory
          handler: 'index.handler', // Points to the 'hello' file in the lambda directory
          environment : {
            "WEBSOCKET_API_ENDPOINT" : props.wsApiEndpoint.replace("wss","https"),            
            // "PROMPT" : `You are a helpful AI chatbot that will answer questions based on your knowledge. 
            // You have access to a search tool that you will use to look up answers to questions.`,
            'SESSION_HANDLER' : sessionAPIHandlerFunction.functionName,
            'SYSTEM_PROMPTS_HANDLER' : systemPromptsAPIHandlerFunction.functionName,
            'KB_ID' : props.knowledgeBase.attrKnowledgeBaseId,
            'CONFL_PROMPT': `You are a knowledge expert looking to either identify conflicts among the 
            above documents or assure the user that no conflicts exist. You are not looking for small 
            syntatic or grammatical differences, but rather pointing out major factual inconsistencies. 
            You can be confident about identifying a conflict between two documents if the conflict 
            represents a major factual difference that would result in semantic differences between 
            responses constructed with each respective decoment. If conflicts are detected, please format 
            them in an organized list where each entry includes the names of the conflicting documents as 
            well as the conflicting statements. Use each document's actual name from the source uri in 
            this list.If there is no conflict please respond only with "no 
            conflicts detected" Do not include any additional information. Only include identified 
            conflicts that you are confident are factual inconsistencies. Do not include identified 
            conflicts that you are not confident are real conflicts. Do not report conflicts that are not 
            relevant to the user's query, which will be given below. Below is an example user query with 
            examples of a relevant conflict, an irrelevant conflict, and a non conflict: 
            <example_user_query> "Are state parks in Massachusetts open year-round, and are there any 
            costs associated with access for residents?" </example_user_query> Example of a Relevant 
            Conflict <conflict_example> Document A: "Massachusetts state parks are open year-round and 
            free for all residents." Document B: "Massachusetts state parks are closed during the winter 
            season." Conflict Reason: The statements directly conflict on whether parks remain open 
            year-round, which is relevant to the user's query. inclusion: This conflict would be included 
            as a conflict for the given user query. It is a clear factual conflict, and it is relevant to 
            the example user query. </conflict_example> Example of a Non-Conflict <non_conflict_example> 
            Document A: "Massachusetts state parks offer seasonal programs." Document B: "Some parks may 
            require entrance fees for special events." Reason: These statements do not contradict each 
            other. inclusion: This would not be included as a conflict for the given user query. It is 
            not a factual conflict. </non_conflict_example> Example of an Irrelevant Conflict 
            <irrelevant_conflict_example> Document C: "Parks in western Massachusetts do not allow pets 
            on trails" Document D: "State parks in western Massachusetts allow pets on trails as long as 
            they are leashed." Reason: While these statements conflict on whether pets are allowed at 
            parks, niether statement is about year-round park access or costs to access parks, which is 
            the focus of the user's query. inclusion: This would not be included as a conflict for the 
            given user query. Although it is a factual conflict, it is not relevant to the given user 
            query. </irrelevant_conflict_example>`
          },
          timeout: cdk.Duration.seconds(300)
        });
        websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock:InvokeModelWithResponseStream',
            'bedrock:InvokeModel',
            
          ],
          resources: ["*"]
        }));
        websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock:Retrieve'
          ],
          resources: [props.knowledgeBase.attrKnowledgeBaseArn]
        }));

        websocketAPIFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'lambda:InvokeFunction'
          ],
          resources: [this.sessionFunction.functionArn]
        }));
        
        this.chatFunction = websocketAPIFunction;

    const feedbackAPIHandlerFunction = new lambda.Function(scope, 'FeedbackHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'feedback-handler')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "FEEDBACK_TABLE" : props.feedbackTable.tableName,
        "FEEDBACK_S3_DOWNLOAD" : props.feedbackBucket.bucketName
      },
      timeout: cdk.Duration.seconds(30)
    });
    
    feedbackAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan'
      ],
      resources: [props.feedbackTable.tableArn, props.feedbackTable.tableArn + "/index/*"]
    }));

    feedbackAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.feedbackBucket.bucketArn,props.feedbackBucket.bucketArn+"/*"]
    }));

    this.feedbackFunction = feedbackAPIHandlerFunction;
    
    const deleteS3APIHandlerFunction = new lambda.Function(scope, 'DeleteS3FilesHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/delete-s3')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.knowledgeBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30)
    });

    deleteS3APIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.knowledgeBucket.bucketArn,props.knowledgeBucket.bucketArn+"/*"]
    }));
    this.deleteS3Function = deleteS3APIHandlerFunction;

    const getS3KnowledgeAPIHandlerFunction = new lambda.Function(scope, 'GetS3KnowledgeFilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/get-s3')), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.knowledgeBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30)
    });

    getS3KnowledgeAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.knowledgeBucket.bucketArn,props.knowledgeBucket.bucketArn+"/*"]
    }));
    this.getS3KnowledgeFunction = getS3KnowledgeAPIHandlerFunction;

    const getS3TestCasesAPIHandlerFunction = new lambda.Function(scope, 'GetS3TestCasesFilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'llm-eval/S3-get-test-cases')), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.evalTestCasesBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30)
    });

    getS3TestCasesAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.evalTestCasesBucket.bucketArn,props.evalTestCasesBucket.bucketArn+"/*"]
    }));
    this.getS3TestCasesFunction = getS3TestCasesAPIHandlerFunction;


    const kbSyncAPIHandlerFunction = new lambda.Function(scope, 'SyncKBHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/kb-sync')), // Points to the lambda directory
      handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "KB_ID" : props.knowledgeBase.attrKnowledgeBaseId,      
        "SOURCE" : props.knowledgeBaseSource.attrDataSourceId  
      },
      timeout: cdk.Duration.seconds(30)
    });

    kbSyncAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:*'
      ],
      resources: [props.knowledgeBase.attrKnowledgeBaseArn]
    }));
    this.syncKBFunction = kbSyncAPIHandlerFunction;

    const uploadS3KnowledgeAPIHandlerFunction = new lambda.Function(scope, 'UploadS3KnowledgeFilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, 'knowledge-management/upload-s3')),
      handler: 'index.handler',
      environment: {
        "BUCKET": props.knowledgeBucket.bucketName,
        "IEP_DOCUMENTS_TABLE": props.iepDocumentsTable.tableName
      },
      timeout: cdk.Duration.seconds(300)
    });

    uploadS3KnowledgeAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.knowledgeBucket.bucketArn, props.knowledgeBucket.bucketArn + "/*"]
    }));

    // Add DynamoDB permissions for IEP documents table
    uploadS3KnowledgeAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:PutItem'
      ],
      resources: [props.iepDocumentsTable.tableArn]
    }));
    this.uploadS3KnowledgeFunction = uploadS3KnowledgeAPIHandlerFunction;

    const uploadS3TestCasesFunction = new lambda.Function(scope, 'UploadS3TestCasesFilesHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // Choose any supported Node.js runtime
      code: lambda.Code.fromAsset(path.join(__dirname, 'llm-eval/S3-upload')), // Points to the lambda directory
      handler: 'index.handler', // Points to the 'hello' file in the lambda directory
      environment: {
        "BUCKET" : props.evalTestCasesBucket.bucketName,        
      },
      timeout: cdk.Duration.seconds(30)
    });

    uploadS3TestCasesFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.evalTestCasesBucket.bucketArn,props.evalTestCasesBucket.bucketArn+"/*"]
    }));
    this.uploadS3TestCasesFunction = uploadS3TestCasesFunction;

        // Define the Lambda function for metadata
        const metadataHandlerFunction = new lambda.Function(scope, 'MetadataHandlerFunction', {
          runtime: lambda.Runtime.PYTHON_3_12,
          code: lambda.Code.fromAsset(path.join(__dirname, 'metadata-handler')),
          handler: 'lambda_function.lambda_handler',
          timeout: cdk.Duration.seconds(900),
          environment: {
            "BUCKET": props.knowledgeBucket.bucketName,
            "KB_ID": props.knowledgeBase.attrKnowledgeBaseId,
            "IEP_DOCUMENTS_TABLE": props.iepDocumentsTable.tableName,
            "KB_SOURCE_ID": props.knowledgeBaseSource.attrDataSourceId,
            "USER_PROFILES_TABLE": props.userProfilesTable.tableName
          },
        });
    
        metadataHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:*',
            'bedrock:InvokeModel',
            'bedrock:Retrieve',
          ],
          resources: [
            props.knowledgeBucket.bucketArn,
            props.knowledgeBucket.bucketArn + "/*",
            'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0',
            props.knowledgeBase.attrKnowledgeBaseArn,
          ]
        }));
    
        // Add DynamoDB permissions for updating document status and user profiles
        metadataHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dynamodb:GetItem',
            'dynamodb:UpdateItem'
          ],
          resources: [
            props.iepDocumentsTable.tableArn,
            props.userProfilesTable.tableArn
          ]
        }));
    
        // Add permission to invoke KB sync function
        metadataHandlerFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock:StartIngestionJob'
          ],
          resources: [props.knowledgeBase.attrKnowledgeBaseArn]
        }));
    
        this.metadataHandlerFunction = metadataHandlerFunction;
    
          metadataHandlerFunction.addEventSource(new S3EventSource(props.knowledgeBucket, {
            events: [s3.EventType.OBJECT_CREATED],
          }));
          const evalResultsAPIHandlerFunction = new lambda.Function(scope, 'EvalResultsHandlerFunction', {
            runtime: lambda.Runtime.PYTHON_3_12, // Choose any supported Node.js runtime
            code: lambda.Code.fromAsset(path.join(__dirname, 'llm-eval/eval-results-handler')), // Points to the lambda directory
            handler: 'lambda_function.lambda_handler', // Points to the 'hello' file in the lambda directory
            environment: {
              "EVALUATION_RESULTS_TABLE" : props.evalResutlsTable.tableName,
              "EVALUATION_SUMMARIES_TABLE" : props.evalSummariesTable.tableName
            }
          });
          evalResultsAPIHandlerFunction.addToRolePolicy(new iam.PolicyStatement({ 
            effect: iam.Effect.ALLOW,
            actions: [
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:UpdateItem',
              'dynamodb:DeleteItem',
              'dynamodb:Query',
              'dynamodb:Scan'
            ],
            resources: [props.evalResutlsTable.tableArn, props.evalResutlsTable.tableArn + "/index/*", props.evalSummariesTable.tableArn, props.evalSummariesTable.tableArn + "/index/*"]
          }));
          this.handleEvalResultsFunction = evalResultsAPIHandlerFunction;
          props.evalResutlsTable.grantReadWriteData(evalResultsAPIHandlerFunction);
          props.evalSummariesTable.grantReadWriteData(evalResultsAPIHandlerFunction);
      
          this.stepFunctionsStack = new StepFunctionsStack(scope, 'StepFunctionsStack', {
            knowledgeBase: props.knowledgeBase,
            evalSummariesTable: props.evalSummariesTable,
            evalResutlsTable: props.evalResutlsTable,
            evalTestCasesBucket: props.evalTestCasesBucket,
            systemPromptsHandlerName: systemPromptsAPIHandlerFunction.functionName
          });
    
    const userProfileHandlerFunction = new lambda.Function(scope, 'UserProfileHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, 'user-profile-handler')),
      handler: 'lambda_function.lambda_handler',
      environment: {
        "USER_PROFILES_TABLE": props.userProfilesTable.tableName,
        "IEP_DOCUMENTS_TABLE": props.iepDocumentsTable.tableName
      },
      timeout: cdk.Duration.seconds(300)
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

    this.userProfileFunction = userProfileHandlerFunction;

    // Add Cognito Post Confirmation Trigger Lambda
    const cognitoTriggerFunction = new lambda.Function(scope, 'CognitoTriggerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, 'user-profile-handler')),
      handler: 'cognito_trigger.lambda_handler',
      environment: {
        "USER_PROFILES_TABLE": props.userProfilesTable.tableName
      },
      timeout: cdk.Duration.seconds(30)
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
  }
}
