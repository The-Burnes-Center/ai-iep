import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { cognitoDomainName } from '../constants' 
import { UserPool, UserPoolIdentityProviderOidc,UserPoolClient, UserPoolClientIdentityProvider, ProviderAttribute } from 'aws-cdk-lib/aws-cognito';
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as path from 'path';
import { getTagProps, tagResource } from '../tags';

export class AuthorizationStack extends Construct {
  public readonly userPool : UserPool;
  public readonly userPoolClient : UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);

    // Replace these values with your Azure client ID, client secret, and issuer URL
    // const azureClientId = 'your-azure-client-id';
    // const azureClientSecret = 'your-azure-client-secret';
    // const azureIssuerUrl = 'https://your-azure-issuer.com';

    // Create the Cognito User Pool
    const userPool = new UserPool(this, 'UserPool', {      
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
      mfa: cognito.Mfa.OPTIONAL,
      autoVerify: { email: true, phone: true },
      signInAliases: {
        email: true,
      },
      customAttributes : {
        'role' : new cognito.StringAttribute({ minLen: 0, maxLen: 30, mutable: true })
      }
    });
    this.userPool = userPool;

    // Apply standard tags to the User Pool
    tagResource(userPool, {
      'Resource': 'UserPool',
      'Module': 'Authentication'
    });

    // Create a provider attribute for mapping Azure claims
    // const providerAttribute = new ProviderAttribute({
    //   name: 'custom_attr',
    //   type: 'String',
    // });
    userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: cognitoDomainName,
      },
    });
    
    
    // Add the Azure OIDC identity provider to the User Pool
    // const azureProvider = new UserPoolIdentityProviderOidc(this, 'AzureProvider', {
    //   clientId: azureClientId,
    //   clientSecret: azureClientSecret,
    //   issuerUrl: azureIssuerUrl,
    //   userPool: userPool,
    //   attributeMapping: {
    //     // email: ProviderAttribute.fromString('email'),
    //     // fullname: ProviderAttribute.fromString('name'),
    //     // custom: {
    //     //   customKey: providerAttribute,
    //     // },
    //   },
    //   // ... other optional properties
    // });

    const userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool,      
      // supportedIdentityProviders: [UserPoolClientIdentityProvider.custom(azureProvider.providerName)],
    });

    this.userPoolClient = userPoolClient;
    
    new cdk.CfnOutput(this, "UserPool ID", {
      value: userPool.userPoolId || "",
    });

    new cdk.CfnOutput(this, "UserPool Client ID", {
      value: userPoolClient.userPoolClientId || "",
    });

    // new cdk.CfnOutput(this, "UserPool Client Name", {
    //   value: userPoolClient.userPoolClientName || "",
    // });
  }
}
