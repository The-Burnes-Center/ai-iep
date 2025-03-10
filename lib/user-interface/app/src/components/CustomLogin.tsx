import React, { useState } from 'react';
import { Auth } from 'aws-amplify';
import { 
  Container, 
  Row, 
  Col, 
  Form, 
  Button, 
  Alert, 
  Spinner 
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './CustomLogin.css'; // Import the custom CSS file

interface CustomLoginProps {
  onLoginSuccess: () => void;
}

const CustomLogin: React.FC<CustomLoginProps> = ({ onLoginSuccess }) => {
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
  
  // New state for handling password change requirement
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [cognitoUser, setCognitoUser] = useState<any>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const user = await Auth.signIn(username, password);
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
    
    try {
      await Auth.forgotPassword(resetEmail);
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
      setError('Password reset successful. Please sign in with your new password.');
    } catch (err) {
      console.error('Error resetting password', err);
      setError(err.message || 'Error resetting password');
    } finally {
      setLoading(false);
    }
  };

  // Render password change form when required
  if (passwordChangeRequired) {
    return (
      <Container fluid className="d-flex justify-content-center align-items-center login-container" style={{ minHeight: '100vh' }}>
        <Col xs={12} md={6} lg={4}>
          <h1 className="text-center mb-4 aiep-title">AIEP</h1>
          <h4 className="text-center mb-4">Set New Password</h4>
          
          <Form onSubmit={handleCompleteNewPassword}>
            <div className="mobile-form-container">
              <Alert variant="info">
                You need to set a new password before continuing.
              </Alert>
              
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">New Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label className="form-label-bold">Confirm Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
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

  if (showForgotPassword) {
    return (
      <Container fluid className="d-flex justify-content-center align-items-center login-container" style={{ minHeight: '100vh' }}>
        <Col xs={12} md={6} lg={4}>
          <h4 className="text-center mb-4 form-label-bold">Reset Password</h4>
          
          {!resetSent ? (
            <Form onSubmit={handleForgotPassword}>
              <div className="mobile-form-container">
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-bold">Email</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="Enter your email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
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
                  <Form.Control
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </Form.Group>
                
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

  return (
    <Container fluid className="d-flex justify-content-center align-items-center login-container" style={{ minHeight: '100vh' }}>
      <Col xs={12} md={6} lg={4}>
        <h1 className="text-center mb-4 aiep-title">AIEP</h1>
        
        <Form onSubmit={handleSignIn}>
          <div className="mobile-form-container">
            <Form.Group className="mb-3">
              <Form.Label className="form-label-bold">Email</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="form-label-bold">Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>
            
            {error && <Alert variant="danger">{error}</Alert>}
            
            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={loading} className="button-text">
                {loading ? <Spinner animation="border" size="sm" /> : 'Sign In'}
              </Button>
              <Button 
                variant="link" 
                onClick={() => setShowForgotPassword(true)}
                disabled={loading}
                className="forgot-password-link"
              >
                Forgot Password?
              </Button>
            </div>
          </div>
        </Form>
      </Col>
    </Container>
  );
};

export default CustomLogin;