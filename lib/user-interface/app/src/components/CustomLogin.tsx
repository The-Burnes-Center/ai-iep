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
      
      console.log('Password changed successfully', user);
      onLoginSuccess();
    } catch (err) {
      console.error('Error changing password:', err);
      setError(err.message || t('auth.errorPasswordChange'));
      // If there's a specific error, reset the password change flow
      setPasswordChangeRequired(false);
      setCognitoUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Convert email to lowercase
    const normalizedResetEmail = resetEmail.toLowerCase();
    
    try {
      await Auth.forgotPassword(normalizedResetEmail);
      // Update the resetEmail state with the normalized email
      setResetEmail(normalizedResetEmail);
      setResetSent(true);
    } catch (err) {
      console.error('Error requesting password reset', err);
      setError(err.message || t('auth.errorRequestPasswordReset'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await Auth.forgotPasswordSubmit(resetEmail, resetCode, newPassword);
      setShowForgotPassword(false);
      setResetSent(false);
      setSuccessMessage(t('auth.successPasswordReset'));
    } catch (err) {
      console.error('Error resetting password', err);
      setError(err.message || t('auth.errorResetPassword'));
    } finally {
      setLoading(false);
    }
  };

  // Handler for Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (signUpPassword !== signUpConfirmPassword) {
      setError(t('auth.errorPasswordsNotMatch'));
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Convert email to lowercase
    const normalizedSignUpEmail = signUpEmail.toLowerCase();
    
    try {
      // Call Cognito's signUp method
      await Auth.signUp({
        username: normalizedSignUpEmail,
        password: signUpPassword,
        attributes: {
          email: normalizedSignUpEmail,
        }
      });
      
      // Update the signUpEmail state with the normalized email
      setSignUpEmail(normalizedSignUpEmail);
      console.log('Sign up successful, verification required');
      setIsSignUpComplete(true);
    } catch (err) {
      console.error('Error signing up:', err);
      
      // Handle specific Cognito errors
      if (err.code === 'UsernameExistsException') {
        setError(t('auth.errorUsernameExists'));
      } else if (err.code === 'InvalidPasswordException') {
        setError(err.message || t('auth.errorInvalidPassword'));
      } else if (err.code === 'InvalidParameterException') {
        setError(err.message || t('auth.errorInvalidParameter'));
      } else {
        setError(err.message || t('auth.errorSignUp'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Handler for verification code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    
    try {
      // Confirm the sign up with verification code
      await Auth.confirmSignUp(signUpEmail, verificationCode);
      console.log('Verification successful');
      
      // Reset sign up form and switch back to login
      setSignUpEmail('');
      setSignUpPassword('');
      setSignUpConfirmPassword('');
      setVerificationCode('');
      setShowSignUp(false);
      setIsSignUpComplete(false);
      setSuccessMessage(t('auth.successAccountCreated'));
    } catch (err) {
      console.error('Error verifying code:', err);
      
      // Handle specific Cognito errors
      if (err.code === 'CodeMismatchException') {
        setError(t('auth.errorInvalidCode'));
      } else if (err.code === 'ExpiredCodeException') {
        setError(t('auth.errorExpiredCode'));
      } else {
        setError(err.message || t('auth.errorVerification'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Handler to resend verification code
  const handleResendCode = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Auth.resendSignUp(signUpEmail);
      setSuccessMessage(t('auth.successCodeResent'));
    } catch (err) {
      console.error('Error resending code:', err);
      setError(err.message || t('auth.errorResendCode'));
    } finally {
      setLoading(false);
    }
  };

  // Render the language dropdown
  const renderLanguageDropdown = () => (
    <Dropdown className="mb-4">
      <Dropdown.Toggle variant="outline-secondary" id="language-dropdown">
        {languageOptions.find(option => option.value === language)?.label || 'English'}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {languageOptions.map(option => (
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
  );

  if (passwordChangeRequired) {
    return (
      <Container fluid className="d-flex justify-content-center align-items-center login-container" style={{ minHeight: '100vh' }}>
        <Col xs={12} md={6} lg={4}>
          <h1 className="text-center mb-4 aiep-title">AIEP</h1>
          <div className="text-end">
            {renderLanguageDropdown()}
          </div>
          <h4 className="text-center mb-4">{t('auth.setNewPassword')}</h4>
          <Form onSubmit={handleCompleteNewPassword}>
            <div className="mobile-form-container">
              <Form.Group className="mb-3">
                <Container className="mt-3 mb-3 p-3 border rounded bg-light">
                  <Form.Text className="text-muted">
                    {t('auth.passwordRequirements')}
                    <ul>
                      <li>{t('auth.passwordRequirement1')}</li>
                      <li>{t('auth.passwordRequirement2')}</li>
                    </ul>
                  </Form.Text>
                </Container>

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
  
              <div className="d-grid gap-2">
                <Button variant="primary" type="submit" disabled={loading} className="button-text">
                  {loading ? <Spinner animation="border" size="sm" /> : t('auth.setNewPassword')}
                </Button>
              </div>
            </div>
          </Form>
        </Col>
      </Container>
    );
  }

  // Sign Up Verification View
  if (showSignUp && isSignUpComplete) {
    return (
      <Container fluid className="d-flex justify-content-center align-items-center login-container" style={{ minHeight: '100vh' }}>
        <Col xs={12} md={6} lg={4}>
          <h1 className="text-center mb-4 aiep-title">AIEP</h1>
          <div className="text-end">
            {renderLanguageDropdown()}
          </div>
          <h4 className="text-center mb-4">{t('auth.verifyAccount')}</h4>
          
          <Form onSubmit={handleVerifyCode}>
            <div className="mobile-form-container">
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.email')}</Form.Label>
                <Form.Control
                  type="email"
                  value={signUpEmail}
                  readOnly
                />
                <Form.Text className="text-muted">
                  {t('auth.verificationCodeSent')}
                </Form.Text>
              </Form.Group>
              
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
                  {loading ? <Spinner animation="border" size="sm" /> : t('auth.verifyAccount')}
                </Button>
                <Button 
                  variant="outline-secondary"
                  onClick={handleResendCode}
                  disabled={loading}
                >
                  {t('auth.resendCode')}
                </Button>
                <Button 
                  variant="link" 
                  onClick={() => {
                    setShowSignUp(false);
                    setIsSignUpComplete(false);
                  }}
                  disabled={loading}
                  className="forgot-password-link"
                >
                  {t('auth.backToSignIn')}
                </Button>
              </div>
            </div>
          </Form>
        </Col>
      </Container>
    );
  }

  // Sign Up Form View
  if (showSignUp) {
    return (
      <Container fluid className="d-flex justify-content-center align-items-center login-container" style={{ minHeight: '100vh' }}>
        <Col xs={12} md={6} lg={4}>
          <h1 className="text-center mb-4 aiep-title">AIEP</h1>
          <div className="text-end">
            {renderLanguageDropdown()}
          </div>
          <h4 className="text-center mb-4">{t('auth.signUp')}</h4>          
          <Form onSubmit={handleSignUp}>
            <div className="mobile-form-container">
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.email')}</Form.Label>
                <Form.Control
                  type="email"
                  placeholder={t('auth.enterEmail')}
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value.toLowerCase())}
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">{t('auth.password')}</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showSignUpPassword ? "text" : "password"}
                    placeholder={t('auth.createPassword')}
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
                    placeholder={t('auth.confirmPassword')}
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
                  onClick={() => setShowSignUp(false)}
                  disabled={loading}
                  className="forgot-password-link"
                >
                  {t('auth.signInPrompt')}
                </Button>
              </div>
            </div>
          </Form>
        </Col>
      </Container>
    );
  }

  if (showForgotPassword) {
    return (
      <Container fluid className="d-flex justify-content-center align-items-center login-container" style={{ minHeight: '100vh' }}>
        <Col xs={12} md={6} lg={4}>
          <h1 className="text-center mb-4 aiep-title">AIEP</h1>
          <div className="text-end">
            {renderLanguageDropdown()}
          </div>
          <h4 className="text-center mb-4">{t('auth.resetPassword')}</h4>
          {!resetSent ? (
            <Form onSubmit={handleForgotPassword}>
              <div className="mobile-form-container">
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-bold">{t('auth.email')}</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder={t('auth.enterEmail')}
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value.toLowerCase())}
                    required
                  />
                </Form.Group>
                
                {error && <Alert variant="danger">{error}</Alert>}
                
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
                    {t('auth.backToSignIn')}
                  </Button>
                </div>
              </div>
            </Form>
          ) : (
            <Form onSubmit={handleResetPassword}>
              <div className="mobile-form-container">
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-bold">{t('auth.verificationCode')}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={t('auth.enterVerificationCode')}
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
                
                {error && <Alert variant="danger">{error}</Alert>}
                
                <div className="d-grid gap-2">
                  <Button variant="primary" type="submit" disabled={loading} className="button-text">
                    {loading ? <Spinner animation="border" size="sm" /> : t('auth.resetPassword')}
                  </Button>
                  <Button 
                    variant="link" 
                    onClick={() => setShowForgotPassword(false)}
                    disabled={loading}
                    className="forgot-password-link"
                  >
                    {t('auth.backToSignIn')}
                  </Button>
                </div>
              </div>
            </Form>
          )}
        </Col>
      </Container>
    );
  }

  // Main Login View
  return (
    <Container fluid className="d-flex justify-content-center align-items-center login-container" style={{ minHeight: '100vh' }}>
      <Col xs={12} md={6} lg={4}>
        <h1 className="text-center mb-4 aiep-title">AIEP</h1>
        <div className="text-end">
          {renderLanguageDropdown()}
        </div>
        <Form onSubmit={handleSignIn}>
          <div className="mobile-form-container">
            <Form.Group className="mb-3">
              <Form.Label className="form-label-bold">{t('auth.email')}</Form.Label>
              <Form.Control
                type="email"
                placeholder={t('auth.enterEmail')}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
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
      </Col>
    </Container>
  );
};

export default CustomLogin;