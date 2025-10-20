import React from 'react';
import { Container, Row, Col, Breadcrumb } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './ProfileForms.css';
import './UpdateProfileName.css';
import './ProfileForms.css';
import './AboutApp.css';

const AboutApp: React.FC = () => {
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate('/support-center');
  };

  return (
    <>
      <div>
      {/* Breadcrumbs */}
      <div className="mt-3 text-start px-4">
        <Breadcrumb>
          <Breadcrumb.Item onClick={handleBackClick}>SUPPORT CENTER</Breadcrumb.Item>
          <Breadcrumb.Item active>ABOUT</Breadcrumb.Item>
        </Breadcrumb>
      </div>
    
        <Container 
          fluid 
          className="about-app-intro-container"
          >
          <Row style={{ width: '100%', justifyContent: 'center' }}>
            <Col xs={12} md={8} lg={6}>
              <div className="profile-form">
                <h4 className="update-profile-header">About The Project</h4>
                <p className='update-profile-description'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod  tempor incididunt.</p> 
              </div>  
            </Col>
          </Row>  
        </Container>
        
        <div className="thank-you-image">
          <div className="thank-you-card">
            <h5>Thank you for advocating for children’s right to education!</h5>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod  tempor incididunt.</p>
          </div>
        </div>
      
      </div>
    </>
  );
};

export default AboutApp;