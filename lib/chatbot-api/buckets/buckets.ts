import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from "constructs";
import { createBucketPolicy } from './bucket-policy';
import * as iam from 'aws-cdk-lib/aws-iam';

export class S3BucketStack extends cdk.Stack {
  public readonly knowledgeBucket: s3.Bucket;
  public readonly feedbackBucket: s3.Bucket;
  public readonly evalTestCasesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a new S3 bucket
    this.knowledgeBucket = new s3.Bucket(scope, 'KnowledgeSourceBucket', {      
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET,s3.HttpMethods.POST,s3.HttpMethods.PUT,s3.HttpMethods.DELETE],
        allowedOrigins: ['*'],      
        allowedHeaders: ["*"]
      }]
    });

    // Apply restrictive bucket policy to the knowledge bucket (which contains IEP documents)
    // Replace these ARNs with the actual ARNs of the users who should have access
    const allowedUsers = [
      'arn:aws:iam::530075910224:user/dhruv', 
      'arn:aws:iam::530075910224:root',       
    ];

    // Create and apply the bucket policy
    createBucketPolicy(this, 'KnowledgeBucketPolicy', {
      bucket: this.knowledgeBucket,
      allowedUsers: allowedUsers
    });
    
    // Add direct permissions for Lambda functions in the same stack
    this.knowledgeBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [
        new iam.ArnPrincipal('arn:aws:iam::530075910224:user/dhruv'),
        new iam.ArnPrincipal('arn:aws:iam::530075910224:root')
      ],
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
        's3:GetBucketLocation'
      ],
      resources: [
        this.knowledgeBucket.bucketArn,
        `${this.knowledgeBucket.bucketArn}/*`
      ]
    }));
    
    // Add explicit deny for all non-authorized users (except Lambda execution roles)
    this.knowledgeBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      notPrincipals: [
        new iam.ArnPrincipal('arn:aws:iam::530075910224:user/dhruv'),
        new iam.ArnPrincipal('arn:aws:iam::530075910224:root'),
        new iam.ArnPrincipal('arn:aws:iam::530075910224:role/AIEPStack-CustomS3AutoDeleteObjectsCustomResourcePr-sqv2IxboHq9K')
      ],
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket'
      ],
      resources: [
        this.knowledgeBucket.bucketArn,
        `${this.knowledgeBucket.bucketArn}/*`
      ]
    }));

    this.feedbackBucket = new s3.Bucket(scope, 'FeedbackDownloadBucket', {
      // bucketName: 'feedback-download',
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET,s3.HttpMethods.POST,s3.HttpMethods.PUT,s3.HttpMethods.DELETE],
        allowedOrigins: ['*'], 
        allowedHeaders: ["*"]     
      }]
    });

    this.evalTestCasesBucket = new s3.Bucket(scope, 'EvalTestCasesBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET,s3.HttpMethods.POST,s3.HttpMethods.PUT,s3.HttpMethods.DELETE],
        allowedOrigins: ['*'], 
        allowedHeaders: ["*"]     
      }]
    });
  }
}
