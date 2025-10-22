import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Container, Row, Col, Breadcrumb } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import GoToWebsiteButton from '../../components/GoToWebsiteButton';
import './ProfileForms.css';
import './UpdateProfileName.css';
import './ProfileForms.css';
import './AboutApp.css';

export default function AboutApp() {
  const navigate = useNavigate();
  const appContext = useContext(AppContext);

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

  return (
    <>
      <div>
      {/* Breadcrumbs */}
      <div className="mt-3 text-start px-4">
        <Breadcrumb>
          <Breadcrumb.Item onClick={handleBackClick}>SUPPORT CENTER</Breadcrumb.Item>
          <Breadcrumb.Item active>ABOUT</Breadcrumb.Item>
        </Breadcrumb>
      </div>
    
        <Container 
          fluid 
          className="about-app-intro-container"
          >
          <Row style={{ width: '100%', justifyContent: 'center' }}>
            <Col xs={12} md={8} lg={6}>
              <div className="profile-form">
                <h4 className="update-profile-header">About The Project</h4>
                <p className='update-profile-description'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod  tempor incididunt.</p> 
              </div>  
            </Col>
          </Row>  
        </Container>

      <div className='section-header section-header--innovate'>
        <h5>Thank you, parents!</h5>
      </div>
        
        <div className="thank-you-image">
          <div className="thank-you-card">
            <h5>Thank you for advocating for children’s right to education!</h5>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod  tempor incididunt.</p>
          </div>
        </div>

        <div className='section-header section-header--team'>
          <h5>The team</h5>
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
        <h5>About Innovate Public Schools</h5>
      </div>
      <div className='about-partners-container'>
        <p>
          Innovate Public Schools is a nonprofit organization dedicated to  building the
capacity of parents and families to organize, advocate, and demand high quality schools for their children.
        </p>
        <GoToWebsiteButton url={"https://innovateschools.org/"} buttonText={"GO TO WEBSITE"} />
      </div>

      <div className='section-header section-header--innovate'>
        <h5>About The Gov Lab</h5>
      </div>
      <div className='about-partners-container'>
        <p>
The GovLab’s mission is  to improve people’s lives by changing the way we govern. Our goal is to strengthen the ability of institutions –  including but not limited to governments – and people to work more  openly, collaboratively, effectively and legitimately to make better  decisions and solve public problems.
        </p>
        <GoToWebsiteButton url={"https://thegovlab.org/"} buttonText={"GO TO WEBSITE"} />
      </div>
      
      </div>
    </>
  );
};