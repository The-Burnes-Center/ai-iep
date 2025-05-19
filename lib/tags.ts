import * as cdk from 'aws-cdk-lib';
import { Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * Environment type for the application
 */
export type Environment = 'production' | 'staging' | 'development';

/**
 * Get the current environment based on branch, environment variable, or local development
 */
export function getEnvironment(): Environment {
  // Check for environment variable first
  const env = process.env.ENVIRONMENT || process.env.NODE_ENV;
  
  // If explicitly set to staging, use staging
  if (env === 'staging') return 'staging';
  
  // If explicitly set to development or running locally, use development
  if (env === 'development' || process.env.LOCAL_DEVELOPMENT === 'true') {
    return 'development';
  }
  
  // Default to production for safety
  return 'production';
}

/**
 * Get environment-specific resource name
 * @param baseName The base name of the resource
 * @returns The environment-specific resource name
 */
export function getResourceName(baseName: string): string {
  const env = getEnvironment();
  
  // Only append environment suffix for staging
  if (env === 'staging') {
    return `${baseName}-staging`;
  }
  
  // For development, append -dev
  if (env === 'development') {
    return `${baseName}-dev`;
  }
  
  // Production remains unchanged
  return baseName;
}

/**
 * Standard tags to apply to all resources in the stack
 */
export const STANDARD_TAGS = {
  Project: 'AI-IEP',
  Environment: getEnvironment(),
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