import React, { useState } from 'react';
import { Container, Form, Button, Row, Col, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './ProfileForms.css';

export default function ConsentForm() {
  const [isChecked, setIsChecked] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsChecked(e.target.checked);
    if (showTooltip) setShowTooltip(false);
  };

  const handleContinue = () => {
    if (isChecked) {
      navigate('/view-update-add-child');
    } else {
      setShowTooltip(true);
    }
  };

  const renderTooltip = (props) => (
    <Tooltip id="consent-tooltip" className="consent-tooltip" {...props}>
      Please check the box to continue
    </Tooltip>
  );

  return (
    <Container 
      fluid 
      className="profile-form-container"
    >
      <Row style={{ width: '100%', justifyContent: 'center' }}>
        <Col xs={12} md={8} lg={6}>
          <div className="profile-form">
            <h2 className="text-center profile-title">Before we Begin</h2>
            
            <div className="consent-box">
              <p className="consent-text">
              To use our IEP Helper tool, we need your permission. By checking this box, you allow us to process your child’s IEP information to provide personalized support and recommendations. We keep all information private and secure. You can withdraw your consent at any time by contacting us.
              </p>
              
              <Form.Group controlId="consentCheckbox">
                <OverlayTrigger
                  placement="right"
                  overlay={renderTooltip}
                  show={showTooltip}
                >
                  <Form.Check 
                    type="checkbox"
                    checked={isChecked}
                    onChange={handleChange}
                    label={<span className="checkbox-label">I Agree</span>}
                  />
                </OverlayTrigger>
              </Form.Group>
            </div>

            <div className="d-grid">
              <Button 
                variant="primary" 
                onClick={handleContinue}
                disabled={!isChecked}
                className="button-text"
              >
                Agree and Continue
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
}