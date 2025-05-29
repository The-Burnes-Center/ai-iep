import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { cognitoDomainName } from '../constants' 
import { UserPool, UserPoolIdentityProviderOidc, UserPoolClient, UserPoolClientIdentityProvider, ProviderAttribute } from 'aws-cdk-lib/aws-cognito';
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as path from 'path';
import { getTagProps, tagResource } from '../tags';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CfnUserPool } from 'aws-cdk-lib/aws-cognito';
import { Logger } from '../chatbot-api/logging/logger';

/**
 * CDK Construct for Cognito User Pool and SMS configuration for AI-IEP authentication.
 *
 * - Creates a Cognito User Pool with self sign-up, email/phone support, and optional SMS-MFA.
 * - Configures an IAM Role for Cognito SMS with trust policy conditions.
 * - Adds a CfnUserPoolSmsConfiguration for custom SMS messages.
 * - Applies standard tags and outputs resource ARNs/IDs.
 */
export class NewAuthorizationStack extends Construct {
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);

    // Use the shared Logger for consistent logging
    const logger = Logger.getInstance();

    // 1. Create the Cognito User Pool with self sign-up and email/phone support
    const userPool = new UserPool(this, 'NewUserPool', {      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      mfa: cognito.Mfa.OPTIONAL,
      autoVerify: { email: true, phone: true },
      signInAliases: {
        email: true,
        phone: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
      customAttributes: {
        'role': new cognito.StringAttribute({ minLen: 0, maxLen: 30, mutable: true })
      },
    });
    this.userPool = userPool;

    // 2. Create the IAM Role for Cognito SMS via SNS
    const cognitoSmsRole = new iam.Role(this, 'CognitoSmsRole', {
      assumedBy: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      inlinePolicies: {
        'AllowSnsPublish': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['sns:Publish'],
              resources: ['*'], // For production, restrict to your SNS topic(s)
            }),
          ],
        }),
      },
    });

    // 3. Add the trust policy override referencing the User Pool logical ID
    const cfnRole = cognitoSmsRole.node.defaultChild as iam.CfnRole;
    const cfnUserPool = userPool.node.defaultChild as CfnUserPool;
    cfnRole.addPropertyOverride('AssumeRolePolicyDocument.Statement.0.Condition', {
      'StringEquals': { 'sts:ExternalId': this.node.addr }
    });
    // Logging is fire-and-forget since constructors cannot be async
    logger.logEvent({
      eventType: 'AUTHZ_STACK',
      action: 'Created CognitoSmsRole',
      resourceType: 'COGNITO',
      resourceId: cognitoSmsRole.roleArn,
      details: { roleArn: cognitoSmsRole.roleArn, externalId: this.node.addr },
    });
    const smsRoleExternalId = this.node.addr;

    // 4. Attach the SMS role to the user pool
    cfnUserPool.smsConfiguration = {
      externalId: this.node.addr,
      snsCallerArn: cognitoSmsRole.roleArn,
    };
    cfnUserPool.smsAuthenticationMessage = 'Your authentication code is {####}';
    cfnUserPool.smsVerificationMessage = 'Your verification code is {####}';
    // Logging is fire-and-forget since constructors cannot be async
    logger.logEvent({
      eventType: 'AUTHZ_STACK',
      action: 'Configured Cognito SMS settings',
      resourceType: 'COGNITO',
      resourceId: userPool.userPoolId,
      details: { userPoolId: userPool.userPoolId },
    });

    // Apply standard tags to the User Pool
    tagResource(userPool, {
      'Resource': 'NewUserPool',
      'Module': 'Authentication'
    });

    // Create a unique domain prefix for the new user pool
    userPool.addDomain('NewCognitoDomain', {
      cognitoDomain: {
        domainPrefix: cognitoDomainName + '-new',
      },
    });
    
    const userPoolClient = new UserPoolClient(this, 'NewUserPoolClient', {
      userPool,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.COGNITO_ADMIN
        ],
        callbackUrls: [
          'http://localhost:3000',
          'https://localhost:3000',
          'http://localhost:5173',
          'https://localhost:5173',
        ],
        logoutUrls: [
          'http://localhost:3000',
          'https://localhost:3000',
          'http://localhost:5173',
          'https://localhost:5173',
        ],
      },
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.COGNITO
      ],
      preventUserExistenceErrors: false,
    });

    this.userPoolClient = userPoolClient;
    
    new cdk.CfnOutput(this, "New UserPool ID", {
      value: userPool.userPoolId || "",
    });

    new cdk.CfnOutput(this, "New UserPool Client ID", {
      value: userPoolClient.userPoolClientId || "",
    });
    
    new cdk.CfnOutput(this, "New Cognito Domain", {
      value: `https://${cognitoDomainName}-new.auth.${cdk.Aws.REGION}.amazoncognito.com` || "",
    });
    
    new cdk.CfnOutput(this, "New Cognito Console URL", {
      value: `https://${cdk.Aws.REGION}.console.aws.amazon.com/cognito/v2/idp/user-pools/${userPool.userPoolId}/users` || "",
    });

    new cdk.CfnOutput(this, "CognitoSmsRoleArn", {
      value: cognitoSmsRole.roleArn,
    });
  }
} 