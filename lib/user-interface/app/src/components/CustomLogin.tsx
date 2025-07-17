import React, { useState } from 'react';
import { Auth } from 'aws-amplify';
import { 
  Container, 
  Row, 
  Col, 
  Form, 
  Button, 
  Alert, 
  Spinner,
  InputGroup,
  Dropdown
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './CustomLogin.css'; // Import the custom CSS file
import { useLanguage, SupportedLanguage } from '../common/language-context';

interface CustomLoginProps {
  onLoginSuccess: () => void;
}

const CustomLogin: React.FC<CustomLoginProps> = ({ onLoginSuccess }) => {
  // Get translation function and language setter from context
  const { t, language, setLanguage } = useLanguage();
  
  // Existing state variables
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [cognitoUser, setCognitoUser] = useState<any>(null);
  
  // Sign up state variables
  const [showSignUp, setShowSignUp] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSignUpComplete, setIsSignUpComplete] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Mobile login state variables
  const [phoneNumber, setPhoneNumber] = useState('+1 ');
  const [showMobileLogin, setShowMobileLogin] = useState(true);  
  const [mobileLoading, setMobileLoading] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [smsCodeSent, setSmsCodeSent] = useState(false);
  const [cognitoUserForSms, setCognitoUserForSms] = useState<any>(null);
  const [isNewUserConfirmation, setIsNewUserConfirmation] = useState(false); // Track if this is signup confirmation
  const [pendingPhoneNumber, setPendingPhoneNumber] = useState<string | null>(null);
  const [isNewUserSignup, setIsNewUserSignup] = useState(false); // Track if this is a brand new user signup // Store phone for confirmation flow
  
  // State for toggling password visibility
  const [showMainPassword, setShowMainPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);

  // Language options with labels
  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'zh', label: '中文' },
    { value: 'vi', label: 'Tiếng Việt' }
  ];

  // Handle language change
  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
  };

  // Handle successful authentication
  const handleSuccessfulAuthentication = () => {
    console.log('User authentication successful');
    // Authentication is handled, onboarding decisions will be made based on profile.showOnboarding
    onLoginSuccess();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    // Convert email to lowercase
    const normalizedUsername = username.toLowerCase();
    
    try {
      const user = await Auth.signIn(normalizedUsername, password);
      console.log('Login successful', user);
      
      // Check for NEW_PASSWORD_REQUIRED challenge
      if (user.challengeName === 'NEW_PASSWORD_REQUIRED') {
        console.log('New password required');
        setPasswordChangeRequired(true);
        setCognitoUser(user);
        setLoading(false);
        return;
      }
      
      // If no challenge, proceed with normal login
      onLoginSuccess();
    } catch (err) {
      console.error('Login error', err);
      if (err.code === 'UserNotConfirmedException') {
        setError(t('auth.errorUserNotConfirmed'));
      } else if (err.code === 'NotAuthorizedException') {
        setError(t('auth.errorIncorrectCredentials'));
      } else if (err.code === 'UserNotFoundException') {
        setError(t('auth.errorUserNotFound'));
      } else {
        setError(err.message || t('auth.errorGeneric'));
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clean Phone Authentication Flow (Frontend Only)
   * Handles both signup confirmation and custom auth properly
   */
  const handleMobileLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setError(t('auth.pleaseEnterPhoneNumber') || 'Please enter your phone number');
      return;
    }

    setMobileLoading(true);
    setError('');
    setSuccessMessage(null);

    // Extract only digits and format properly to E.164
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      setMobileLoading(false);
      return;
    }
    
    // Format as +1XXXXXXXXXX (E.164 format for US numbers)
    const formattedPhone = `+1${digits.slice(-10)}`;

    try {
      console.log('Starting phone authentication for:', formattedPhone);
      console.log('Current auth state - smsCodeSent:', smsCodeSent, 'isNewUserConfirmation:', isNewUserConfirmation);
      
      // Try custom auth first (for existing users)
      let cognitoUser;
      try {
        cognitoUser = await Auth.signIn(formattedPhone);
        console.log('Existing user found, custom auth initiated');
        console.log('SignIn result:', { challengeName: cognitoUser.challengeName, username: cognitoUser.username });
        
        // Handle the authentication response for existing users
        if (cognitoUser.challengeName === 'CUSTOM_CHALLENGE') {
          setCognitoUserForSms(cognitoUser);
          setSmsCodeSent(true);
          setIsNewUserConfirmation(false);
          setSuccessMessage(t('auth.smsCodeSent') || 'Verification code sent to your phone!');
          console.log('SMS code sent for existing user');
        } else {
          console.log('User authenticated successfully');
          onLoginSuccess();
        }
        
      } catch (signInError: any) {
        console.log('SignIn error:', signInError.code);
        
        if (signInError.code === 'UserNotFoundException') {
          // User doesn't exist, create them first
          console.log('Creating new user for phone:', formattedPhone);
          
          // Generate a secure random password
          const tempPassword = 'TempPass123!' + Math.random().toString(36).substring(2, 15);
          
          try {
            const signUpResult = await Auth.signUp({
              username: formattedPhone,
              password: tempPassword,
              attributes: {
                phone_number: formattedPhone
              }
            });
            
            console.log('New user created:', signUpResult);
            
            // Set up for confirmation flow
            setIsNewUserConfirmation(true);
            setPendingPhoneNumber(formattedPhone);
            setIsNewUserSignup(true); // Mark as new user signup
            setSmsCodeSent(true);
            setSuccessMessage('Account created! Please enter the verification code sent to your phone.');
            
          } catch (signUpError: any) {
            console.error('SignUp error:', signUpError);
            if (signUpError.code === 'UsernameExistsException') {
              // User was created between our attempts, try signin again
              cognitoUser = await Auth.signIn(formattedPhone);
              
              if (cognitoUser.challengeName === 'CUSTOM_CHALLENGE') {
                setCognitoUserForSms(cognitoUser);
                setSmsCodeSent(true);
                setIsNewUserConfirmation(false);
                setSuccessMessage(t('auth.smsCodeSent') || 'Verification code sent to your phone!');
              } else {
                onLoginSuccess();
              }
            } else {
              throw signUpError;
            }
          }
        } else if (signInError.code === 'UserNotConfirmedException') {
          // User exists but not confirmed - treat as new user confirmation
          console.log('User exists but not confirmed, setting up confirmation flow');
          
          // Try to resend confirmation code for existing unconfirmed user
          try {
            await Auth.resendSignUp(formattedPhone);
            console.log('Resent confirmation code for existing user');
          } catch (resendError: any) {
            console.log('Could not resend confirmation code:', resendError.code);
            // Continue anyway - user might still have valid code
          }
          
          setIsNewUserConfirmation(true);
          setPendingPhoneNumber(formattedPhone);
          setSmsCodeSent(true);
          setSuccessMessage('Please enter the verification code sent to your phone to confirm your account.');
        } else {
          throw signInError;
        }
      }
      
    } catch (error: any) {
      console.error('Phone authentication error:', error);
      
      // Handle specific error cases
      if (error.code === 'NotAuthorizedException') {
        setError('Authentication failed. Please try again.');
      } else if (error.code === 'InvalidParameterException') {
        setError('Invalid phone number format. Please use a valid US phone number.');
      } else if (error.code === 'LimitExceededException') {
        setError(t('auth.tooManyAttempts') || 'Too many attempts. Please wait before trying again.');
      } else {
        setError(error.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setMobileLoading(false);
    }
  };

  /**
   * Handle SMS Code Verification (Frontend Only)
   * Handles both signup confirmation and custom auth challenges
   */
  const handleSmsCodeVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsCode.trim() || smsCode.length !== 6) {
      setError(t('auth.pleaseEnterSmsCode') || 'Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage(null);

    try {
      console.log('Verifying SMS code:', smsCode);
      console.log('Is new user confirmation:', isNewUserConfirmation);
      console.log('Pending phone number:', pendingPhoneNumber);
      console.log('Cognito user for SMS:', cognitoUserForSms ? 'Present' : 'Null');
      
      if (isNewUserConfirmation) {
        // This is a signup confirmation
        if (!pendingPhoneNumber) {
          setError('Session expired. Please start over.');
          setSmsCodeSent(false);
          setLoading(false);
          return;
        }
        
        console.log('Confirming signup for:', pendingPhoneNumber);
        
        // Confirm the signup
        await Auth.confirmSignUp(pendingPhoneNumber, smsCode);
        console.log('Signup confirmed successfully');
        
        // Now initiate custom auth for the confirmed user
        console.log('Starting custom auth after confirmation');
        
        try {
          const cognitoUser = await Auth.signIn(pendingPhoneNumber);
          
          if (cognitoUser.challengeName === 'CUSTOM_CHALLENGE') {
            // Switch to custom auth mode
            setCognitoUserForSms(cognitoUser);
            setIsNewUserConfirmation(false);
            setPendingPhoneNumber(null);
            setSmsCode(''); // Clear the confirmation code
            setSuccessMessage(t('auth.accountConfirmedNewCode') || 'Great! You\'re confirmed. We will send you another code now so you can login for the first time.');
            console.log('Custom auth initiated after confirmation');
          } else if (cognitoUser.signInUserSession) {
            // User is fully authenticated (shouldn't happen with CUSTOM_AUTH but handle gracefully)
            console.log('User authenticated successfully after confirmation');
            setSuccessMessage('Account confirmed and signed in successfully!');
            setTimeout(() => {
              handleSuccessfulAuthentication();
            }, 1000);
          } else {
            console.error('Unexpected auth state after confirmation:', cognitoUser);
            setError('Authentication error after confirmation. Please try signing in again.');
            // Reset to phone input
            setSmsCodeSent(false);
            setIsNewUserConfirmation(false);
            setPendingPhoneNumber(null);
            setSmsCode('');
          }
        } catch (postConfirmError: any) {
          console.error('Error starting custom auth after confirmation:', postConfirmError);
          if (postConfirmError.code === 'UserNotConfirmedException') {
            setError('Account confirmation failed. Please try the process again.');
          } else {
            setError('Authentication error after confirmation. Please try again.');
          }
          // Reset to phone input
          setSmsCodeSent(false);
          setIsNewUserConfirmation(false);
          setPendingPhoneNumber(null);
          setSmsCode('');
          setIsNewUserSignup(false);
        }
        
      } else {
        // This is a custom auth challenge
        if (!cognitoUserForSms) {
          setError('Session expired. Please start over.');
          setSmsCodeSent(false);
          setLoading(false);
          return;
        }
        
        console.log('Verifying custom auth challenge');
        
        // Send the challenge response
        const result = await Auth.sendCustomChallengeAnswer(cognitoUserForSms, smsCode);
        
        console.log('Challenge response result:', result);
        
        // Check if authentication is complete
        if (result.signInUserSession) {
          console.log('Authentication successful!');
          setSuccessMessage('Phone verification successful!');
          
          // Small delay to show success message, then redirect
          setTimeout(() => {
            handleSuccessfulAuthentication();
          }, 1000);
          
        } else if (result.challengeName) {
          // Still have challenges to complete
          console.log('Additional challenge required:', result.challengeName);
          setCognitoUserForSms(result);
          setError('Additional verification required. Please try again.');
          
        } else {
          // Unexpected state
          console.error('Unexpected auth state:', result);
          setError('Authentication incomplete. Please try again.');
        }
      }
      
    } catch (error: any) {
      console.error('SMS verification error:', error);
      
      // Handle specific error cases
      if (error.code === 'NotAuthorizedException' || error.message?.includes('Incorrect')) {
        setError(t('auth.invalidSmsCode') || 'Invalid verification code. Please try again.');
      } else if (error.code === 'CodeMismatchException') {
        setError(t('auth.invalidSmsCode') || 'Invalid verification code. Please try again.');
      } else if (error.code === 'ExpiredCodeException') {
        setError(t('auth.expiredSmsCode') || 'Verification code expired. Please request a new one.');
      } else if (error.code === 'LimitExceededException') {
        setError(t('auth.tooManyAttempts') || 'Too many attempts. Please try again later.');
      } else {
        setError(error.message || 'Verification failed. Please try again.');
      }
      
      // Clear the SMS code on error
      setSmsCode('');
      
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resend SMS Code (Frontend Only)
   * Handles both signup confirmation resend and custom auth resend
   */
  const handleResendSmsCode = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage(null);

    try {
      console.log('Resending SMS code');
      console.log('Is new user confirmation:', isNewUserConfirmation);
      
      if (isNewUserConfirmation) {
        // Resend signup confirmation code
        if (!pendingPhoneNumber) {
          setError('Session expired. Please start over.');
          setSmsCodeSent(false);
          setLoading(false);
          return;
        }
        
        console.log('Resending signup confirmation for:', pendingPhoneNumber);
        await Auth.resendSignUp(pendingPhoneNumber);
        setSuccessMessage('New verification code sent to your phone!');
        setSmsCode(''); // Clear previous code
        
      } else {
        // Resend custom auth challenge
        if (!cognitoUserForSms) {
          setError('Session expired. Please start over.');
          setSmsCodeSent(false);
          setLoading(false);
          return;
        }
        
        console.log('Resending custom auth challenge');
        
        // For custom auth, we need to re-initiate the auth flow to get a new challenge
        // Instead of using sendCustomChallengeAnswer with 'RESEND', we restart the flow
        try {
          const phoneNumber = cognitoUserForSms.username || cognitoUserForSms.challengeParam?.USERNAME;
          if (!phoneNumber) {
            setError('Session expired. Please start over.');
            setSmsCodeSent(false);
            setLoading(false);
            return;
          }
          
          const result = await Auth.signIn(phoneNumber);
          
          if (result.challengeName === 'CUSTOM_CHALLENGE') {
            setCognitoUserForSms(result);
            setSuccessMessage(t('auth.smsCodeResent') || 'New verification code sent to your phone!');
            setSmsCode(''); // Clear previous code
          } else {
            setError('Failed to resend code. Please try again.');
          }
        } catch (resendError: any) {
          console.error('Resend custom auth error:', resendError);
          setError('Failed to resend code. Please try again.');
        }
      }
      
    } catch (error: any) {
      console.error('Resend SMS error:', error);
      setError(error.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError(t('auth.errorPasswordsNotMatch'));
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Complete the new password challenge
      const user = await Auth.completeNewPassword(
        cognitoUser,   // the Cognito User object
        newPassword    // the new password
      );
      
      console.log('Password change successful', user);
      onLoginSuccess();
    } catch (err) {
      console.error('Password change error', err);
      setError(err.message || t('auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await Auth.forgotPassword(resetEmail.toLowerCase());
      setResetSent(true);
      setSuccessMessage(t('auth.resetCodeSent'));
    } catch (err) {
      console.error('Forgot password error', err);
      setError(err.message || t('auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError(t('auth.errorPasswordsNotMatch'));
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await Auth.forgotPasswordSubmit(resetEmail.toLowerCase(), resetCode, newPassword);
      setSuccessMessage(t('auth.passwordResetSuccess'));
      setShowForgotPassword(false);
      setResetSent(false);
      setResetCode('');
      setResetEmail('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Reset password error', err);
      setError(err.message || t('auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signUpPassword !== signUpConfirmPassword) {
      setError(t('auth.errorPasswordsNotMatch'));
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { user } = await Auth.signUp({
        username: signUpEmail.toLowerCase(),
        password: signUpPassword,
        attributes: {
          email: signUpEmail.toLowerCase()
        }
      });
      
      console.log('Sign up successful', user);
      setIsSignUpComplete(true);
      setSuccessMessage(t('auth.signUpSuccess'));
    } catch (err) {
      console.error('Sign up error', err);
      if (err.code === 'UsernameExistsException') {
        setError(t('auth.errorUserExists'));
      } else {
        setError(err.message || t('auth.errorGeneric'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await Auth.confirmSignUp(signUpEmail.toLowerCase(), verificationCode);
      setSuccessMessage(t('auth.emailVerified'));
      setShowSignUp(false);
      setIsSignUpComplete(false);
      setSignUpEmail('');
      setSignUpPassword('');
      setSignUpConfirmPassword('');
      setVerificationCode('');
    } catch (err) {
      console.error('Confirm sign up error', err);
      setError(err.message || t('auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Auth.resendSignUp(signUpEmail.toLowerCase());
      setSuccessMessage(t('auth.verificationCodeResent'));
    } catch (err) {
      console.error('Resend confirmation error', err);
      setError(err.message || t('auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  // Show password change form if required
  if (passwordChangeRequired) {
    return (
      <Container fluid className="login-container vh-100 d-flex align-items-center justify-content-center">
        <Col xs={12} sm={8} md={6} lg={4}>
          <div className="text-center mb-4">
            <img src="/images/AIEP_Logo.png" alt="AIEP Logo" className="aiep-logo mb-3" />
            <h4>{t('auth.changePassword')}</h4>
          </div>
          
          <Form onSubmit={handleCompleteNewPassword}>
            <Form.Group className="mb-3">
              <Form.Label className="form-label-bold">{t('auth.newPassword')}</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showNewPassword ? "text" : "password"}
                  placeholder={t('auth.enterNewPassword')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Button 
                  variant="outline-secondary"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  <i className={`bi ${showNewPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                </Button>
              </InputGroup>
            </Form.Group>
            
            {/* Password requirements container */}
            <Container className="mt-3 mb-3 p-3 border rounded bg-light">
              <Form.Text className="text-muted">
                {t('auth.passwordRequirements')}
                <ul>
                  <li>{t('auth.passwordRequirement1')}</li>
                  <li>{t('auth.passwordRequirement2')}</li>
                </ul>
              </Form.Text>
            </Container>
            
            <Form.Group className="mb-3">
              <Form.Label className="form-label-bold">{t('auth.passwordConfirm')}</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t('auth.passwordConfirm')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <Button 
                  variant="outline-secondary"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <i className={`bi ${showConfirmPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                </Button>
              </InputGroup>
            </Form.Group>

            {error && <Alert variant="danger">{error}</Alert>}
            
            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={loading} className="button-text">
                {loading ? <Spinner animation="border" size="sm" /> : t('auth.changePassword')}
              </Button>
            </div>
          </Form>
        </Col>
      </Container>
    );
  }

  // Show forgot password form
  if (showForgotPassword) {
    return (
      <Container fluid className="login-container vh-100 d-flex align-items-center justify-content-center">
        <Col xs={12} sm={8} md={6} lg={4}>
          <div className="text-center mb-4">
            <img src="/images/AIEP_Logo.png" alt="AIEP Logo" className="aiep-logo mb-3" />
            <h4>{t('auth.resetPassword')}</h4>
          </div>
          
          {!resetSent ? (
            <Form onSubmit={handleForgotPassword}>
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.email')}</Form.Label>
                <Form.Control
                  type="email"
                  placeholder={t('auth.enterEmail')}
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </Form.Group>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {successMessage && <Alert variant="success">{successMessage}</Alert>}
              
              <div className="d-grid gap-2">
                <Button variant="primary" type="submit" disabled={loading} className="button-text">
                  {loading ? <Spinner animation="border" size="sm" /> : t('auth.sendResetCode')}
                </Button>
                <Button 
                  variant="link" 
                  onClick={() => setShowForgotPassword(false)}
                  disabled={loading}
                  className="forgot-password-link"
                >
                  {t('auth.backToLogin')}
                </Button>
              </div>
            </Form>
          ) : (
            <Form onSubmit={handleResetPassword}>
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.resetCode')}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t('auth.enterResetCode')}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.newPassword')}</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showNewPassword ? "text" : "password"}
                    placeholder={t('auth.newPassword')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <Button 
                    variant="outline-secondary"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    <i className={`bi ${showNewPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                  </Button>
                </InputGroup>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.passwordConfirm')}</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={t('auth.passwordConfirm')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <Button 
                    variant="outline-secondary"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <i className={`bi ${showConfirmPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                  </Button>
                </InputGroup>
              </Form.Group>

              {error && <Alert variant="danger">{error}</Alert>}
              {successMessage && <Alert variant="success">{successMessage}</Alert>}

              <div className="d-grid gap-2">
                <Button variant="primary" type="submit" disabled={loading} className="button-text">
                  {loading ? <Spinner animation="border" size="sm" /> : t('auth.resetPassword')}
                </Button>
                <Button 
                  variant="link" 
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetSent(false);
                  }}
                  disabled={loading}
                  className="forgot-password-link"
                >
                  {t('auth.backToLogin')}
                </Button>
              </div>
            </Form>
          )}
        </Col>
      </Container>
    );
  }

  // Show sign up form
  if (showSignUp) {
    return (
      <Container fluid className="login-container vh-100 d-flex align-items-center justify-content-center">
        <Col xs={12} sm={8} md={6} lg={4}>
          <div className="text-center mb-4">
            <img src="/images/AIEP_Logo.png" alt="AIEP Logo" className="aiep-logo mb-3" />
            <h4>{isSignUpComplete ? t('auth.verifyEmail') : t('auth.signUp')}</h4>
          </div>
          
          {!isSignUpComplete ? (
            <Form onSubmit={handleSignUp}>
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.email')}</Form.Label>
                <Form.Control
                  type="email"
                  placeholder={t('auth.enterEmail')}
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.password')}</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showSignUpPassword ? "text" : "password"}
                    placeholder={t('auth.enterPassword')}
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
                  />
                  <Button 
                    variant="outline-secondary"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                  >
                    <i className={`bi ${showSignUpPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                  </Button>
                </InputGroup>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.passwordConfirm')}</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showSignUpConfirmPassword ? "text" : "password"}
                    placeholder={t('auth.passwordConfirm')}
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    required
                  />
                  <Button 
                    variant="outline-secondary"
                    onClick={() => setShowSignUpConfirmPassword(!showSignUpConfirmPassword)}
                  >
                    <i className={`bi ${showSignUpConfirmPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                  </Button>
                </InputGroup>
              </Form.Group>
              
              {/* Password requirements container */}
              <Container className="mt-3 mb-3 p-3 border rounded bg-light">
                <Form.Text className="text-muted">
                  {t('auth.passwordRequirements')}
                  <ul>
                    <li>{t('auth.passwordRequirement1')}</li>
                    <li>{t('auth.passwordRequirement2')}</li>
                  </ul>
                </Form.Text>
              </Container>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {successMessage && <Alert variant="success">{successMessage}</Alert>}
              
              <div className="d-grid gap-2">
                <Button variant="primary" type="submit" disabled={loading} className="button-text">
                  {loading ? <Spinner animation="border" size="sm" /> : t('auth.signUp')}
                </Button>
                <Button 
                  variant="link" 
                  onClick={() => {
                    setShowSignUp(false);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  disabled={loading}
                  className="forgot-password-link"
                >
                  {t('auth.backToLogin')}
                </Button>
              </div>
            </Form>
          ) : (
            <Form onSubmit={handleConfirmSignUp}>
              <Alert variant="info">{t('auth.checkEmailForCode')}</Alert>
              
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.verificationCode')}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t('auth.enterVerificationCode')}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                />
              </Form.Group>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {successMessage && <Alert variant="success">{successMessage}</Alert>}
              
              <div className="d-grid gap-2">
                <Button variant="primary" type="submit" disabled={loading} className="button-text">
                  {loading ? <Spinner animation="border" size="sm" /> : t('auth.verify')}
                </Button>
                <Button 
                  variant="link"
                  onClick={handleResendConfirmation}
                  disabled={loading}
                  className="forgot-password-link"
                >
                  {t('auth.resendCode')}
                </Button>
                <Button 
                  variant="link" 
                  onClick={() => {
                    setShowSignUp(false);
                    setIsSignUpComplete(false);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  disabled={loading}
                  className="forgot-password-link"
                >
                  {t('auth.backToLogin')}
                </Button>
              </div>
            </Form>
          )}
        </Col>
      </Container>
    );
  }

  // Main login form with mobile login option
  return (
    <Container fluid className="login-container vh-100 d-flex align-items-center justify-content-center">
      <Col xs={12} sm={8} md={6} lg={4}>
        <div className="text-center mb-4">
          <img src="/images/AIEP_Logo.png" alt="AIEP Logo" className="aiep-logo mb-3" />
          <h4>{t('auth.signInHeader')}</h4>
        </div>

        {/* Language dropdown */}
        <div className="text-end mb-3">
          <Dropdown>
            <Dropdown.Toggle variant="outline-secondary" id="language-dropdown" size="sm">
              {languageOptions.find(opt => opt.value === language)?.label || 'Language'}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {languageOptions.map((option) => (
                <Dropdown.Item 
                  key={option.value}
                  onClick={() => handleLanguageChange(option.value as SupportedLanguage)}
                  active={language === option.value}
                >
                  {option.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>

        {/* Login method toggle buttons */}
        <div className="d-grid gap-2 mb-4">
          <div className="btn-group" role="group">
            <Button 
              variant={showMobileLogin ? "primary" : "outline-primary"}
              onClick={() => setShowMobileLogin(true)}
              className="button-text"
            >
              {t('auth.mobileLogin')}
            </Button>
            <Button 
              variant={!showMobileLogin ? "primary" : "outline-primary"}
              onClick={() => setShowMobileLogin(false)}
              className="button-text"
            >
              {t('auth.emailLogin')}
            </Button>
          </div>
        </div>
        
        {showMobileLogin ? (
          // Mobile Login Form
          smsCodeSent ? (
            // SMS Verification Form
            <Form onSubmit={handleSmsCodeVerification}>
              <div className="mobile-form-container">
                <div className="sms-verification-info">
                  <p>
                    {t('auth.smsCodeSentTo')}<br />
                    <span className="phone-display">{phoneNumber}</span>
                  </p>
                </div>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-bold">{t('auth.verificationCodeSms')}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={t('auth.enterSmsCode')}
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    className="sms-code-input"
                    autoFocus
                  />
                </Form.Group>
                {error && <Alert variant="danger">{error}</Alert>}
                {successMessage && <Alert variant="success">{successMessage}</Alert>}
                <div className="d-grid gap-2">
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading || smsCode.length !== 6} 
                    className="button-text"
                  >
                    {loading ? <Spinner animation="border" size="sm" /> : t('auth.verifySmsCode')}
                  </Button>
                  <Button 
                    variant="outline-secondary"
                    onClick={handleResendSmsCode}
                    disabled={loading}
                    className="button-text"
                  >
                    {loading ? <Spinner animation="border" size="sm" /> : t('auth.resendSmsCode')}
                  </Button>
                  <Button 
                    variant="link" 
                    onClick={() => {
                      setSmsCodeSent(false);
                      setCognitoUserForSms(null);
                      setSmsCode('');
                      setPhoneNumber('+1 ');
                      setError(null);
                      setSuccessMessage(null);
                      setIsNewUserConfirmation(false);
                      setPendingPhoneNumber(null);
                      setIsNewUserSignup(false);
                    }}
                    disabled={loading}
                    className="forgot-password-link"
                  >
                    {t('auth.backToLogin')}
                  </Button>
                </div>
              </div>
            </Form>
          ) : (
            // Phone Number Input Form
            <Form onSubmit={handleMobileLogin}>
              <div className="mobile-form-container">
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-bold">{t('auth.phoneNumber')}</Form.Label>
                  <Form.Control
                    type="tel"
                    placeholder="(xxx) xxx-xxxx"
                    value={phoneNumber}
                    onChange={(e) => {
                      const input = e.target.value;
                      
                      // If input is shorter than "+1 ", reset to "+1 "
                      if (input.length < 3) {
                        setPhoneNumber('+1 ');
                        return;
                      }
                      
                      // Always keep +1 prefix
                      if (!input.startsWith('+1 ')) {
                        // Extract only digits from input
                        const digits = input.replace(/\D/g, '');
                        // Format as +1 (xxx) xxx-xxxx
                        let formatted = '+1 ';
                        if (digits.length > 0) {
                          if (digits.length <= 3) {
                            formatted += `(${digits}`;
                          } else if (digits.length <= 6) {
                            formatted += `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                          } else {
                            formatted += `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
                          }
                        }
                        setPhoneNumber(formatted);
                      } else {
                        // Handle input that already has +1 prefix
                        const withoutPrefix = input.slice(3);
                        const digits = withoutPrefix.replace(/\D/g, '');
                        let formatted = '+1 ';
                        if (digits.length > 0) {
                          if (digits.length <= 3) {
                            formatted += `(${digits}`;
                          } else if (digits.length <= 6) {
                            formatted += `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                          } else {
                            formatted += `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
                          }
                        }
                        setPhoneNumber(formatted);
                      }
                    }}
                    onKeyDown={(e) => {
                      // Prevent cursor movement before "+1 "
                      const target = e.target as HTMLInputElement;
                      if ((e.key === 'ArrowLeft' || e.key === 'Home') && target.selectionStart !== null && target.selectionStart <= 3) {
                        e.preventDefault();
                        target.setSelectionRange(3, 3);
                      }
                    }}
                    onClick={(e) => {
                      // Prevent cursor placement before "+1 "
                      const target = e.target as HTMLInputElement;
                      if (target.selectionStart !== null && target.selectionStart < 3) {
                        target.setSelectionRange(3, 3);
                      }
                    }}
                    onFocus={(e) => {
                      // Set cursor after "+1 " on focus
                      const target = e.target as HTMLInputElement;
                      setTimeout(() => {
                        if (target.selectionStart !== null && target.selectionStart < 3) {
                          target.setSelectionRange(3, 3);
                        }
                      }, 0);
                    }}
                    required
                  />
                </Form.Group>
                
                {error && <Alert variant="danger">{error}</Alert>}
                {successMessage && <Alert variant="success">{successMessage}</Alert>}
                
                <div className="d-grid gap-2">
                  <Button variant="primary" type="submit" disabled={mobileLoading} className="button-text">
                    {mobileLoading ? <Spinner animation="border" size="sm" /> : t('auth.sendSmsCode')}
                  </Button>
                  
                  <p className="text-muted mt-3 mobile-consent-text">
                    {t('auth.smsConsentMobile')}
                  </p>
                </div>
              </div>
            </Form>
          )
        ) : (
          // Email Login Form
          <Form onSubmit={handleSignIn}>
            <div className="email-form-container">
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.email')}</Form.Label>
                <Form.Control
                  type="email"
                  placeholder={t('auth.enterEmail')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.password')}</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showMainPassword ? "text" : "password"}
                    placeholder={t('auth.enterPassword')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button 
                    variant="outline-secondary"
                    onClick={() => setShowMainPassword(!showMainPassword)}
                  >
                    <i className={`bi ${showMainPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                  </Button>
                </InputGroup>
              </Form.Group>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {successMessage && <Alert variant="success">{successMessage}</Alert>}
              
              <div className="d-grid gap-2">
                <Button variant="primary" type="submit" disabled={loading} className="button-text">
                  {loading ? <Spinner animation="border" size="sm" /> : t('auth.signIn')}
                </Button>
                <div className="d-flex justify-content-between">
                  <Button 
                    variant="link" 
                    onClick={() => setShowForgotPassword(true)}
                    disabled={loading}
                    className="forgot-password-link"
                  >
                    {t('auth.forgotPassword')}
                  </Button>
                  <Button 
                    variant="link" 
                    onClick={() => {
                      setShowSignUp(true);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    disabled={loading}
                    className="forgot-password-link"
                  >
                    {t('auth.signUp')}
                  </Button>
                </div>

                <p className="text-muted mt-3" style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                  {t('auth.smsConsent')}
                </p>
              </div>
            </div>
          </Form>
        )}
      </Col>
      
      {/* SMS Frequency Disclaimer - positioned at bottom */}
      {showMobileLogin && (
        <div className="position-fixed bottom-0 start-0 end-0 p-2" style={{ backgroundColor: 'rgba(248, 249, 250, 0.95)', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
          <p className="text-center mb-0" style={{ fontSize: '0.75rem', color: 'rgba(108, 117, 125, 0.7)', lineHeight: '1.2' }}>
            {t('auth.smsFrequencyDisclaimer')}
          </p>
        </div>
      )}
    </Container>
  );
};

export default CustomLogin;