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


export interface ChatBotApiProps {
  readonly authentication?: NewAuthorizationStack;
}

export class ChatBotApi extends Construct {
  public readonly httpAPI: RestBackendAPI;
  public readonly logging: LoggingStack;
  public readonly userProfilesTable: any;
  private lambdaFunctions: LambdaFunctionStack;
  private tables: TableStack;
  private buckets: S3BucketStack;

  constructor(scope: Construct, id: string, props: ChatBotApiProps) {
    super(scope, id);

    // Initialize logging
    this.logging = new LoggingStack(this, "Logging");

    this.tables = new TableStack(this, "TableStack");
    this.buckets = new S3BucketStack(this, "BucketStack");
    
    // Expose user profiles table
    this.userProfilesTable = this.tables.userProfilesTable;
    
    const restBackend = new RestBackendAPI(this, "RestBackend", {})
    this.httpAPI = restBackend;

    // If authentication is provided, set up the full API
    if (props.authentication) {
      this.setupApiWithAuthentication(props.authentication);
    }
  }

  /**
   * Set authentication and set up the API routes
   */
  public setAuthentication(authentication: NewAuthorizationStack) {
    this.setupApiWithAuthentication(authentication);
  }

  /**
   * Set up API routes with authentication
   */
  private setupApiWithAuthentication(authentication: NewAuthorizationStack) {
    this.lambdaFunctions = new LambdaFunctionStack(this, "LambdaFunctions",
      {
        knowledgeBucket: this.buckets.knowledgeBucket,
        userProfilesTable: this.tables.userProfilesTable,
        iepDocumentsTable: this.tables.iepDocumentsTable,
        userPool: authentication.userPool,
        logGroup: this.logging.logGroup,
        logRole: this.logging.logRole
      })

    const httpAuthorizer = new HttpJwtAuthorizer('HTTPAuthorizer', authentication.userPool.userPoolProviderUrl,{
      jwtAudience: [authentication.userPoolClient.userPoolClientId],
    });

    const s3GetKnowledgeAPIIntegration = new HttpLambdaIntegration('S3GetKnowledgeAPIIntegration', this.lambdaFunctions.getS3KnowledgeFunction);
    this.httpAPI.restAPI.addRoutes({
      path: "/s3-knowledge-bucket-data",
      methods: [apigwv2.HttpMethod.POST],
      integration: s3GetKnowledgeAPIIntegration,
      authorizer: httpAuthorizer,
    })

    const s3DeleteAPIIntegration = new HttpLambdaIntegration('S3DeleteAPIIntegration', this.lambdaFunctions.deleteS3Function);
    this.httpAPI.restAPI.addRoutes({
      path: "/delete-s3-file",
      methods: [apigwv2.HttpMethod.POST],
      integration: s3DeleteAPIIntegration,
      authorizer: httpAuthorizer,
    })

    const s3UploadKnowledgeAPIIntegration = new HttpLambdaIntegration('S3UploadKnowledgeAPIIntegration', this.lambdaFunctions.uploadS3KnowledgeFunction);
    this.httpAPI.restAPI.addRoutes({
      path: "/signed-url-knowledge",
      methods: [apigwv2.HttpMethod.POST],
      integration: s3UploadKnowledgeAPIIntegration,
      authorizer: httpAuthorizer,
    })

    const userProfileAPIIntegration = new HttpLambdaIntegration(
      'UserProfileAPIIntegration', 
      this.lambdaFunctions.userProfileFunction
    );

    // Add routes for user profile management
    this.httpAPI.restAPI.addRoutes({
      path: "/profile",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT, apigwv2.HttpMethod.DELETE],
      integration: userProfileAPIIntegration,
      authorizer: httpAuthorizer,
    });

    this.httpAPI.restAPI.addRoutes({
      path: "/profile/children",
      methods: [apigwv2.HttpMethod.POST],
      integration: userProfileAPIIntegration,
      authorizer: httpAuthorizer,
    });

    this.httpAPI.restAPI.addRoutes({
      path: "/profile/children/{childId}/documents",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.DELETE],
      integration: userProfileAPIIntegration,
      authorizer: httpAuthorizer,
    });

    this.httpAPI.restAPI.addRoutes({
      path: "/documents/{iepId}/status",
      methods: [apigwv2.HttpMethod.GET],
      integration: userProfileAPIIntegration,
      authorizer: httpAuthorizer,
    });

    this.httpAPI.restAPI.addRoutes({
      path: "/summary",
      methods: [apigwv2.HttpMethod.POST],
      integration: userProfileAPIIntegration,
      authorizer: httpAuthorizer,
    });

    // Prints out the AppSync GraphQL API key to the terminal
    new cdk.CfnOutput(this, "HTTP-API - apiEndpoint", {
      value: this.httpAPI.restAPI.apiEndpoint || "",
    });
  }
}