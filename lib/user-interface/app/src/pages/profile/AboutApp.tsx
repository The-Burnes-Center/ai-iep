import React, { useState } from 'react';
import { Container, Button, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './ProfileForms.css';

const AboutApp: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleContinue = () => {
    setLoading(true);
    // Navigate to welcome page
    navigate('/summary-and-translations');
  };

  return (
    <Container 
      fluid 
      className="profile-form-container"
    >
      <Row style={{ width: '100%', justifyContent: 'center' }}>
        <Col xs={12} md={8} lg={6}>
          <div className="profile-form">
            <h2 className="text-center profile-title">Your IEP document, made accessible</h2>
            
            <div className="consent-box">
              <p className="consent-text">
                Upload documents once to access organized summaries of your child's educational plan, complete with translations. Whether preparing for meetings or tracking progress, AIEP ensures you're informed about services, goals, accommodations, and your rights.
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

export default AboutApp;