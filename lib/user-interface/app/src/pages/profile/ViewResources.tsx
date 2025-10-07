import { Container, Row, Col, Breadcrumb } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import MobileBottomNavigation from '../../components/MobileBottomNavigation';
import ViewResourcesButton from '../../components/ViewResourcesButton';
import './ChangeLanguage.css';
import './ProfileForms.css';
import './ViewResources.css';

export default function ViewResources() {
  const navigate = useNavigate();
  const handleBackClick = () => {
    navigate('/account-center');
  };

  return (
  <>
      <div>
      {/* Breadcrumbs */}
      <div className="mt-3 text-start px-4">
        <Breadcrumb>
          <Breadcrumb.Item onClick={handleBackClick}>SUPPORT CENTER</Breadcrumb.Item>
          <Breadcrumb.Item active>RESOURCES</Breadcrumb.Item>
        </Breadcrumb>
      </div>
      
      <Container 
        fluid 
        className="view-resources-container"
      >
        <Row style={{ width: '100%', justifyContent: 'center' }}>
          <Col xs={12} md={8} lg={6}>
            <div className="profile-form">
            <h4 className="update-profile-header">Resources</h4>
            <p className='resources-description'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod  tempor incididunt.</p>
            </div>
          </Col>
        </Row>
      </Container>
      <div className='resources-list-container'>
        <div className='resource'>
          <h5>Special Education Acronyms and Glossary of Terms and Definitions</h5>
          <p>SFUSD's Student Family School Resource Link supports students and families in navigating all of the SFUSD resources available to them.</p>
          <ViewResourcesButton />
        </div>
        <div className='resource'>
          <h5>Special Education Acronyms and Glossary of Terms and Definitions</h5>
          <p>SFUSD's Student Family School Resource Link supports students and families in navigating all of the SFUSD resources available to them.</p>
          <ViewResourcesButton />
        </div>
        <div className='resource'>
          <h5>Special Education Acronyms and Glossary of Terms and Definitions</h5>
          <p>SFUSD's Student Family School Resource Link supports students and families in navigating all of the SFUSD resources available to them.</p>
          <ViewResourcesButton />
        </div>
      </div>
    </div>
  <MobileBottomNavigation />
  </>
  );
}