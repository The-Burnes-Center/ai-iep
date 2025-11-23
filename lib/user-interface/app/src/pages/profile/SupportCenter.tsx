import React from 'react';
import { useNavigate } from 'react-router-dom';
import MobileTopNavigation from '../../components/MobileTopNavigation';
import AIEPFooter from '../../components/AIEPFooter';
import { Container, Row, Col, Card, Accordion, Spinner} from 'react-bootstrap';
import { useLanguage } from '../../common/language-context';
import { IconArrowRight } from '@tabler/icons-react';
import './AccountCenter.css';

const SupportCenter: React.FC = () => {

  const { t, translationsLoaded } = useLanguage();

  const navigate = useNavigate();

  // Return loading state if translations aren't ready
  if (!translationsLoaded) {
    return (
      <Container className="account-center-container mt-4 mb-5">
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>        
        </div>
      </Container>
    );
  }

  // Navigation handler for accordion items
  const handleAccordionClick = (id: string) => {
    switch (id) {
      case '0':
        navigate('/frequently-asked-questions');
        break;
      case '1':
        navigate('/onboarding-user');
        break;
      case '2':
        navigate('/view-resources');
        break;
      case '3':
        navigate('/about-the-app');
        break;
      default:
        break;
    }
  };

  // FAQ data object
  const headers = [
    {
      id: "0",
      title: t("supportCenter.frequentlyAskedQuestions"),
    },
    {
      id: "1",
      title: t("supportCenter.goToOnboarding"),
    },
    {
      id: "2",
      title: t("supportCenter.resources"), 
    },
    {
      id: "3",
      title: t("supportCenter.aboutTheApp"),
    },
  ];

  return (
    <>
      <MobileTopNavigation />
      <Container className="account-center-container mt-3 mb-3">
        <Row className="mt-2">
          <Col>
            <Card className="account-center-card">
              <Row className="g-0">
                <Col md={12} className="no-padding-inherit-faq">
                  <>
                    <h4 className="account-center-header mt-4 px-4">{t("supportCenter.title")}</h4>
                    <Accordion className="support-center-accordion">
                      {headers.map((header) => (
                        <Accordion.Item key={header.id} eventKey={header.id}>
                          <Accordion.Header 
                            onClick={() => handleAccordionClick(header.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="accordion-title-content">
                              {header.title}
                              <IconArrowRight size={18} stroke={2} className="accordion-icon arrow-icon" />
                            </span>
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
      <AIEPFooter />
    </>
  );
};

export default SupportCenter;