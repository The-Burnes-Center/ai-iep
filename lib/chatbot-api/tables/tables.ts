import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Attribute, AttributeType, Table, ProjectionType } from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class TableStack extends Stack {
  public readonly historyTable : Table;
  public readonly feedbackTable : Table;
  public readonly evalResultsTable : Table;
  public readonly evalSummaryTable : Table;
  public readonly activeSystemPromptsTable : Table;
  public readonly stagedSystemPromptsTable : Table;
  public readonly userProfilesTable: dynamodb.Table;
  public readonly iepDocumentsTable: dynamodb.Table;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Define the table
    const chatHistoryTable = new Table(scope, 'ChatHistoryTable', {
      partitionKey: { name: 'user_id', type: AttributeType.STRING },
      sortKey: { name: 'session_id', type: AttributeType.STRING },
    });

    // Add a global secondary index to sort ChatHistoryTable by time_stamp
    chatHistoryTable.addGlobalSecondaryIndex({
      indexName: 'TimeIndex',
      partitionKey: { name: 'user_id', type: AttributeType.STRING },
      sortKey: { name: 'time_stamp', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    this.historyTable = chatHistoryTable;

    // Define the second table (UserFeedbackTable)
    const userFeedbackTable = new Table(scope, 'UserFeedbackTable', {
      partitionKey: { name: 'Topic', type: AttributeType.STRING },
      sortKey: { name: 'CreatedAt', type: AttributeType.STRING },
    });

    // Add a global secondary index to UserFeedbackTable with partition key CreatedAt
    userFeedbackTable.addGlobalSecondaryIndex({
      indexName: 'CreatedAtIndex',
      partitionKey: { name: 'CreatedAt', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });
    
    userFeedbackTable.addGlobalSecondaryIndex({
      indexName: 'AnyIndex',
      partitionKey: { name: 'Any', type: AttributeType.STRING },
      sortKey: { name: 'CreatedAt', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });
    this.feedbackTable = userFeedbackTable; 
    
    const evalSummariesTable = new Table(scope, 'EvaluationSummariesTable', {
      partitionKey: { name: 'PartitionKey', type: AttributeType.STRING },
      sortKey: { name: 'Timestamp', type: AttributeType.STRING },
    });
    this.evalSummaryTable = evalSummariesTable;

    const evalResultsTable = new Table(scope, 'EvaluationResultsTable', {
      partitionKey: { name: 'EvaluationId', type: AttributeType.STRING },
      sortKey: { name: 'QuestionId', type: AttributeType.STRING },
    });
    // add secondary index to sort EvaluationResultsTable by Question ID
    evalResultsTable.addGlobalSecondaryIndex({
      indexName: 'QuestionIndex',
      partitionKey: { name: 'EvaluationId', type: AttributeType.STRING },
      sortKey: { name: 'QuestionId', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });
    this.evalResultsTable = evalResultsTable;

    const activeSystemPromptsTable = new Table(scope, 'ActiveSystemPromptsTable', {
      partitionKey: { name: 'PartitionKey', type: AttributeType.STRING },
      sortKey: { name: 'Timestamp', type: AttributeType.STRING }, 
    });
    this.activeSystemPromptsTable = activeSystemPromptsTable;

    const stagedSystemPromptsTable = new Table(scope, 'StagedSystemPromptsTable', {
      partitionKey: { name: 'PartitionKey', type: AttributeType.STRING },
      sortKey: { name: 'Timestamp', type: AttributeType.STRING }, 
    });
    this.stagedSystemPromptsTable = stagedSystemPromptsTable;

    // Create User Profiles Table
    this.userProfilesTable = new dynamodb.Table(scope, 'UserProfilesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    // Create IEP Documents Table
    this.iepDocumentsTable = new dynamodb.Table(scope, 'IepDocumentsTable', {
      partitionKey: { name: 'iepId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'childId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    // Add GSI for querying documents by userId
    this.iepDocumentsTable.addGlobalSecondaryIndex({
      indexName: 'byUserId',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.NUMBER },
    });

    // Original GSI for querying documents by kidId - keep for compatibility
    this.iepDocumentsTable.addGlobalSecondaryIndex({
      indexName: 'byKidId',
      partitionKey: { name: 'kidId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.NUMBER },
    });

    // New GSI for querying documents by childId
    this.iepDocumentsTable.addGlobalSecondaryIndex({
      indexName: 'byChildId',
      partitionKey: { name: 'childId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.NUMBER },
    });
  }
}
