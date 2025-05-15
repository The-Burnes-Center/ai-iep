import * as cdk from "aws-cdk-lib";

import { RestBackendAPI } from "./gateway/rest-api"
import { LambdaFunctionStack } from "./functions/functions"
import { TableStack } from "./tables/tables"
import { S3BucketStack } from "./buckets/buckets"
import { LoggingStack } from "./logging/logging"

import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { aws_apigatewayv2 as apigwv2 } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NewAuthorizationStack } from "../authorization/new-auth";

// import { NagSuppressions } from "cdk-nag";

export interface ChatBotApiProps {
  readonly authentication: NewAuthorizationStack;
}

export class ChatBotApi extends Construct {
  public readonly httpAPI: RestBackendAPI;
  public readonly logging: LoggingStack;

  constructor(scope: Construct, id: string, props: ChatBotApiProps) {
    super(scope, id);

    // Initialize logging
    this.logging = new LoggingStack(this, "Logging");

    const tables = new TableStack(this, "TableStack");
    const buckets = new S3BucketStack(this, "BucketStack");
    
    const restBackend = new RestBackendAPI(this, "RestBackend", {})
    this.httpAPI = restBackend;

    const lambdaFunctions = new LambdaFunctionStack(this, "LambdaFunctions",
      {
        knowledgeBucket: buckets.knowledgeBucket,
        userProfilesTable: tables.userProfilesTable,
        iepDocumentsTable: tables.iepDocumentsTable,
        userPool: props.authentication.userPool,
        logGroup: this.logging.logGroup,
        logRole: this.logging.logRole
      })

    const httpAuthorizer = new HttpJwtAuthorizer('HTTPAuthorizer', props.authentication.userPool.userPoolProviderUrl,{
      jwtAudience: [props.authentication.userPoolClient.userPoolClientId],
    });

    const s3GetKnowledgeAPIIntegration = new HttpLambdaIntegration('S3GetKnowledgeAPIIntegration', lambdaFunctions.getS3KnowledgeFunction);
    restBackend.restAPI.addRoutes({
      path: "/s3-knowledge-bucket-data",
      methods: [apigwv2.HttpMethod.POST],
      integration: s3GetKnowledgeAPIIntegration,
      authorizer: httpAuthorizer,
    })

    const s3DeleteAPIIntegration = new HttpLambdaIntegration('S3DeleteAPIIntegration', lambdaFunctions.deleteS3Function);
    restBackend.restAPI.addRoutes({
      path: "/delete-s3-file",
      methods: [apigwv2.HttpMethod.POST],
      integration: s3DeleteAPIIntegration,
      authorizer: httpAuthorizer,
    })

    const s3UploadKnowledgeAPIIntegration = new HttpLambdaIntegration('S3UploadKnowledgeAPIIntegration', lambdaFunctions.uploadS3KnowledgeFunction);
    restBackend.restAPI.addRoutes({
      path: "/signed-url-knowledge",
      methods: [apigwv2.HttpMethod.POST],
      integration: s3UploadKnowledgeAPIIntegration,
      authorizer: httpAuthorizer,
    })

    const userProfileAPIIntegration = new HttpLambdaIntegration(
      'UserProfileAPIIntegration', 
      lambdaFunctions.userProfileFunction
    );

    // Add routes for user profile management
    restBackend.restAPI.addRoutes({
      path: "/profile",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      integration: userProfileAPIIntegration,
      authorizer: httpAuthorizer,
    });

    restBackend.restAPI.addRoutes({
      path: "/profile/children",
      methods: [apigwv2.HttpMethod.POST],
      integration: userProfileAPIIntegration,
      authorizer: httpAuthorizer,
    });

    restBackend.restAPI.addRoutes({
      path: "/profile/children/{childId}/documents",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.DELETE],
      integration: userProfileAPIIntegration,
      authorizer: httpAuthorizer,
    });

    restBackend.restAPI.addRoutes({
      path: "/documents/{iepId}/status",
      methods: [apigwv2.HttpMethod.GET],
      integration: userProfileAPIIntegration,
      authorizer: httpAuthorizer,
    });

    restBackend.restAPI.addRoutes({
      path: "/summary",
      methods: [apigwv2.HttpMethod.POST],
      integration: userProfileAPIIntegration,
      authorizer: httpAuthorizer,
    });

    // Prints out the AppSync GraphQL API key to the terminal
    new cdk.CfnOutput(this, "HTTP-API - apiEndpoint", {
      value: restBackend.restAPI.apiEndpoint || "",
    });
  }
}