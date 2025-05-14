import React, { useState, useContext } from 'react';
import { Container, Button, Row, Col, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import { Auth } from 'aws-amplify';
import { AuthContext } from '../../common/auth-context';
import { useNotifications } from '../../components/notif-manager';
import '../profile/ProfileForms.css';

const RevokeConsent: React.FC = () => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext);
  const { setAuthenticated } = useContext(AuthContext);
  const { addNotification } = useNotifications();

  const handleRevokeConsent = async () => {
    try {
      setProcessing(true);
      setError(null);
      
      // Update profile to set consentGiven to false
      await apiClient.profile.updateProfile({ consentGiven: false });
      
      // Sign out the user
      await Auth.signOut();
      setAuthenticated(false);
      
      // Redirect to sign-in page
      navigate('/', { replace: true });
    } catch (err) {
      setError('Failed to revoke consent. Please try again.');
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    navigate('/profile');
  };

  return (
    <Container fluid className="profile-form-container">
      <Row style={{ width: '100%', justifyContent: 'center' }}>
        <Col xs={12} md={8} lg={6}>
          <div className="profile-form">
            <h2 className="text-center profile-title mb-4">Revoke Consent</h2>
            
            <div className="consent-box mb-4">
              <p className="consent-text">
                By revoking your consent, you will no longer be able to use the IEP Helper tool. 
                Your data will be deleted from our system. 
              </p>
              <p className="consent-text">
                Revoking consent will immediately sign you out of the application. You can restore 
                your consent by logging back in and accepting the consent form.
              </p>
            </div>
            
            {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
            
            <div className="d-flex justify-content-between">
              <Button 
                variant="outline-secondary" 
                onClick={handleCancel}
                disabled={processing}
                className="button-text"
              >
                Take me back
              </Button>
              <Button 
                variant="danger" 
                onClick={handleRevokeConsent}
                disabled={processing}
                className="button-text"
              >
                {processing ? 'Processing...' : 'Revoke & Sign Out'}
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default RevokeConsent;