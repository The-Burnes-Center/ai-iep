/**
 * Define Auth Challenge Lambda Trigger for Phone OTP Authentication
 * This function determines which challenges should be presented to the user
 * and when to issue tokens or fail authentication.
 */

exports.handler = async (event) => {
    console.log('Define Auth Challenge Event:', JSON.stringify(event, null, 2));
    
    const { session } = event.request;
    
    // If no session exists, this is the first challenge - present custom challenge
    if (!session || session.length === 0) {
        console.log('First challenge - presenting CUSTOM_CHALLENGE');
        event.response.challengeName = 'CUSTOM_CHALLENGE';
        event.response.issueTokens = false;
        event.response.failAuthentication = false;
    } 
    // Check if user has successfully completed the challenge
    else if (session.length > 0 && session[session.length - 1].challengeResult === true) {
        console.log('Challenge completed successfully - issuing tokens');
        event.response.issueTokens = true;
        event.response.failAuthentication = false;
    }
    // Check if user has failed too many attempts (limit to 3 attempts)
    else if (session.length >= 3 && session[session.length - 1].challengeResult === false) {
        console.log('Too many failed attempts - failing authentication');
        event.response.issueTokens = false;
        event.response.failAuthentication = true;
    }
    // User provided wrong answer but hasn't exceeded attempt limit
    else {
        console.log('Wrong answer provided - presenting another challenge');
        event.response.challengeName = 'CUSTOM_CHALLENGE';
        event.response.issueTokens = false;
        event.response.failAuthentication = false;
    }
    
    console.log('Define Auth Challenge Response:', JSON.stringify(event.response, null, 2));
    return event;
}; 