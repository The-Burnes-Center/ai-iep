import React, { useState } from 'react';
import { Container, Form, Button, Row, Col, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../common/language-context'; // Updated import
import './ProfileForms.css';

export default function ConsentForm() {
  const [isChecked, setIsChecked] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

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
      {t('consent.tooltip')}
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
            <h2 className="text-center profile-title">{t('consent.title')}</h2>
            
            <div className="consent-box">
              <p className="consent-text">
                {t('consent.text')}
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
                    label={<span className="checkbox-label">{t('consent.checkbox')}</span>}
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
                {t('consent.button')}
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
}