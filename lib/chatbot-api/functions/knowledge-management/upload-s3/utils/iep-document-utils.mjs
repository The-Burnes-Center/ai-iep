/**
 * Shared utilities for IEP document operations (ES Modules version)
 */
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const s3 = new S3Client({ region: 'us-east-1' });

/**
 * Delete all IEP-related data for a specific child
 * This includes:
 * 1. S3 files (actual IEP documents)
 * 2. Records in IEP documents table
 * 3. IEP references in the user's profile
 * 
 * @param {string} userId - The user ID
 * @param {string} childId - The child ID
 * @param {string} bucketName - The S3 bucket name
 * @param {string} iepDocumentsTableName - The IEP documents table name
 * @param {string} userProfilesTableName - The user profiles table name
 * @returns {Promise<Object>} - Result object with deletion counts
 */
export const deleteIepDocumentsForChild = async (userId, childId, bucketName, iepDocumentsTableName, userProfilesTableName) => {
  const result = {
    s3ObjectsDeleted: 0,
    documentsDeleted: 0,
    profileUpdated: false
  };

  // 1. Delete files from S3
  try {
    // Create the S3 key prefix for this child (all objects under userId/childId/)
    const prefix = `${userId}/${childId}/`;
    
    console.log(`Listing S3 objects with prefix: ${prefix} in bucket: ${bucketName}`);
    
    // List all objects with this prefix
    const listParams = {
      Bucket: bucketName,
      Prefix: prefix
    };
    
    const listedObjects = await s3.send(new ListObjectsV2Command(listParams));
    
    if (listedObjects.Contents && listedObjects.Contents.length > 0) {
      console.log(`Found ${listedObjects.Contents.length} S3 objects to delete for childId: ${childId}`);
      
      // Delete each object individually
      for (const object of listedObjects.Contents) {
        await s3.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: object.Key
        }));
        console.log(`Deleted S3 object: ${object.Key}`);
        result.s3ObjectsDeleted++;
      }
    } else {
      console.log(`No S3 objects found with prefix: ${prefix}`);
    }
    
  } catch (s3Error) {
    console.error('Error deleting S3 objects:', s3Error);
    // Continue with other deletions even if S3 deletion fails
  }
  
  // 2. Delete records from IEP documents table
  try {
    // Query documents by childId
    const response = await ddb.send(new QueryCommand({
      TableName: iepDocumentsTableName,
      IndexName: 'byChildId',
      KeyConditionExpression: 'childId = :childId',
      ExpressionAttributeValues: {':childId': childId}
    }));
    
    // Delete each document record that belongs to this user
    for (const doc of response.Items || []) {
      if (!doc.userId || doc.userId === userId) {
        await ddb.send(new DeleteCommand({
          TableName: iepDocumentsTableName,
          Key: {
            iepId: doc.iepId,
            childId: doc.childId
          }
        }));
        console.log(`Deleted IEP document record with iepId: ${doc.iepId} for childId: ${childId}`);
        result.documentsDeleted++;
      }
    }
    
  } catch (ddbError) {
    console.error('Error deleting document records:', ddbError);
    // Continue with profile update even if document deletion fails
  }
  
  // 3. Update the user profile to remove any IEP document references for this child
  try {
    // First get the current user profile
    const userProfileResponse = await ddb.send(new QueryCommand({
      TableName: userProfilesTableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {':userId': userId}
    }));
    
    if (userProfileResponse.Items && userProfileResponse.Items.length > 0) {
      const userProfile = userProfileResponse.Items[0];
      let updated = false;
      
      // Check if there are children in the profile
      if (userProfile.children && Array.isArray(userProfile.children)) {
        const children = userProfile.children;
        
        // Find the child and remove any IEP document references
        for (let i = 0; i < children.length; i++) {
          if (children[i].childId === childId) {
            // Remove any IEP document data if present
            if (children[i].iepDocument) {
              delete children[i].iepDocument;
              updated = true;
              console.log(`Removed IEP document reference from child ${childId} in user profile`);
            }
          }
        }
        
        // Update the profile if changes were made
        if (updated) {
          const now = new Date();
          const timestamp = Math.floor(now.getTime());
          const datetimeISO = now.toISOString();
          
          await ddb.send(new UpdateCommand({
            TableName: userProfilesTableName,
            Key: {userId: userId},
            UpdateExpression: 'SET #children = :children, updatedAt = :updatedAt, updatedAtISO = :updatedAtISO',
            ExpressionAttributeNames: {'#children': 'children'},
            ExpressionAttributeValues: {
              ':children': children,
              ':updatedAt': timestamp,
              ':updatedAtISO': datetimeISO
            }
          }));
          console.log(`Updated user profile to remove IEP document references`);
          result.profileUpdated = true;
        }
      }
    }
    
  } catch (profileError) {
    console.error('Error updating user profile:', profileError);
    // Continue even if profile update fails
  }
  
  return result;
}; 