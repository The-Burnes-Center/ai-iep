// Import necessary modules from AWS SDK for S3 interaction
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const URL_EXPIRATION_SECONDS = 300; 
const BUCKET = process.env.BUCKET;
const IEP_DOCUMENTS_TABLE = process.env.IEP_DOCUMENTS_TABLE;

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const s3 = new S3Client({ region: 'us-east-1' });

// Main Lambda entry point
export const handler = async (event) => {
  return await getUploadURL(event);
};

// Helper function to delete existing IEP documents for a child
const deleteExistingDocuments = async (childId, userId) => {
  try {
    // 1. First delete all existing S3 objects for this child
    try {
      // Create the S3 key prefix for this child (all objects under userId/childId/)
      const prefix = `${userId}/${childId}/`;
      
      console.log(`Listing S3 objects with prefix: ${prefix}`);
      
      // List all objects with this prefix
      const listParams = {
        Bucket: BUCKET,
        Prefix: prefix
      };
      
      const listedObjects = await s3.send(new ListObjectsV2Command(listParams));
      
      if (listedObjects.Contents && listedObjects.Contents.length > 0) {
        console.log(`Found ${listedObjects.Contents.length} S3 objects to delete for childId: ${childId}`);
        
        // Delete each object individually
        for (const object of listedObjects.Contents) {
          await s3.send(new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: object.Key
          }));
          console.log(`Deleted S3 object: ${object.Key}`);
        }
      } else {
        console.log(`No S3 objects found with prefix: ${prefix}`);
      }
    } catch (s3Error) {
      console.error('Error deleting S3 objects:', s3Error);
      // Continue processing even if S3 deletion fails
    }
    
    // 2. Now delete document records from DynamoDB
    // Query for existing documents for this child
    const queryParams = {
      TableName: IEP_DOCUMENTS_TABLE,
      IndexName: 'byChildId',
      KeyConditionExpression: 'childId = :childId',
      ExpressionAttributeValues: {
        ':childId': childId
      }
    };
    
    const queryResult = await ddb.send(new QueryCommand(queryParams));
    
    // If documents exist for this child, delete them from DynamoDB
    if (queryResult.Items && queryResult.Items.length > 0) {
      console.log(`Found ${queryResult.Items.length} existing documents for childId: ${childId} in DynamoDB`);
      
      // Only delete documents that belong to this user
      const documentsToDelete = queryResult.Items.filter(doc => doc.userId === userId);
      
      for (const doc of documentsToDelete) {
        await ddb.send(new DeleteCommand({
          TableName: IEP_DOCUMENTS_TABLE,
          Key: {
            iepId: doc.iepId,
            childId: doc.childId
          }
        }));
        console.log(`Deleted document record with iepId: ${doc.iepId} for childId: ${childId} from DynamoDB`);
      }
    }
  } catch (error) {
    console.error('Error deleting existing documents:', error);
    // Continue execution even if deletion fails
  }
};

//Helper function to generate a presigned upload URL for S3
const getUploadURL = async function (event) {
  const body = JSON.parse(event.body); //Parse the incoming request body
  const fileName = body.fileName; //Retrieve the file name
  const fileType = body.fileType; //Retrieve the file type
  const operation = body.operation; //Retrieve the operation type
  const childId = body.childId; // Get the childId for linking

  // Get userId from Cognito claims
  const userId = event.requestContext.authorizer.jwt.claims.sub;

  if (!fileName || !operation || !childId) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'fileName, operation, and childId are required' }),
    };
  }

  // Use the global S3 client defined at the top of the file
  let params;
  if (operation === 'upload') {
    if (!fileType) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'fileType is required for upload' }),
      };
    }

    // Generate unique IEP document ID
    const iepId = `iep-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const s3Key = `${userId}/${childId}/${iepId}/${fileName}`;

    params = {
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: fileType,
    };

    const command = new PutObjectCommand(params);
    try {
      const signedUrl = await getSignedUrl(s3, command, {
        expiresIn: URL_EXPIRATION_SECONDS,
      });

      // Create document record in DynamoDB
      const timestamp = Math.floor(Date.now() / 1000);
      const documentRecord = {
        iepId: iepId,
        childId: childId,
        userId: userId,
        documentUrl: `s3://${BUCKET}/${s3Key}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        summaries: {}
      };

      // Delete any existing IEP documents for this child BEFORE adding the new one
      await deleteExistingDocuments(childId, userId);

      // Add the new document record
      await ddb.send(new PutCommand({
        TableName: IEP_DOCUMENTS_TABLE,
        Item: documentRecord
      }));

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          signedUrl,
          iepId,
          documentUrl: `s3://${BUCKET}/${s3Key}`
        }),
      };
    } catch (err) {
      console.error('Error:', err);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Failed to generate signed URL or save document record' }),
      };
    }
  }

  params = {
    Bucket: BUCKET,
    Key: fileName,
  };
  const command = new GetObjectCommand(params);
  try {
    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: URL_EXPIRATION_SECONDS,
    });
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ signedUrl }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to generate signed URL' }),
    };
  }
};


