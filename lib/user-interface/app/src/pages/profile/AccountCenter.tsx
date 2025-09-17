import React from 'react';
import { useNavigate } from 'react-router-dom';
import MobileBottomNavigation from '../../components/MobileBottomNavigation';
import { Container, Row, Col, Card, Accordion} from 'react-bootstrap';
import './AccountCenter.css';

const AccountCenter: React.FC = () => {
  const navigate = useNavigate();

  // Navigation handler for accordion items
  const handleAccordionClick = (id: string) => {
    switch (id) {
      case '0':
        navigate('/update-profile');
        break;
      // Future accordion items can be handled here
      // case '1':
      //   navigate('/change-language');
      //   break;
      // case '2':
      //   navigate('/delete-account');
      //   break;
      // case '3':
      //   // Handle logout functionality
      //   break;
      default:
        break;
    }
  };

  // FAQ data object
  const headers = [
    {
      id: "0",
      title: "Update Your Profile",
    },
    {
      id: "1",
      title: "Change your Language",
    },
    {
      id: "2",
      title: "Delete your account",
    },
    {
      id: "3",
      title: "Log out",
    }
  ];

  return (
    <>
      <Container className="account-center-container mt-3 mb-3">
        <Row className="mt-2">
          <Col>
            <Card className="account-center-card">
              <Row className="g-0">
                <Col md={12} className="no-padding-inherit-faq">
                  <>
                    <h4 className="account-center-header mt-4 px-4"> Account Center</h4>
                    <Accordion className="mb-3 pb-5 account-center-accordion">
                      {headers.map((header) => (
                        <Accordion.Item key={header.id} eventKey={header.id}>
                          <Accordion.Header 
                            onClick={() => handleAccordionClick(header.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            {header.title}
                          </Accordion.Header>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  </>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Container>
      <MobileBottomNavigation />
    </>
  );
};

export default AccountCenter;