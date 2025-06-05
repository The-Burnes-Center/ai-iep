import React, { useState } from 'react';
import { Container, Button, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './ProfileForms.css';

const WelcomeIntro: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleContinue = () => {
    setLoading(true);
    // Navigate to welcome page
    navigate('/iep-documents');
  };

  return (
    <Container 
      fluid 
      className="profile-form-container"
    >
      <Row style={{ width: '100%', justifyContent: 'center' }}>
        <Col xs={12} md={8} lg={6}>
          <div className="profile-form">
            <h2 className="text-center profile-title">Hello! Welcome to AIEP</h2>
            
            <div className="consent-box">
              <p className="consent-text">
                AIEP helps you understand your child's IEP documents with easy-to-read summaries and translations in your preferred language. 
              </p>
              <p className="consent-text">
                Never feel lost in IEP meetings again - AIEP breaks down complex education jargon into simple, understandable language.
              </p>
            </div>

            <div className="d-grid">
              <Button 
                variant="primary" 
                onClick={handleContinue}
                disabled={loading}
                className="button-text"
              >
                {loading ? 'Loading...' : 'Continue'}
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default WelcomeIntro;