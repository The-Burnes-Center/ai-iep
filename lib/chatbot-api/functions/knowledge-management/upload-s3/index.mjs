// Import necessary modules from AWS SDK for S3 interaction
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
// Fetch is built-in for Node.js >= 18

const URL_EXPIRATION_SECONDS = 300; 
const BUCKET = process.env.BUCKET;
const IEP_DOCUMENTS_TABLE = process.env.IEP_DOCUMENTS_TABLE;
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || "UserProfilesTable";
const API_ENDPOINT = process.env.API_ENDPOINT || "https://api.ai-iep.org"; // API Gateway endpoint

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const s3 = new S3Client({ region: 'us-east-1' });

// Main Lambda entry point
export const handler = async (event) => {
  return await getUploadURL(event);
};

// Helper function to delete existing IEP documents for a child
const deleteExistingDocuments = async (childId, userId, authToken) => {
  try {
    console.log(`Calling DELETE API to remove existing IEP documents for childId: ${childId}`);
    
    // Call the DELETE API endpoint to remove existing documents
    const response = await fetch(`${API_ENDPOINT}/profile/children/${childId}/documents`, {
      method: 'DELETE',
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Error calling DELETE API: ${response.status} ${response.statusText}`, errorData);
      // Continue execution even if API call fails - we don't want to block uploads
      // if document deletion fails
    } else {
      const data = await response.json();
      console.log(`Successfully deleted IEP documents through API: ${JSON.stringify(data)}`);
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

  // Get user information from Cognito claims
  const userId = event.requestContext.authorizer.jwt.claims.sub;
  // Get the authorization token from the request headers
  const authToken = event.headers.Authorization || event.headers.authorization;

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
      await deleteExistingDocuments(childId, userId, authToken);

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


