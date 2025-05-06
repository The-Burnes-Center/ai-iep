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
  InputGroup
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './CustomLogin.css'; // Import the custom CSS file

interface CustomLoginProps {
  onLoginSuccess: () => void;
}

const CustomLogin: React.FC<CustomLoginProps> = ({ onLoginSuccess }) => {
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
  
  // New state variables for sign up
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

  // Maintenance banner
  const MaintenanceBanner = () => (
    <Alert variant="warning" className="text-center my-4 mx-2" style={{ padding: '15px', borderRadius: '8px' }}>
      <i className="bi bi-exclamation-triangle-fill me-2"></i>
      <strong>Site is under maintenance</strong>
      <p className="mb-0 mt-1">Some features may be temporarily unavailable. We apologize for any inconvenience.</p>
    </Alert>
  );

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
        setError('Please confirm your account through the link sent to your email');
      } else if (err.code === 'NotAuthorizedException') {
        setError('Incorrect email or password');
      } else if (err.code === 'UserNotFoundException') {
        setError('User does not exist');
      } else {
        setError(err.message || 'An error occurred during sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
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
      setError(err.message || 'Error changing password');
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
      setError(err.message || 'Error requesting password reset');
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
      setSuccessMessage('Password reset successful. Please sign in with your new password.');
    } catch (err) {
      console.error('Error resetting password', err);
      setError(err.message || 'Error resetting password');
    } finally {
      setLoading(false);
    }
  };

  // New handler for Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (signUpPassword !== signUpConfirmPassword) {
      setError('Passwords do not match');
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
        setError('An account with this email already exists');
      } else if (err.code === 'InvalidPasswordException') {
        setError(err.message || 'Password does not meet requirements');
      } else if (err.code === 'InvalidParameterException') {
        setError(err.message || 'Invalid parameter provided');
      } else {
        setError(err.message || 'An error occurred during sign up');
      }
    } finally {
      setLoading(false);
    }
  };

  // New handler for verification code
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
      setSuccessMessage('Account created successfully! Please sign in with your credentials.');
    } catch (err) {
      console.error('Error verifying code:', err);
      
      // Handle specific Cognito errors
      if (err.code === 'CodeMismatchException') {
        setError('Invalid verification code');
      } else if (err.code === 'ExpiredCodeException') {
        setError('Verification code has expired. Please request a new one.');
      } else {
        setError(err.message || 'Error verifying your account');
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
      setSuccessMessage('Verification code has been resent to your email');
    } catch (err) {
      console.error('Error resending code:', err);
      setError(err.message || 'Error resending verification code');
    } finally {
      setLoading(false);
    }
  };

  if (passwordChangeRequired) {
    return (
      <Container fluid className="d-flex justify-content-center align-items-center login-container" style={{ minHeight: '100vh' }}>
        <Col xs={12} md={6} lg={4}>
          <h1 className="text-center mb-4 aiep-title">AIEP</h1>
          <h4 className="text-center mb-4">Set New Password</h4>
          <Form onSubmit={handleCompleteNewPassword}>
            <div className="mobile-form-container">
              <Form.Group className="mb-3">
                <Container className="mt-3 mb-3 p-3 border rounded bg-light">
                  <Form.Text className="text-muted">
                    Password must be at least 8 characters long and include:
                    <ul>
                      <li>At least 1 number</li>
                      <li>At least 1 letter</li>
                    </ul>
                  </Form.Text>
                </Container>

                <Form.Label className="form-label-bold">New Password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
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
                <Form.Label className="form-label-bold">Confirm Password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
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
                  {loading ? <Spinner animation="border" size="sm" /> : 'Set New Password'}
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
          <h4 className="text-center mb-4">Verify Your Account</h4>
          
          <Form onSubmit={handleVerifyCode}>
            <div className="mobile-form-container">
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">Email</Form.Label>
                <Form.Control
                  type="email"
                  value={signUpEmail}
                  readOnly
                />
                <Form.Text className="text-muted">
                  We've sent a verification code to this email address.
                </Form.Text>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">Verification Code</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter the code from your email"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                />
              </Form.Group>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {successMessage && <Alert variant="success">{successMessage}</Alert>}
              
              <div className="d-grid gap-2">
                <Button variant="primary" type="submit" disabled={loading} className="button-text">
                  {loading ? <Spinner animation="border" size="sm" /> : 'Verify Account'}
                </Button>
                <Button 
                  variant="outline-secondary"
                  onClick={handleResendCode}
                  disabled={loading}
                >
                  Resend Verification Code
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
                  Back to Sign In
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
          <h4 className="text-center mb-4">Create an Account</h4>          
          <Form onSubmit={handleSignUp}>
            <div className="mobile-form-container">
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">Email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="Enter your email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value.toLowerCase())}
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">Password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showSignUpPassword ? "text" : "password"}
                    placeholder="Create a password"
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
                <Form.Label className="form-label-bold">Confirm Password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showSignUpConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
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
                  Password must be at least 8 characters long and include:
                  <ul>
                    <li>At least 1 number</li>
                    <li>At least 1 letter</li>
                  </ul>
                </Form.Text>
              </Container>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {successMessage && <Alert variant="success">{successMessage}</Alert>}
              
              <div className="d-grid gap-2">
                <Button variant="primary" type="submit" disabled={loading} className="button-text">
                  {loading ? <Spinner animation="border" size="sm" /> : 'Sign Up'}
                </Button>
                <Button 
                  variant="link" 
                  onClick={() => setShowSignUp(false)}
                  disabled={loading}
                  className="forgot-password-link"
                >
                  Already have an account? Sign In
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
          <h4 className="text-center mb-4">Reset Password</h4>
          {!resetSent ? (
            <Form onSubmit={handleForgotPassword}>
              <div className="mobile-form-container">
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-bold">Email</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="Enter your email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value.toLowerCase())}
                    required
                  />
                </Form.Group>
                
                {error && <Alert variant="danger">{error}</Alert>}
                
                <div className="d-grid gap-2">
                  <Button variant="primary" type="submit" disabled={loading} className="button-text">
                    {loading ? <Spinner animation="border" size="sm" /> : 'Send Reset Code'}
                  </Button>
                  <Button 
                    variant="link" 
                    onClick={() => setShowForgotPassword(false)}
                    disabled={loading}
                    className="forgot-password-link"
                  >
                    Back to Sign In
                  </Button>
                </div>
              </div>
            </Form>
          ) : (
            <Form onSubmit={handleResetPassword}>
              <div className="mobile-form-container">
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-bold">Verification Code</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter verification code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-bold">New Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password"
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
                    Password must be at least 8 characters long and include:
                    <ul>
                      <li>At least 1 number</li>
                      <li>At least 1 letter</li>
                    </ul>
                  </Form.Text>
                </Container>
                
                {error && <Alert variant="danger">{error}</Alert>}
                
                <div className="d-grid gap-2">
                  <Button variant="primary" type="submit" disabled={loading} className="button-text">
                    {loading ? <Spinner animation="border" size="sm" /> : 'Reset Password'}
                  </Button>
                  <Button 
                    variant="link" 
                    onClick={() => setShowForgotPassword(false)}
                    disabled={loading}
                    className="forgot-password-link"
                  >
                    Back to Sign In
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
        <Form onSubmit={handleSignIn}>
          <div className="mobile-form-container">
            <Form.Group className="mb-3">
              <Form.Label className="form-label-bold">Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="form-label-bold">Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showMainPassword ? "text" : "password"}
                  placeholder="Enter password"
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
                {loading ? <Spinner animation="border" size="sm" /> : 'Sign In'}
              </Button>
              <div className="d-flex justify-content-between">
                <Button 
                  variant="link" 
                  onClick={() => setShowForgotPassword(true)}
                  disabled={loading}
                  className="forgot-password-link"
                >
                  Forgot Password?
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
                  Sign Up
                </Button>
              </div>
            </div>
          </div>
        </Form>
      </Col>
    </Container>
  );
};

export default CustomLogin;