import * as cdk from 'aws-cdk-lib';
import { Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * Standard tags to apply to all resources in the stack
 */
export const STANDARD_TAGS = {
  Project: 'AI-IEP',
  Environment: process.env.NODE_ENV || 'development',
  ManagedBy: 'CDK',
  Owner: 'BurnesCenter',
  Application: 'IEP Tool',
};

/**
 * Apply standard tags to an entire construct and all its children
 * 
 * @param scope The construct to tag
 * @param additional Additional tags to apply (optional)
 */
export function applyTags(scope: Construct, additional?: Record<string, string>): void {
  const allTags = { ...STANDARD_TAGS, ...additional };
  
  Object.entries(allTags).forEach(([key, value]) => {
    Tags.of(scope).add(key, value);
  });
}

/**
 * Generate tag props for direct use in resource creation
 * 
 * @param additional Additional tags to apply (optional)
 * @returns Tag props for AWS resources
 */
export function getTagProps(additional?: Record<string, string>): { [key: string]: string } {
  return { ...STANDARD_TAGS, ...additional };
}

/**
 * Apply tags to a specific resource
 * 
 * @param resource The resource to tag
 * @param additional Additional tags to apply (optional)
 */
export function tagResource(resource: cdk.Resource, additional?: Record<string, string>): void {
  const allTags = { ...STANDARD_TAGS, ...additional };
  
  Object.entries(allTags).forEach(([key, value]) => {
    cdk.Tags.of(resource).add(key, value);
  });
} 