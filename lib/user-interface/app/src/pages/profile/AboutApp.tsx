import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Container, Row, Col, Breadcrumb, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import { useLanguage } from '../../common/language-context';
import GoToWebsiteButton from '../../components/GoToWebsiteButton';
import MobileTopNavigation from '../../components/MobileTopNavigation';
import AIEPFooter from '../../components/AIEPFooter';
import './ProfileForms.css';
import './UpdateProfileName.css';
import './ProfileForms.css';
import './AboutApp.css';

interface AboutAppProps {
  NavigationComponent?: React.ComponentType;
  showBreadcrumbs?: boolean;
}

export default function AboutApp({ 
  NavigationComponent = MobileTopNavigation,
  showBreadcrumbs = true 
}: AboutAppProps = {}) {
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
      <NavigationComponent />
      <div>
      {/* Breadcrumbs - only show when enabled */}
      {showBreadcrumbs && (
        <div className="mt-3 text-start px-4 breadcrumb-container">
          <Breadcrumb>
            <Breadcrumb.Item onClick={handleBackClick}>{t("about.breadcrumb.supportCenter")}</Breadcrumb.Item>
            <Breadcrumb.Item active>{t("about.breadcrumb.about")}</Breadcrumb.Item>
          </Breadcrumb>
        </div>
      )}
    
        <Container 
          fluid 
          className="about-app-intro-container"
          >
          <Row style={{ width: '100%', justifyContent: 'center' }}>
            <Col xs={12} md={8} lg={6}>
              <div className="profile-form">
                <img src="/images/carousel/blissful.png" alt="" className="about-hero-image" />
                <h4 className="update-profile-header">The AI-EP Project: Designing AI <br/> with and for Communities</h4>   
              </div>  
            </Col>
          </Row>
        </Container>

        <div className='section-header section-header--about'>
          <h5>About The Project</h5>
        </div>

        <Container 
          fluid 
          className="about-app-intro-container"
          >
          <Row style={{ width: '100%', justifyContent: 'center' }}>
            <Col xs={12} md={8} lg={6}>
              <div className="profile-form">
                <p className='about-text'>With the support of the <a href="https://chanzuckerberg.com/" target="_blank" rel="noopener noreferrer">Chan Zuckerberg Initiative</a>, the <a href="https://burnes.northeastern.edu/" target="_blank" rel="noopener noreferrer">Burnes Center for Social Change</a>, its <a href="https://burnes.northeastern.edu/ai-for-impact-coop/" target="_blank" rel="noopener noreferrer">AI for Impact program</a>, and <a href="https://innovateschools.org/" target="_blank" rel="noopener noreferrer">Innovate Public Schools</a> are working with families in California and Massachusetts to use artificial intelligence to enhance educational outcomes for learners with disabilities. At the same time, we are learning how to develop public purpose AI with communities.</p> 
                <h4 className='about-app-header'>The Problem</h4>
                <p className='about-text'>With engagement from 1000+ parents, our team is building a free, open source AI-powered tool together with parents and caregivers that will : </p>
                <ul className='about-app-list'>
                  <li>Translate IEPs into multiple languages</li>
                  <li>Simplify complex educational jargon</li>
                  <li>Summarize key information</li>
                  <li>Enable natural conversation with the document through text or voice</li>
                  <li>Create personalized recommendations and meeting checklists</li>
                </ul>
                <p className='about-text'>We want to empower families to advocate effectively for their children's education. The Community-Centered AI project is about reimagining how AI is developed. By positioning affected communities as architects of their own solutions, we're working toward a future where responsible AI goes beyond mitigating risks and actively advances equity and empowerment.</p>
              
                <h4 className='about-app-header'>Our Research Questions</h4>
                <p className='about-text'>At the same time, we are studying : </p>
                <ul className='about-app-list'>
                  <li>How can we effectively educate community members about AI so they can meaningfully participate in its development? </li>
                  <li>What methods make co-design processes efficient and respectful of community members' time? </li>
                  <li>How can we leverage AI to amplify diverse community voices? </li>
                  <li>How can we translate community insights into practical technological solutions? </li>
                  <li>What strategies increase equity in AI design, especially for vulnerable populations?</li>
                </ul>
                <p className='about-text'>In addition to the free AIEP tool, the project will produce a course and curriculum for community AI training and a playbook for community-centered AI development.</p>
              
              </div>  
            </Col>
          </Row>
        </Container>

      <div className='about-app-all-content-container'>

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

          <div className='section-header section-header--team'>
            <h5> </h5>
          </div>

        <div className="about-app-partner-container">
          <div className='about-app-partner-container-text'>
            <h4 className='about-app-header'>About the GovLab</h4>
            <p className='about-text'>The GovLab’s mission is to improve people’s lives by changing the way we govern. Our goal is to strengthen the ability of institutions – including but not limited to governments – and people to work more openly, collaboratively, effectively and legitimately to make better decisions and solve public problems.</p>
            <GoToWebsiteButton url={"https://thegovlab.org/"} buttonText={t("about.goToWebsite")} />          </div>
          <div className='gov-lab-logo-container'>
              <img src="/images/the_govlab_logo 1.png" alt="The Gov Lab Logo" />
          </div>
        </div>

        <div className="about-app-partner-container">
          <div className='about-app-partner-container-text'>
            <h4 className='about-app-header'>About Innovate Public Schools</h4>
            <p className='about-text'>Innovate Public Schools is a nonprofit organization dedicated to building the capacity of parents and families to organize, advocate, and demand high quality schools for their children.</p>
            <GoToWebsiteButton url={"https://innovateschools.org/"} buttonText={t("about.goToWebsite")} />
          </div>
          <div className='innovate-schools-logo-container'>
              <img src="/images/innovate_logo.png" alt="Innovate Public Schools Logo" />
          </div>
        </div>

        <div className='privacy-policy-header section-header--privacy' onClick={() => navigate('/privacy-policy')}>
          <h5>{t("about.privacyPolicy")}</h5>
          <span className="arrow-icon">
            <img src="/images/arrow.svg" alt="" />
          </span>
        </div>

        <div className='bottom-space-about-app'>
        </div>
      </div>
      
      </div>
      <AIEPFooter />
    </>
  );
};