import React, { useEffect, useState, useContext } from "react";
import { Navbar, Container, Nav, Button } from 'react-bootstrap';
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
  const [showMenu, setShowMenu] = useState(false);

  // This useEffect hook runs once when the component mounts and checks if the user is authenticated
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

    // Add click event listener to close menu when clicking outside
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest('.menu-container')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMenu]);

  // When user signs out Auth.signOut() clears out all the tokens
  const handleSignOut = async () => {
    try {
      navigate('/', { replace: true });
      await Auth.signOut();
      setAuthenticated(false);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  return (
    <Navbar 
      variant="dark" 
      expand="lg" 
      fixed="top"
      className="custom-navbar"
    >
      <Container fluid>
        <Navbar.Brand as={Link} to="/welcome-page" className="d-flex align-items-center">
          <span className="aiep-navbar">AIEP</span>
        </Navbar.Brand>
        
        {/* Mobile hamburger button */}
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
          <Nav>
            {/* For mobile view - appears when navbar is expanded */}
            <Nav.Link 
              className="d-lg-none" 
              onClick={handleSignOut}
            >
              Sign out
            </Nav.Link>
            
            {/* For desktop view - custom hamburger menu */}
            <div className="d-none d-lg-block menu-container">
              <Button 
                variant="link" 
                className="hamburger-button" 
                onClick={toggleMenu}
              >
                <i className="bi bi-list"></i>
              </Button>
              
              {showMenu && (
                <div className="custom-dropdown-menu">
                  <div 
                    className="custom-dropdown-item" 
                    onClick={handleSignOut}
                  >
                    Sign out
                  </div>
                </div>
              )}
            </div>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}