/**
 * Verify Auth Challenge Response Lambda Trigger for Phone OTP Authentication
 * This function validates the OTP code entered by the user against the generated code
 */

exports.handler = async (event) => {
    console.log('Verify Auth Challenge Event:', JSON.stringify(event, null, 2));
    
    const expectedAnswer = event.request.privateChallengeParameters.secretLoginCode;
    const challengeAnswer = event.request.challengeAnswer;
    
    console.log('Expected OTP:', expectedAnswer);
    console.log('Provided OTP:', challengeAnswer);
    
    // Validate the OTP
    if (challengeAnswer && expectedAnswer && challengeAnswer.trim() === expectedAnswer.trim()) {
        console.log('OTP verification successful');
        event.response.answerCorrect = true;
    } else {
        console.log('OTP verification failed');
        event.response.answerCorrect = false;
    }
    
    console.log('Verify Auth Challenge Response:', JSON.stringify(event.response, null, 2));
    return event;
}; 