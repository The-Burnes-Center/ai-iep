import React, { useEffect, useContext, useState } from 'react';  // Added useState
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Auth } from 'aws-amplify';
import { AuthContext } from '../common/auth-context';
import { useNavigate } from 'react-router-dom';

export default function WelcomePage() {
  const { setAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>('');  // Added state for email

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
    <Container fluid 
      style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '64px'
      }}
    >
      <Row style={{ width: '100%', justifyContent: 'center' }}>
        <Col xs={12} md={8} lg={6}>
          <Card 
            style={{ 
              textAlign: 'center',
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
              border: 'none',
              borderRadius: '8px'
            }}
          >
            <Card.Body style={{ padding: '3rem' }}>
              <h1 style={{ 
                marginBottom: '1.5rem', 
                color: '#0073bb',
                fontSize: '2.5rem',
                fontWeight: 'bold'
              }}>
                Welcome to AI-EP
              </h1>
              <p style={{ 
                color: '#6c757d',
                fontSize: '1.1rem',
                marginBottom: '1rem'
              }}>
                Hello {userEmail}
              </p>
              <p style={{ 
                color: '#6c757d',
                fontSize: '1.1rem'
              }}>
                Your session has been authenticated successfully.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}