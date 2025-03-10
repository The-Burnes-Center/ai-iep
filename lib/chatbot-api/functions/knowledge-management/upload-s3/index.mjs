// Import necessary modules from AWS SDK for S3 interaction
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const URL_EXPIRATION_SECONDS = 300; 
const BUCKET = process.env.BUCKET;
const IEP_DOCUMENTS_TABLE = process.env.IEP_DOCUMENTS_TABLE;

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

// Main Lambda entry point
export const handler = async (event) => {
  return await getUploadURL(event);
};

// Helper function to delete existing IEP documents for a child
const deleteExistingDocuments = async (childId, userId) => {
  try {
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
    
    // If documents exist for this child, delete them
    if (queryResult.Items && queryResult.Items.length > 0) {
      console.log(`Found ${queryResult.Items.length} existing documents for childId: ${childId}`);
      
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
        console.log(`Deleted document with iepId: ${doc.iepId} for childId: ${childId}`);
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

  const s3 = new S3Client({ region: 'us-east-1' }); //Initialize S3 client
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


