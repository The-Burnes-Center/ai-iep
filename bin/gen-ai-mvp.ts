#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GenAiMvpStack } from '../lib/gen-ai-mvp-stack';
import { stackName } from "../lib/constants"
import { STANDARD_TAGS, getEnvironment } from '../lib/tags';
import { Logger } from '../lib/chatbot-api/logging/logger';

// Initialize the Logger singleton with the correct log group name
const environment = getEnvironment();
const logGroupName = `/ai-iep/${environment}/logs`;
Logger.initialize(logGroupName);

const app = new cdk.App();
const stack = new GenAiMvpStack(app, stackName, {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

// Apply standard tags at the stack level
Object.entries(STANDARD_TAGS).forEach(([key, value]) => {
  cdk.Tags.of(stack).add(key, value);
});