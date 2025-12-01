import React from 'react';
import { Container } from 'react-bootstrap';
import LandingTopNavigation from './LandingTopNavigation';
import CustomLogin from './CustomLogin';
import './CustomLogin.css';

/**
 * CustomLoginWrapper - Layout wrapper for authentication pages
 * 
 * This component provides the standard layout for login/auth pages:
 * - Top navigation
 * - Centered container with custom styling
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
        <CustomLogin />
      </Container>
    </>
  );
};

export default CustomLoginWrapper;

