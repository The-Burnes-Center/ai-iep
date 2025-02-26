import * as path from "path";
import * as cdk from "aws-cdk-lib";

import { Construct } from "constructs";
import { Duration, aws_apigatewayv2 as apigwv2 } from "aws-cdk-lib";

import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
// import { Shared } from "../shared";
import * as appsync from "aws-cdk-lib/aws-appsync";
// import { parse } from "graphql";
import { readFileSync } from "fs";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface RestBackendAPIProps {
  // Add any required props
}

export class RestBackendAPI extends Construct {
  public readonly restAPI: apigwv2.HttpApi;
  constructor(scope: Construct, id: string, props: RestBackendAPIProps) {
    super(scope, id);

    const httpApi = new apigwv2.HttpApi(this, 'HTTP-API', {
      corsPreflight: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
          'Accept',
          'Origin',
          'Access-Control-Request-Method',
          'Access-Control-Request-Headers'
        ],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.HEAD,
          apigwv2.CorsHttpMethod.OPTIONS,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
        ],
        allowOrigins: ['*'],
        maxAge: Duration.days(10),
        exposeHeaders: ['*'],
        allowCredentials: false
      },
      // The following settings tell API Gateway to automatically handle OPTIONS
      // requests at the gateway level without passing them to Lambda
      defaultIntegration: undefined,
      disableExecuteApiEndpoint: false,
    });
    this.restAPI = httpApi;    
  }
}
