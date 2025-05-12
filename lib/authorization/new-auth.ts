import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { cognitoDomainName } from '../constants' 
import { UserPool, UserPoolIdentityProviderOidc, UserPoolClient, UserPoolClientIdentityProvider, ProviderAttribute } from 'aws-cdk-lib/aws-cognito';
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as path from 'path';
import { getTagProps, tagResource } from '../tags';

export class NewAuthorizationStack extends Construct {
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);

    // Create the Cognito User Pool with self sign-up and email/phone support
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
      }
    });
    this.userPool = userPool;

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
      preventUserExistenceErrors: true,
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
  }
} 