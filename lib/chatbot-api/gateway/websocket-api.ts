import * as cdk from "aws-cdk-lib";
import { aws_apigatewayv2 as apigwv2 } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as logs from "aws-cdk-lib/aws-logs";

// import { NagSuppressions } from "cdk-nag";

interface WebsocketBackendAPIProps {  
  // readonly userPool: UserPool;
  // readonly api: appsync.GraphqlApi;
}

export class WebsocketBackendAPI extends Construct {
  public readonly wsAPI : apigwv2.WebSocketApi;
  public readonly wsAPIStage : apigwv2.WebSocketStage;
  
  constructor(
    scope: Construct,
    id: string,
    props: WebsocketBackendAPIProps
  ) {
    super(scope, id);
    
    // Create CloudWatch log group for API access logging
    const logGroup = new logs.LogGroup(this, 'WebSocketAPILogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Create the WebSocket API with default route selection expression
    const webSocketApi = new apigwv2.WebSocketApi(this, 'WS-API', {
      apiName: 'ChatbotWebSocketAPI',
      routeSelectionExpression: '$request.body.action'
    });

    // Create the production stage
    const webSocketApiStage = new apigwv2.WebSocketStage(this, 'WS-API-prod', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true
    });
    
    this.wsAPI = webSocketApi;
    this.wsAPIStage = webSocketApiStage;

    // Output the WebSocket URL
    new cdk.CfnOutput(this, 'WebSocketURL', {
      value: webSocketApiStage.url,
      description: 'WebSocket API URL',
    });
  }
}
