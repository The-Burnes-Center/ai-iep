import React, { useState } from 'react';
import { Auth } from 'aws-amplify';
import { 
  Container, 
  Row, 
  Col, 
  Form, 
  Button, 
  Card, 
  Alert, 
  Spinner 
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

interface CustomLoginProps {
  onLoginSuccess: () => void;
}

const CustomLogin: React.FC<CustomLoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Form submission event triggers handleSignIn
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // singIn method sends credentrials to Cognito throught Amplify's API
      // Cognito verifies the username exists in the user pool
      // Validates the password using Secure Remote Password protocol
      // Upon Success ID token, Access token and Refresh token are generated 
      const user = await Auth.signIn(username, password);
      console.log('Login successful', user);
      onLoginSuccess();
    } catch (err) {
      console.error('Login error', err);
      if (err.code === 'UserNotConfirmedException') {
        setError('Please confirm your account through the link sent to your email');
      } else if (err.code === 'NotAuthorizedException') {
        setError('Incorrect username or password');
      } else if (err.code === 'UserNotFoundException') {
        setError('User does not exist');
      } else {
        setError(err.message || 'An error occurred during sign in');
      }
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

  if (showForgotPassword) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Card style={{ width: '400px' }} className="shadow">
          <Card.Header className="bg-primary text-white text-center">
            <h4>Reset Password</h4>
          </Card.Header>
          <Card.Body>
            {!resetSent ? (
              <Form onSubmit={handleForgotPassword}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
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
                  <Button variant="primary" type="submit" disabled={loading}>
                    {loading ? <Spinner animation="border" size="sm" /> : 'Send Reset Code'}
                  </Button>
                  <Button 
                    variant="link" 
                    onClick={() => setShowForgotPassword(false)}
                    disabled={loading}
                  >
                    Back to Sign In
                  </Button>
                </div>
              </Form>
            ) : (
              <Form onSubmit={handleResetPassword}>
                <Form.Group className="mb-3">
                  <Form.Label>Verification Code</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter verification code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
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
                  <Button variant="primary" type="submit" disabled={loading}>
                    {loading ? <Spinner animation="border" size="sm" /> : 'Reset Password'}
                  </Button>
                  <Button 
                    variant="link" 
                    onClick={() => setShowForgotPassword(false)}
                    disabled={loading}
                  >
                    Back to Sign In
                  </Button>
                </div>
              </Form>
            )}
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <Card style={{ width: '400px' }} className="shadow">
        <Card.Header className="bg-primary text-white text-center">
          <h4>Welcome to AI-EP</h4>
        </Card.Header>
        <Card.Body>
          <div className="text-center mb-4">
            <img 
              src="/images/stateseal-color.png" 
              alt="Logo" 
              style={{ width: '100px', height: 'auto' }} 
            />
            <h5 className="mt-2">Sign in to your account</h5>
          </div>
          
          <Form onSubmit={handleSignIn}>
            <Form.Group className="mb-3">
              <Form.Label>Username or Email</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter username or email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
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
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : 'Sign In'}
              </Button>
              <Button 
                variant="link" 
                onClick={() => setShowForgotPassword(true)}
                disabled={loading}
              >
                Forgot Password?
              </Button>
            </div>
          </Form>
        </Card.Body>
        <Card.Footer className="text-center text-muted">
          <small>
            An AI tool to help Massachusetts communities
          </small>
        </Card.Footer>
      </Card>
    </Container>
  );
};

export default CustomLogin;