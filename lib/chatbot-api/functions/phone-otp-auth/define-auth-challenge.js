/**
 * Define Auth Challenge Lambda Trigger for Phone OTP Authentication
 * This function determines which challenges should be presented to the user
 * and when to issue tokens or fail authentication.
 * 
 * Based on AWS Cognito Custom Authentication Challenge best practices:
 * - Limit retry attempts to prevent abuse
 * - Provide clear authentication flow logic
 * - Handle edge cases properly
 */

exports.handler = async (event) => {
    console.log('Define Auth Challenge Event:', JSON.stringify(event, null, 2));
    
    const { session, triggerSource } = event.request;
    const userName = event.userName;
    
    try {
        // If no session exists or empty session, this is the first challenge
        if (!session || session.length === 0) {
            console.log(`First authentication attempt for user: ${userName}`);
            event.response.challengeName = 'CUSTOM_CHALLENGE';
            event.response.issueTokens = false;
            event.response.failAuthentication = false;
        } 
        // Check if user has successfully completed the most recent challenge
        else if (session.length > 0) {
            const lastChallenge = session[session.length - 1];
            
            if (lastChallenge.challengeResult === true) {
                console.log(`Authentication successful for user: ${userName}`);
                event.response.issueTokens = true;
                event.response.failAuthentication = false;
            }
            // Check if user has exceeded maximum attempts (AWS recommends 3 attempts)
            else if (session.length >= 3) {
                console.log(`Maximum attempts exceeded for user: ${userName}. Failing authentication.`);
                event.response.issueTokens = false;
                event.response.failAuthentication = true;
            }
            // User provided wrong answer but hasn't exceeded attempt limit
            else {
                console.log(`Authentication attempt ${session.length + 1} for user: ${userName}`);
                event.response.challengeName = 'CUSTOM_CHALLENGE';
                event.response.issueTokens = false;
                event.response.failAuthentication = false;
            }
        }
        
        console.log('Define Auth Challenge Response:', JSON.stringify(event.response, null, 2));
        
    } catch (error) {
        console.error('Error in Define Auth Challenge:', error);
        // On error, fail the authentication to prevent security issues
        event.response.issueTokens = false;
        event.response.failAuthentication = true;
    }
    
    return event;
}; 