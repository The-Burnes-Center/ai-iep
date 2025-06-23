/**
 * Create Auth Challenge Lambda Trigger for Phone OTP Authentication
 * This function generates a random OTP and sends it via SMS using AWS SNS
 */

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

// Initialize SNS client
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
    console.log('Create Auth Challenge Event:', JSON.stringify(event, null, 2));
    
    let secretLoginCode;
    const phoneNumber = event.request.userAttributes.phone_number;
    
    if (!phoneNumber) {
        throw new Error('Phone number not found in user attributes');
    }
    
    // Check if this is a new session or retry
    if (!event.request.session || event.request.session.length === 0) {
        // New session - generate new OTP
        secretLoginCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        console.log('Generated new OTP for phone:', phoneNumber);
        
        try {
            // Send SMS via SNS
            await sendSMS(phoneNumber, secretLoginCode);
            console.log('SMS sent successfully');
        } catch (error) {
            console.error('Failed to send SMS:', error);
            throw new Error('Failed to send verification code');
        }
    } else {
        // Existing session - reuse the same OTP to allow retries
        const previousChallenge = event.request.session[event.request.session.length - 1];
        if (previousChallenge.challengeMetadata) {
            const match = previousChallenge.challengeMetadata.match(/CODE-(\d+)/);
            if (match) {
                secretLoginCode = match[1];
                console.log('Reusing existing OTP for retry');
            }
        }
        
        // If we couldn't extract the previous code, generate a new one
        if (!secretLoginCode) {
            secretLoginCode = Math.floor(100000 + Math.random() * 900000).toString();
            await sendSMS(phoneNumber, secretLoginCode);
        }
    }
    
    // Set challenge parameters
    event.response.publicChallengeParameters = {
        phone_number: phoneNumber
    };
    
    event.response.privateChallengeParameters = {
        secretLoginCode: secretLoginCode
    };
    
    // Store the code in metadata for potential retry
    event.response.challengeMetadata = `CODE-${secretLoginCode}`;
    
    console.log('Create Auth Challenge Response:', JSON.stringify({
        publicChallengeParameters: event.response.publicChallengeParameters,
        challengeMetadata: event.response.challengeMetadata
    }, null, 2));
    
    return event;
};

/**
 * Send SMS using AWS SNS
 */
async function sendSMS(phoneNumber, otpCode) {
    const message = `Your login code for The GovLab AIEP is: ${otpCode}. Do not share this code. Msg & data rates may apply.`;
    
    const publishParams = {
        Message: message,
        PhoneNumber: phoneNumber,
        MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
                DataType: 'String',
                StringValue: 'GovLab-AIEP'
            },
            'AWS.SNS.SMS.SMSType': {
                DataType: 'String',
                StringValue: 'Transactional'
            }
        }
    };
    
    const command = new PublishCommand(publishParams);
    return await snsClient.send(command);
} 