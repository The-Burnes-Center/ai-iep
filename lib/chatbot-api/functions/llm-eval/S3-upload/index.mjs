// Import necessary modules from AWS SDK for S3 interaction
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const URL_EXPIRATION_SECONDS = 300; 
const BUCKET = process.env.BUCKET

// Main Lambda entry point
export const handler = async (event) => {
  return await getUploadURL(event); //Call the helper function
};

//Helper function to generate a presigned upload URL for S3
const getUploadURL = async function (event) {
  const body = JSON.parse(event.body); //Parse the incoming request body
  const fileName = body.fileName; //Retrieve the file name
  const fileType = body.fileType; //Retrieve the file type
  const operation = body.operation; //Retrieve the operation type

  if (!fileName || !operation) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'fileName and operation are required' }),
    };
  }
  const s3 = new S3Client({ region: 'us-east-1' }); //Initlialize S3 client
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
    params = { //Parameters for S3 PutObjectCommand
      Bucket: process.env.BUCKET, //S3 bucket name for environment
      Key: fileName, //S3 object key (filename)
      ContentType: fileType, //MIME type of the file
    };
    const command = new PutObjectCommand(params);
    try {
      const signedUrl = await getSignedUrl(s3, command, {
        expiresIn: URL_EXPIRATION_SECONDS, //Set URL expiration time
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
  } else if (operation === "download"){
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
  }



};