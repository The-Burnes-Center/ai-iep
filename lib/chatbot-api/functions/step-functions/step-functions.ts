import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

// Import Lambda L2 construct
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as bedrock from "aws-cdk-lib/aws-bedrock";

interface StepFunctionsStackProps {
    readonly knowledgeBase : bedrock.CfnKnowledgeBase;
    readonly systemPromptsHandlerName: string;
}

export class StepFunctionsStack extends Construct {
    constructor(scope: Construct, id: string, props: StepFunctionsStackProps) {
        super(scope, id);
        // Step Functions stack is now simplified without LLM evaluation components
    }
}