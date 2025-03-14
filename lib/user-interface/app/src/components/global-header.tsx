import React, { useEffect, useState, useContext } from "react";
import { Navbar, Container, Nav, NavDropdown } from 'react-bootstrap';
import { Auth } from "aws-amplify";
import { AuthContext } from "../common/auth-context"; 
import { CHATBOT_NAME } from "../common/constants";
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './global-header.css';

export default function GlobalHeader() {
  const [userName, setUserName] = useState<string | null>(null);
  const { setAuthenticated } = useContext(AuthContext); 
  const navigate = useNavigate();

  // This useEffect hook runs once when the component mounts and checks if the user is authenticated
  // If the user is not authenticated then they are signed out
  // If they are authenticated we set their userName
  useEffect(() => {
    const fetchUserInfo = async () => {
      // Checks if there's a valid session with AWS Cognito
      const result = await Auth.currentAuthenticatedUser();
      
      // Sign out if there is no valid session
      if (!result || Object.keys(result).length === 0) {
        console.log("Signed out!")
        Auth.signOut();
        setAuthenticated(false);
        return;
      }

      // Gets user details from Cognito tokens
      const name = result?.signInUserSession?.idToken?.payload?.name;
      const email = result?.signInUserSession?.idToken?.payload?.email
      const userName = name? name : email;
      setUserName(userName);
    };

    fetchUserInfo();
  }, []);

  // When user signs out Auth.signOut() clears out all the tokens
  // The shared authentication state is updated to false
  // This triggers a re-render in AppConfigured which shows the LoginScreen
  const handleSignOut = async () => {
    try {
      navigate('/', { replace: true });
      await Auth.signOut();
      setAuthenticated(false);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Navbar 
      variant="dark" 
      expand="lg" 
      fixed="top"
      className="custom-navbar" // Using the custom CSS class
    >
      <Container fluid>
        <Navbar.Brand as={Link} to="/welcome-page" className="d-flex align-items-center">
          <span className="aiep-navbar">AIEP</span>
        </Navbar.Brand>
        
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
          <Nav>
            {userName && (
              <NavDropdown 
                title={
                  <span>
                    <i className="bi bi-person-circle me-1"></i>
                    {userName}
                  </span>
                } 
                id="user-dropdown"
                align="end"
              >
                <NavDropdown.Item onClick={handleSignOut}>
                  Sign out
                </NavDropdown.Item>
              </NavDropdown>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}