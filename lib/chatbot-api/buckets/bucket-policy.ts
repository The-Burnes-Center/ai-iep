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
      actions: ['s3:*'],
      resources: [
        props.bucket.bucketArn,
        `${props.bucket.bucketArn}/*`
      ],
    });

    policy.document.addStatements(allowStatement);
  }

  return policy;
} 