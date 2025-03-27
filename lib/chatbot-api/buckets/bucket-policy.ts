import { Construct } from 'constructs';
import { PolicyStatement, Effect, ArnPrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket, BucketPolicy } from 'aws-cdk-lib/aws-s3';

export interface BucketPolicyProps {
  bucket: Bucket;
  allowedUsers: string[];
}

export function createBucketPolicy(scope: Construct, id: string, props: BucketPolicyProps): BucketPolicy {
  // Create bucket policy
  const policy = new BucketPolicy(scope, id, {
    bucket: props.bucket,
  });

  // Add policy statement allowing access to specified users
  if (props.allowedUsers.length > 0) {
    const allowStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      principals: props.allowedUsers.map(user => new ArnPrincipal(user)),
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
        's3:GetBucketLocation'
      ],
      resources: [
        props.bucket.bucketArn,
        `${props.bucket.bucketArn}/*`
      ],
    });

    // Add the statement that requires secure transport
    const secureTransportStatement = new PolicyStatement({
      effect: Effect.DENY,
      principals: [new ArnPrincipal('*')],
      actions: ['s3:*'],
      resources: [
        props.bucket.bucketArn,
        `${props.bucket.bucketArn}/*`
      ],
      conditions: {
        'Bool': {
          'aws:SecureTransport': 'false'
        }
      }
    });

    policy.document.addStatements(allowStatement);
    policy.document.addStatements(secureTransportStatement);
  }

  return policy;
} 