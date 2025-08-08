import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as kms from 'aws-cdk-lib/aws-kms';
import { getEnvironment } from '../../tags';

export interface LogEvent {
  timestamp: string;
  eventType: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, any>;
  environment: string;
  ipAddress?: string;
  userAgent?: string;
  compliance?: {
    dataClassification?: 'PII' | 'PHI' | 'PUBLIC' | 'CONFIDENTIAL';
    retentionPeriod?: number;
    regulatoryRequirements?: string[];
  };
}

export interface LoggingStackProps {
  kmsKey?: kms.IKey;
}

export class LoggingStack extends Construct {
  public readonly logGroup: logs.LogGroup;
  public readonly logRole: iam.Role;

  constructor(scope: Construct, id: string, props?: LoggingStackProps) {
    super(scope, id);

    // Create a dedicated IAM role for logging
    this.logRole = new iam.Role(this, 'LogRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for logging in AI-IEP application',
    });

    // Get current environment
    const environment = getEnvironment();
    
    // Create CloudWatch Log Group with compliance-focused settings
    // Base properties for all environments
    const baseProps: logs.LogGroupProps = {
      logGroupName: `/ai-iep/${environment}/logs`,
      retention: logs.RetentionDays.ONE_YEAR, // Adjust based on compliance requirements
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Retain logs even if stack is destroyed
      ...(props?.kmsKey ? { encryptionKey: props.kmsKey } : {}),
    };
    
    // Create log group with default encryption for all environments
    this.logGroup = new logs.LogGroup(this, 'LogGroup', baseProps);

    // If a KMS key is provided, allow CloudWatch Logs service to use it for this log group
    if (props?.kmsKey) {
      props.kmsKey.addToResourcePolicy(new iam.PolicyStatement({
        sid: 'AllowCloudWatchLogsUseOfKms',
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.ServicePrincipal(`logs.${cdk.Aws.REGION}.amazonaws.com`)
        ],
        actions: [
          'kms:Encrypt',
          'kms:Decrypt',
          'kms:ReEncrypt*',
          'kms:GenerateDataKey*',
          'kms:Describe*'
        ],
        resources: ['*'],
        conditions: {
          ArnEquals: {
            'kms:EncryptionContext:aws:logs:arn': this.logGroup.logGroupArn,
          },
        },
      }));
    }

    // Add permissions to the role
    this.logRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogStreams'
        ],
        resources: [this.logGroup.logGroupArn]
      })
    );

    // Add metric filters for compliance monitoring
    this.addComplianceMetricFilters();
  }

  private addComplianceMetricFilters(): void {
    // Monitor PII/PHI access
    this.logGroup.addMetricFilter('PIIAccessFilter', {
      filterPattern: logs.FilterPattern.stringValue('$.compliance.dataClassification', '=', 'PII'),
      metricName: 'PIIAccessCount',
      metricNamespace: 'AI-IEP/Logs',
      metricValue: '1'
    });

    // Monitor document access
    this.logGroup.addMetricFilter('DocumentAccessFilter', {
      filterPattern: logs.FilterPattern.stringValue('$.resourceType', '=', 'DOCUMENT'),
      metricName: 'DocumentAccessCount',
      metricNamespace: 'AI-IEP/Logs',
      metricValue: '1'
    });

    // Monitor failed authentication attempts
    this.logGroup.addMetricFilter('AuthFailureFilter', {
      filterPattern: logs.FilterPattern.stringValue('$.eventType', '=', 'AUTH_FAILURE'),
      metricName: 'AuthFailureCount',
      metricNamespace: 'AI-IEP/Logs',
      metricValue: '1'
    });
  }
} 