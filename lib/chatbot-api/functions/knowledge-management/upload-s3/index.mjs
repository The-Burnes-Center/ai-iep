// Import necessary modules from AWS SDK for S3 interaction
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const URL_EXPIRATION_SECONDS = 300; 
const BUCKET = process.env.BUCKET;
const IEP_DOCUMENTS_TABLE = process.env.IEP_DOCUMENTS_TABLE;

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

// Main Lambda entry point
export const handler = async (event) => {
  return await getUploadURL(event);
};

//Helper function to generate a presigned upload URL for S3
const getUploadURL = async function (event) {
  const body = JSON.parse(event.body); //Parse the incoming request body
  const fileName = body.fileName; //Retrieve the file name
  const fileType = body.fileType; //Retrieve the file type
  const operation = body.operation; //Retrieve the operation type
  const kidId = body.kidId; // Get the kidId for linking

  // Get userId from Cognito claims
  const userId = event.requestContext.authorizer.jwt.claims.sub;

  if (!fileName || !operation || !kidId) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'fileName, operation, and kidId are required' }),
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
    const s3Key = `${userId}/${kidId}/${iepId}/${fileName}`;

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
        kidId: kidId,
        userId: userId,
        documentUrl: `s3://${BUCKET}/${s3Key}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        summaries: {}
      };

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


