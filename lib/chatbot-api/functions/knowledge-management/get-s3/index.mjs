// Import necessary modules
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

export const handler = async (event) => {
  const s3Client = new S3Client();    
  const {continuationToken, pageIndex } = event;
  const s3Bucket = process.env.BUCKET;
  
  try {
    const command = new ListObjectsV2Command({
      Bucket: s3Bucket,
      ContinuationToken: continuationToken,
    });

    const result = await s3Client.send(command);
    
    return {
      statusCode: 200,
      headers: {
            'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
       headers: {
            'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({message: 'Get S3 Bucket data failed- Internal Server Error'}),
    };
  }
};
