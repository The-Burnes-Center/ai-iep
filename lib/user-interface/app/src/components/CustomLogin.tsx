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
  const [showMobileLogin, setShowMobileLogin] = useState(false);
  const [mobileLoading, setMobileLoading] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [smsCodeSent, setSmsCodeSent] = useState(false);
  const [cognitoUserForSms, setCognitoUserForSms] = useState<any>(null);
  
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

  const handleMobileLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setError(t('pleaseEnterPhoneNumber'));
      return;
    }

    setMobileLoading(true);
    setError('');

    // Extract only digits and format properly
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Validate we have enough digits (10 for US number)
    if (digits.length < 10) {
      setError(t('auth.invalidPhoneNumber'));
      setMobileLoading(false);
      return;
    }

    // Format as +1XXXXXXXXXX (E.164 format)
    const formattedPhone = `+1${digits.slice(-10)}`;

    try {
      console.log('Initiating Phone OTP with Custom Auth for:', formattedPhone);

      // Use CUSTOM_AUTH flow with our Lambda triggers
      const cognitoUser = await Auth.signIn(formattedPhone, undefined, {
        authFlowType: 'CUSTOM_AUTH'
      });

      console.log('Phone OTP initiated successfully:', cognitoUser);
      
      if (cognitoUser.challengeName === 'CUSTOM_CHALLENGE') {
        setCognitoUserForSms(cognitoUser);
        setSmsCodeSent(true);
        setSuccessMessage(t('auth.smsCodeSent'));
      } else {
        setError(t('unexpectedChallengeType'));
      }
    } catch (error: any) {
      console.error('Phone OTP error:', error);
      
      // Handle various error types
      if (error.code === 'UserNotFoundException') {
        try {
          console.log('User not found, creating new user with phone number:', formattedPhone);
          
          // Create a strong password that meets Cognito requirements
          const tempPassword = 'TempPass123!' + Math.random().toString(36).slice(-4);
          
          // Auto-signup with phone number as username
          const signUpResult = await Auth.signUp({
            username: formattedPhone,
            password: tempPassword,
            attributes: {
              phone_number: formattedPhone,
              phone_number_verified: 'true',
              // Add a placeholder email if required by your user pool
              email: `${formattedPhone.replace('+', '').replace(/\D/g, '')}@temp.placeholder`
            }
          });
          
          // Auto-confirm the user immediately since we'll verify via SMS
          try {
            await Auth.confirmSignUp(formattedPhone, '000000', {
              forceAliasCreation: false
            });
          } catch (confirmError) {
            console.log('Confirm signup not needed or failed:', confirmError);
          }
          
          console.log('User created successfully:', signUpResult);
          
          // Now try the phone OTP flow again
          const cognitoUser = await Auth.signIn(formattedPhone, undefined, {
            authFlowType: 'CUSTOM_AUTH'
          });
          
          if (cognitoUser.challengeName === 'CUSTOM_CHALLENGE') {
            setCognitoUserForSms(cognitoUser);
            setSmsCodeSent(true);
            setSuccessMessage(t('auth.smsCodeSent'));
          } else {
            setError(t('unexpectedChallengeType'));
          }
          
        } catch (signUpError: any) {
          console.error('Auto-signup error:', signUpError);
          
          if (signUpError.code === 'UsernameExistsException') {
            // User exists but might be in a different state, try again
            setError(t('auth.phoneNotFound'));
          } else if (signUpError.code === 'InvalidPasswordException') {
            setError(t('phoneAuthConfigIssue'));
          } else {
            setError(`${t('phoneAuthError')}: ${signUpError.message}`);
          }
        }
      } else if (error.code === 'InvalidParameterException') {
        setError(t('phoneAuthConfigIssue'));
      } else if (error.code === 'NotAuthorizedException') {
        setError(t('authNotAuthorized'));
      } else if (error.code === 'UserNotConfirmedException') {
        try {
          // Auto-confirm the user since we're using phone verification
          console.log('User not confirmed, auto-confirming:', formattedPhone);
          
          // For phone-based auth, we can auto-confirm since SMS verification is the confirmation
          await Auth.confirmSignUp(formattedPhone, '000000', {
            forceAliasCreation: false
          });
          
          // Now try the phone OTP flow again
          const cognitoUser = await Auth.signIn(formattedPhone, undefined, {
            authFlowType: 'CUSTOM_AUTH'
          });
          
          if (cognitoUser.challengeName === 'CUSTOM_CHALLENGE') {
            setCognitoUserForSms(cognitoUser);
            setSmsCodeSent(true);
            setSuccessMessage(t('auth.smsCodeSent'));
          } else {
            setError(t('unexpectedChallengeType'));
          }
          
        } catch (confirmError: any) {
          console.error('Auto-confirm error:', confirmError);
          // If auto-confirm fails, just proceed with the SMS flow anyway
          setError(t('auth.phoneNotFound'));
        }
      } else if (error.code === 'LimitExceededException') {
        setError(t('auth.tooManyAttempts'));
      } else {
        setError(`${t('phoneAuthError')}: ${error.message}`);
      }
    }

    setMobileLoading(false);
  };

  const handleSmsCodeVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Verify the SMS code using custom challenge answer
      const user = await Auth.sendCustomChallengeAnswer(
        cognitoUserForSms,
        smsCode
      );
      
      console.log('SMS verification successful', user);
      onLoginSuccess();
      
    } catch (err) {
      console.error('SMS verification error', err);
      
      if (err.code === 'CodeMismatchException') {
        setError(t('auth.invalidSmsCode'));
      } else if (err.code === 'ExpiredCodeException') {
        setError(t('auth.expiredSmsCode'));
      } else if (err.code === 'LimitExceededException') {
        setError(t('auth.tooManyAttempts'));
      } else {
        setError(err.message || t('auth.invalidSmsCode'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendSmsCode = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Extract only digits and format properly
      const digits = phoneNumber.replace(/\D/g, '');
      const formattedPhone = `+1${digits.slice(-10)}`;
      
      // Resend the SMS code by initiating sign in again with custom auth
      const user = await Auth.signIn(formattedPhone, undefined, {
        authFlowType: 'CUSTOM_AUTH'
      });
      
      setCognitoUserForSms(user);
      setSuccessMessage(t('auth.successCodeResent'));
    } catch (err) {
      console.error('Resend SMS error', err);
      setError(err.message || t('auth.smsDeliveryFailed'));
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
            <h2 className="aiep-title text-primary">AIEP</h2>
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
            <h2 className="aiep-title text-primary">AIEP</h2>
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
            <h2 className="aiep-title text-primary">AIEP</h2>
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

        <div className="text-center mb-4">
          <h2 className="aiep-title text-primary">AIEP</h2>
          <h4>{showMobileLogin ? t('auth.mobileLogin') : t('auth.signIn')}</h4>
        </div>

        {/* Login method toggle buttons */}
        <div className="d-grid gap-2 mb-4">
          <div className="btn-group" role="group">
            <Button 
              variant={!showMobileLogin ? "primary" : "outline-primary"}
              onClick={() => setShowMobileLogin(false)}
              className="button-text"
            >
              {t('auth.emailLogin')}
            </Button>
            <Button 
              variant={showMobileLogin ? "primary" : "outline-primary"}
              onClick={() => setShowMobileLogin(true)}
              className="button-text"
            >
              {t('auth.mobileLogin')}
            </Button>
          </div>
        </div>
        
        {showMobileLogin ? (
          // Mobile Login Form
          !smsCodeSent ? (
            // Phone number input form
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
          ) : (
            // SMS verification form
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
                  />
                </Form.Group>
                
                {error && <Alert variant="danger">{error}</Alert>}
                {successMessage && <Alert variant="success">{successMessage}</Alert>}
                
                <div className="d-grid gap-2">
                  <Button variant="primary" type="submit" disabled={loading || smsCode.length !== 6} className="button-text">
                    {loading ? <Spinner animation="border" size="sm" /> : t('auth.verifySmsCode')}
                  </Button>
                  
                  <Button 
                    variant="link"
                    onClick={handleResendSmsCode}
                    disabled={loading}
                    className="forgot-password-link"
                  >
                    {t('auth.resendSmsCode')}
                  </Button>
                  
                  <Button 
                    variant="link" 
                    onClick={() => {
                      setSmsCodeSent(false);
                      setSmsCode('');
                      setPhoneNumber('+1 ');
                      setCognitoUserForSms(null);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    disabled={loading}
                    className="forgot-password-link"
                  >
                    {t('auth.changePhoneNumber')}
                  </Button>
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