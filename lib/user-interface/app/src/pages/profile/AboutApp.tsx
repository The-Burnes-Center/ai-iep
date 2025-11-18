import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Container, Row, Col, Breadcrumb, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import { useLanguage } from '../../common/language-context';
import GoToWebsiteButton from '../../components/GoToWebsiteButton';
import MobileBottomNavigation from '../../components/MobileBottomNavigation';
import './ProfileForms.css';
import './UpdateProfileName.css';
import './ProfileForms.css';
import './AboutApp.css';

export default function AboutApp() {
  const navigate = useNavigate();
  const appContext = useContext(AppContext);
  const { t, translationsLoaded } = useLanguage();

  const apiClient = new ApiClient(appContext!);

  // TODO : Handle loading and error handling
  const { data } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: async () => {
      const response = await apiClient.team.getTeamMembersInfo();
      return response?.team || [];
    },
  });

  const teamMembers = data || [];

  const handleBackClick = () => {
    navigate('/support-center');
  };

  // Return loading state if translations aren't ready
  if (!translationsLoaded) {
    return (
      <Container className="mt-4 mb-5">
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }

  return (
    <>
      <MobileBottomNavigation />
      <div>
      {/* Breadcrumbs */}
      <div className="mt-3 text-start px-4 breadcrumb-container">
        <Breadcrumb>
          <Breadcrumb.Item onClick={handleBackClick}>{t("about.breadcrumb.supportCenter")}</Breadcrumb.Item>
          <Breadcrumb.Item active>{t("about.breadcrumb.about")}</Breadcrumb.Item>
        </Breadcrumb>
      </div>
    
        <Container 
          fluid 
          className="about-app-intro-container"
          >
          <Row style={{ width: '100%', justifyContent: 'center' }}>
            <Col xs={12} md={8} lg={6}>
              <div className="profile-form">
                <h4 className="update-profile-header">{t("about.title")}</h4>
                <p className='update-profile-description'>{t("about.description")}</p> 
              </div>  
            </Col>
          </Row>  
        </Container>

      <div className='about-app-all-content-container'>
        <div className='section-header section-header--innovate'>
          <h5>{t("about.thankYouParents")}</h5>
        </div>
          
          <div className="thank-you-image">
            <div className="thank-you-card">
              <h5>{t("about.thankYouAdvocating")}</h5>
              <p>{t("about.thankYouMessage")}</p>
            </div>
          </div>

          <div className='section-header section-header--team'>
            <h5>{t("about.theTeam")}</h5>
          </div>

          <div className='team-members-list-container'>
            {teamMembers.map((member) => (
              <div key={member.id} className='team-member-item'>
                <div className='team-member-item-image'>
                  <img 
                    src={`https://directus.theburnescenter.org/assets/${member.thumbnail?.filename_disk}`}
                    alt={`${member.first_name} ${member.last_name}`}
                  />
                </div>
                <div className='team-member-item-content'>
                  <h5>{member.first_name} {member.last_name}</h5>
                  <p>{member.title}</p>
                </div>
              </div>
            ))}
        </div>

        <div className='section-header section-header--innovate'>
          <h5>{t("about.aboutInnovatePublicSchools")}</h5>
        </div>
        <div className='about-partners-container'>
        <div className='innovate-schools-logo-container'>
          <img src="/images/innovate_logo.png" alt="Innovate Public Schools Logo" />
        </div>
          <p>
            {t("about.innovatePublicSchoolsDescription")}
          </p>
          <GoToWebsiteButton url={"https://innovateschools.org/"} buttonText={t("about.goToWebsite")} />
        </div>

        <div className='section-header section-header--innovate'>
          <h5>{t("about.aboutTheGovLab")}</h5>
        </div>
        <div className='about-partners-container'>
        <div className='gov-lab-logo-container'>
          <img src="/images/the_govlab_logo 1.png" alt="The Gov Lab Logo" />
        </div>
          <p>
            {t("about.theGovLabDescription")}
          </p>
          <GoToWebsiteButton url={"https://thegovlab.org/"} buttonText={t("about.goToWebsite")} />
        </div>
        <div className='section-header section-header--privacy' onClick={() => navigate('/privacy-policy')}>
          <h5>{t("about.privacyPolicy")}</h5>
          <span className="arrow-icon">
            <img src="/images/arrow.svg" alt="" />
          </span>
        </div>
        <div className='bottom-space-about-app'>
        </div>
      </div>
      
      </div>
    </>
  );
};