import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as triggers from 'aws-cdk-lib/triggers'
import * as cr from 'aws-cdk-lib/custom-resources'

import { aws_opensearchserverless as opensearchserverless } from 'aws-cdk-lib';
import { aws_bedrock as bedrock } from 'aws-cdk-lib';

import { Construct } from "constructs";
import { stackName } from "../../constants"
import { OpenSearchStack } from "../opensearch/opensearch"
import { STANDARD_TAGS } from '../../tags';

export interface KnowledgeBaseStackProps {
  readonly openSearch: OpenSearchStack,
  readonly s3bucket : s3.Bucket
}

export class KnowledgeBaseStack extends cdk.Stack {

  public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  public readonly dataSource: bedrock.CfnDataSource;

  constructor(scope: Construct, id: string, props: KnowledgeBaseStackProps) {
    super(scope, id);

    // add AOSS access to the role
    props.openSearch.knowledgeBaseRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['aoss:APIAccessAll'],
        resources: [
          `arn:aws:aoss:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:collection/${props.openSearch.openSearchCollectionId}`
        ]
      }
      )
    )

    // add s3 access to the role
    props.openSearch.knowledgeBaseRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*'
      ],
      resources: [props.s3bucket.bucketArn, props.s3bucket.bucketArn + "/*"]
    }));

    // add bedrock access to the role
    props.openSearch.knowledgeBaseRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/amazon.titan-embed-text-v2:0`
      ]
    }
    )
    )

    // Create the Bedrock knowledge base with OpenSearch as the vector store
    const knowledgeBase = new bedrock.CfnKnowledgeBase(scope, 'KnowledgeBase', {
      name: "ai-iep-knowledge-base",
      description: "IEP docs knowledge base",
      roleArn: props.openSearch.knowledgeBaseRole.roleArn,
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/amazon.titan-embed-text-v2:0`
        }
      },
      storageConfiguration: {
        type: "OPENSEARCH_SERVERLESS",
        opensearchServerlessConfiguration: {
          collectionArn: `arn:aws:aoss:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:collection/${props.openSearch.openSearchCollectionId}`,
          vectorIndexName: "knowledge-base-index",
          fieldMapping: {
            vectorField: "vector_field",
            textField: "text_field",
            metadataField: "metadata_field"
          }
        }
      }
    });
    
    // Add tags using CDK Tags API
    cdk.Tags.of(knowledgeBase).add('Resource', 'BedrockKnowledgeBase');
    cdk.Tags.of(knowledgeBase).add('Purpose', 'IEPDocuments');
    cdk.Tags.of(knowledgeBase).add('Service', 'Bedrock');
    
    // Add standard tags
    Object.entries(STANDARD_TAGS).forEach(([key, value]) => {
      cdk.Tags.of(knowledgeBase).add(key, value);
    });

    // Create S3 data source for the knowledge base
    const dataSource = new bedrock.CfnDataSource(scope, 'S3DataSource', {
      name: "ai-iep-s3-data-source",
      description: "S3 data source for IEP documents",
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: {
          bucketArn: props.s3bucket.bucketArn
        }
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: "FIXED_SIZE",
          fixedSizeChunkingConfiguration: {
            maxTokens: 1024,
            overlapPercentage: 20
          }
        }
      }
    });
    
    // Add tags using CDK Tags API
    cdk.Tags.of(dataSource).add('Resource', 'BedrockDataSource');
    cdk.Tags.of(dataSource).add('Purpose', 'S3Documents');
    cdk.Tags.of(dataSource).add('Service', 'Bedrock');
    
    // Add standard tags
    Object.entries(STANDARD_TAGS).forEach(([key, value]) => {
      cdk.Tags.of(dataSource).add(key, value);
    });

    this.knowledgeBase = knowledgeBase;
    this.dataSource = dataSource;
  }
}