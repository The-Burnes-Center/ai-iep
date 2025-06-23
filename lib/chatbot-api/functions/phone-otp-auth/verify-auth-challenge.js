/**
 * Verify Auth Challenge Response Lambda Trigger for Phone OTP Authentication
 * This function validates the OTP code entered by the user against the generated code
 * and creates a user profile if authentication succeeds for the first time
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

// Initialize DynamoDB client
const dynamodbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamodbClient);

/**
 * Generate a unique child ID
 */
function generateChildId() {
    return randomUUID();
}

exports.handler = async (event) => {
    console.log('Verify Auth Challenge Event:', JSON.stringify(event, null, 2));
    
    const expectedAnswer = event.request.privateChallengeParameters.secretLoginCode;
    const challengeAnswer = event.request.challengeAnswer;
    const userId = event.userName;
    
    console.log('Expected OTP:', expectedAnswer);
    console.log('Provided OTP:', challengeAnswer);
    console.log('User ID:', userId);
    
    // Validate the OTP
    if (challengeAnswer && expectedAnswer && challengeAnswer.trim() === expectedAnswer.trim()) {
        console.log('OTP verification successful');
        event.response.answerCorrect = true;
        
        // Create user profile if this is the first successful authentication
        try {
            await createUserProfileIfNotExists(userId);
        } catch (error) {
            console.error('Error creating user profile:', error);
            // Don't fail authentication if profile creation fails
        }
    } else {
        console.log('OTP verification failed');
        event.response.answerCorrect = false;
    }
    
    console.log('Verify Auth Challenge Response:', JSON.stringify(event.response, null, 2));
    return event;
};

/**
 * Create a user profile if one doesn't already exist
 */
async function createUserProfileIfNotExists(userId) {
    const userProfilesTable = process.env.USER_PROFILES_TABLE;
    
    if (!userProfilesTable) {
        console.log('USER_PROFILES_TABLE environment variable not set');
        return;
    }
    
    try {
        // Check if profile already exists
        const getCommand = new GetCommand({
            TableName: userProfilesTable,
            Key: { userId: userId }
        });
        
        const existingProfile = await docClient.send(getCommand);
        
        if (existingProfile.Item) {
            console.log(`Profile already exists for user ${userId}, skipping creation`);
            return;
        }
        
        // Create timestamp
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Create default child for IEP document functionality
        const defaultChild = {
            childId: generateChildId(),
            name: 'My Child',
            schoolCity: 'Not specified',
            createdAt: currentTime,
            updatedAt: currentTime
        };
        
        // Create default profile
        const newProfile = {
            userId: userId,
            createdAt: currentTime,
            updatedAt: currentTime,
            children: [defaultChild],  // Initialize with default child
            consentGiven: false  // Add new field with default value of false
        };
        
        // Use put_item with condition to prevent overwriting
        const putCommand = new PutCommand({
            TableName: userProfilesTable,
            Item: newProfile,
            ConditionExpression: 'attribute_not_exists(userId)'
        });
        
        await docClient.send(putCommand);
        console.log(`Created default profile for phone user ${userId}`);
        
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            console.log(`Profile already exists for user ${userId}, no action needed`);
        } else {
            console.error(`Error creating user profile for ${userId}:`, error);
            throw error;
        }
    }
} 