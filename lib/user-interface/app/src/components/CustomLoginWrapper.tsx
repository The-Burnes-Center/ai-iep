import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import LandingTopNavigation from './LandingTopNavigation';
import CustomLogin from './CustomLogin';
import './CustomLogin.css';
import AIEPFooter from './AIEPFooter';

const publicFooterLinks = [
  { route: '/', labelKey: 'footer.home' },
  { route: '/login', labelKey: 'footer.uploadIEP' },
  { route: '/faqs', labelKey: 'footer.faqs' },
  { route: '/about-the-project', labelKey: 'footer.aboutUs' },
];

/**
 * CustomLoginWrapper - Layout wrapper for authentication pages
 * 
 * This component provides the standard layout for login/auth pages:
 * - Top navigation
 * - Centered container with custom styling
 * - Row and Col layout wrapper
 * - CustomLogin component as content
 * 
 * This separation allows CustomLogin to be used in different layouts
 * (e.g., modals, embedded components) by creating alternative wrappers.
 */
const CustomLoginWrapper: React.FC = () => {
  return (
    <>
      <LandingTopNavigation />
      <Container fluid className="login-container d-flex align-items-center justify-content-center">
        <Row className="w-100 justify-content-center">
          <Col xs={12} sm={8} md={6} lg={4}>
            <CustomLogin showLogo={true} />
          </Col>
        </Row>
      </Container>
      <AIEPFooter footerLinks={publicFooterLinks} />
    </>
  );
};

export default CustomLoginWrapper;

