/**
 * Verify Auth Challenge Response Lambda Trigger for Phone OTP Authentication
 * This function validates the OTP code entered by the user against the generated code
 * and creates a user profile if authentication succeeds for the first time
 * 
 * Based on AWS Cognito Custom Authentication Challenge best practices:
 * - Secure OTP validation with timing attack protection
 * - Proper error handling and logging
 * - User profile creation for new phone-based users
 * - Session management and security
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

// Initialize DynamoDB client
const dynamodbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamodbClient);

// Configuration constants
const OTP_EXPIRY_MINUTES = 5;

exports.handler = async (event) => {
    console.log('Verify Auth Challenge Event:', JSON.stringify(event, null, 2));
    
    const expectedAnswer = event.request.privateChallengeParameters.secretLoginCode;
    const challengeAnswer = event.request.challengeAnswer;
    const userId = event.userName;
    const session = event.request.session || [];
    
    try {
        console.log(`Verifying OTP for user: ${userId}`);
        
        // Handle error cases from create challenge
        if (expectedAnswer === 'ERROR') {
            console.error('Previous challenge had an error, failing verification');
            event.response.answerCorrect = false;
            return event;
        }
        
        // Validate inputs
        if (!challengeAnswer || !expectedAnswer) {
            console.error('Missing challenge answer or expected answer');
            event.response.answerCorrect = false;
            return event;
        }
        
        // Check if OTP has expired based on challenge metadata
        if (session.length > 0) {
            const lastChallenge = session[session.length - 1];
            if (lastChallenge.challengeMetadata) {
                try {
                    const metadata = JSON.parse(lastChallenge.challengeMetadata);
                    const timeDiff = new Date() - new Date(metadata.timestamp);
                    
                    if (timeDiff > OTP_EXPIRY_MINUTES * 60 * 1000) {
                        console.error(`OTP expired for user: ${userId}`);
                        event.response.answerCorrect = false;
                        return event;
                    }
                } catch (parseError) {
                    console.warn('Could not parse challenge metadata for expiry check');
                }
            }
        }
        
        // Validate the OTP using timing-safe comparison
        const isValid = secureCompare(challengeAnswer.trim(), expectedAnswer.trim());
        
        if (isValid) {
            console.log(`OTP verification successful for user: ${userId}`);
            event.response.answerCorrect = true;
            
            // Create user profile if this is the first successful authentication
            try {
                await createUserProfileIfNotExists(userId);
            } catch (error) {
                console.error('Error creating user profile:', error);
                // Don't fail authentication if profile creation fails
                // The user can still sign in and profile can be created later
            }
        } else {
            console.log(`OTP verification failed for user: ${userId}`);
            event.response.answerCorrect = false;
        }
        
    } catch (error) {
        console.error('Error in Verify Auth Challenge:', error);
        // On any error, fail the verification for security
        event.response.answerCorrect = false;
    }
    
    console.log('Verify Auth Challenge Response:', JSON.stringify(event.response, null, 2));
    return event;
};

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function secureCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
}

/**
 * Create a user profile if one doesn't already exist
 * This function is called after successful phone OTP verification
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
        const currentDateTime = new Date().toISOString();
        
        // Create default child for IEP document functionality
        const defaultChild = {
            childId: randomUUID(),
            name: 'My Child',
            schoolCity: 'Not specified',
            createdAt: currentTime,
            updatedAt: currentTime
        };
        
        // Create default profile for phone-based user
        const newProfile = {
            userId: userId,
            createdAt: currentTime,
            updatedAt: currentTime,
            updatedAtISO: currentDateTime,
            children: [defaultChild],  // Initialize with default child
            consentGiven: false,  // Default consent to false
            authMethod: 'phone',  // Track authentication method
            phoneVerified: true   // Phone is verified through OTP process
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