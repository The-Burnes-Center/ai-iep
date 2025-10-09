import { Container, Row, Col, Breadcrumb, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../common/language-context';
import MobileBottomNavigation from '../../components/MobileBottomNavigation';
import ViewResourcesButton from '../../components/ViewResourcesButton';
import './ChangeLanguage.css';
import './ProfileForms.css';
import './ViewResources.css';

export default function ViewResources() {
  const navigate = useNavigate();
  const { t, translationsLoaded } = useLanguage();
  
  const handleBackClick = () => {
    navigate('/support-center');
  };

  // Return loading state if translations aren't ready
  if (!translationsLoaded) {
    return (
      <Container className="view-resources-container mt-4 mb-5">
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }

  const resources = [
    {
      title: t("resources.toolkit.title"),
      description: t("resources.toolkit.description"),
      url: "https://www.disabilityrightsca.org/resources/special-education/special-education-basics-toolkit",
      buttonText: t("resources.buttonText")
    },
    {
      title: t("resources.walletCard.title"), 
      description: t("resources.walletCard.description"),
      url: "https://www.disabilityrightsca.org/publications/know-your-rights-wallet-card",
      buttonText: t("resources.buttonText")
    },
    {
      title: t("resources.advocacyTips.title"),
      description: t("resources.advocacyTips.description"),
      url: "https://www.disabilityrightsca.org/publications/17-special-education-advocacy-tips",
      buttonText: t("resources.buttonText")
    },
    {
      title: t("resources.rulaManual.title"),
      description: t("resources.rulaManual.description"),
      url: "https://rula.disabilityrightsca.org/",
      buttonText: t("resources.buttonText")
    }
  ];

  return (
  <>
      <div>
      {/* Breadcrumbs */}
      <div className="mt-3 text-start px-4">
        <Breadcrumb>
          <Breadcrumb.Item onClick={handleBackClick}>{t("resources.breadcrumb.supportCenter")}</Breadcrumb.Item>
          <Breadcrumb.Item active>{t("resources.breadcrumb.resources")}</Breadcrumb.Item>
        </Breadcrumb>
      </div>
      
      <Container 
        fluid 
        className="view-resources-container"
      >
        <Row style={{ width: '100%', justifyContent: 'center' }}>
          <Col xs={12} md={8} lg={6}>
            <div className="profile-form">
            <h4 className="update-profile-header">{t("resources.title")}</h4>
            <p className='resources-description'>{t("resources.description")}</p>
            </div>
          </Col>
        </Row>
      </Container>
      <div className='resources-list-container'>
        {resources.map((resource, index) => (
          <div key={index} className='resource'>
            <h5>{resource.title}</h5>
            <p>{resource.description}</p>
            <ViewResourcesButton url={resource.url} buttonText={resource.buttonText} />
          </div>
        ))}
      </div>
    </div>
  <MobileBottomNavigation />
  </>
  );
}