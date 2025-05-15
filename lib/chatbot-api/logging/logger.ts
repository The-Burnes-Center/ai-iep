import { CloudWatchLogsClient, CreateLogStreamCommand, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { LogEvent } from './logging';

export class Logger {
  private static instance: Logger;
  private cloudWatchLogs: CloudWatchLogsClient;
  private logGroupName: string;

  private constructor(logGroupName: string) {
    this.cloudWatchLogs = new CloudWatchLogsClient({});
    this.logGroupName = logGroupName;
  }

  public static initialize(logGroupName: string): void {
    if (!Logger.instance) {
      Logger.instance = new Logger(logGroupName);
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      throw new Error('Logger not initialized');
    }
    return Logger.instance;
  }

  public async logEvent(event: Omit<LogEvent, 'timestamp' | 'environment'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const environment = process.env.ENVIRONMENT || 'development';

    const logEvent: LogEvent = {
      ...event,
      timestamp,
      environment,
    };

    try {
      // Create a log stream for each day
      const logStreamName = new Date().toISOString().split('T')[0];
      
      // Ensure log stream exists
      try {
        await this.cloudWatchLogs.send(new CreateLogStreamCommand({
          logGroupName: this.logGroupName,
          logStreamName,
        }));
      } catch (error) {
        // Ignore if stream already exists
        if (error.name !== 'ResourceAlreadyExistsException') {
          throw error;
        }
      }

      // Put the log event
      await this.cloudWatchLogs.send(new PutLogEventsCommand({
        logGroupName: this.logGroupName,
        logStreamName,
        logEvents: [
          {
            timestamp: new Date().getTime(),
            message: JSON.stringify(logEvent),
          },
        ],
      }));
    } catch (error) {
      console.error('Failed to write log:', error);
      // Fallback to console logging if CloudWatch fails
      console.log('LOG:', JSON.stringify(logEvent));
    }
  }

  // Helper methods for common events
  public async logDocumentAccess(
    userId: string,
    documentId: string,
    action: 'VIEW' | 'DOWNLOAD' | 'UPLOAD' | 'DELETE',
    details: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'DOCUMENT_ACCESS',
      userId,
      action,
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      details,
      ipAddress,
      userAgent,
      compliance: {
        dataClassification: 'CONFIDENTIAL',
        retentionPeriod: 365, // 1 year
        regulatoryRequirements: ['FERPA', 'HIPAA'],
      },
    });
  }

  public async logUserAction(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'USER_ACTION',
      userId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
      userAgent,
    });
  }

  public async logAuthEvent(
    userId: string,
    action: 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN',
    details: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      eventType: action === 'FAILED_LOGIN' ? 'AUTH_FAILURE' : 'AUTH_SUCCESS',
      userId,
      action,
      resourceType: 'AUTH',
      resourceId: userId,
      details,
      ipAddress,
      userAgent,
    });
  }
} 