import React, { useEffect, useContext, useState } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Auth } from 'aws-amplify';
import { AuthContext } from '../common/auth-context';
import { useNavigate } from 'react-router-dom';
import './WelcomePage.css';

export default function WelcomePage() {
  const { setAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await Auth.currentAuthenticatedUser();
        if (!result || Object.keys(result).length === 0) {
          console.log("No authenticated user found");
          await Auth.signOut();
          setAuthenticated(false);
          navigate('/');
        }
        else {
          console.log("JWT Payload:", result?.signInUserSession?.idToken?.payload);
          
          const { 
            email,
            name,
            'custom:role': role,
            sub,
            exp
          } = result.signInUserSession.idToken.payload;
          
          // Set the email in state
          setUserEmail(email);
          
          console.log("User details:", {
            email,
            name,
            role,
            sub,
            tokenExpiration: new Date(exp * 1000).toLocaleString()
          });
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        await Auth.signOut();
        setAuthenticated(false);
        navigate('/');
      }
    };

    checkAuth();
  }, [setAuthenticated, navigate]);

  return (
    <Container fluid className="welcome-container">
      <Row style={{ width: '100%', justifyContent: 'center' }}>
        <Col xs={12} md={8} lg={6}>
          {/* First Card - Rights and Onboarding */}
          <Card 
            className="mb-4 hover-effect option-card"
            onClick={() => navigate('/rights-and-onboarding')}
          >
            <Card.Body className="py-4">
              <div className="d-flex align-items-center">
                <div className="flex-shrink-0">
                  <i className="bi bi-info-circle text-info" style={{ fontSize: '2rem' }}></i>
                </div>
                <div className="ms-4 text-start">
                  <h3 className="mb-1">Your Rights</h3>
                  <p className="text-muted mb-0">Learn about your rights and the IEP process</p>
                </div>
              </div>
            </Card.Body>
          </Card>
          
          {/* Second Card - Upload IEP */}
          <Card 
            className="mb-4 hover-effect option-card"
            onClick={() => navigate('/iep-documents')}
          >
            <Card.Body className="py-4">
              <div className="d-flex align-items-center">
                <div className="flex-shrink-0">
                  <i className="bi bi-upload text-primary" style={{ fontSize: '2rem' }}></i>
                </div>
                <div className="ms-4 text-start">
                  <h3 className="mb-1">Upload IEP</h3>
                  <p className="text-muted mb-0">Upload and manage your IEP documents</p>
                </div>
              </div>
            </Card.Body>
          </Card>
          
          {/* Third Card - Summary and Translation */}
          <Card 
            className="hover-effect option-card"
            onClick={() => navigate('/summary-and-translations')}
          >
            <Card.Body className="py-4">
              <div className="d-flex align-items-center">
                <div className="flex-shrink-0">
                  <i className="bi bi-translate text-success" style={{ fontSize: '2rem' }}></i>
                </div>
                <div className="ms-4 text-start">
                  <h3 className="mb-1">Summary and Translation</h3>
                  <p className="text-muted mb-0">View summaries and translations of your IEP documents</p>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}