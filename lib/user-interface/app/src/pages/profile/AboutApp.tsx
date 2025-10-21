import React, { useEffect, useContext, useState } from 'react';
import { Container, Row, Col, Breadcrumb } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import './ProfileForms.css';
import './UpdateProfileName.css';
import './ProfileForms.css';
import './AboutApp.css';

export default function AboutApp() {
  const navigate = useNavigate();
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext!);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const data = await apiClient.team.getTeamMembersInfo();
      console.log("Team Members :",data?.team);
      if (data?.team) {
        setTeamMembers(data.team);
      }
    })();
  }, []);

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
        
        <div className="thank-you-image">
          <div className="thank-you-card">
            <h5>Thank you for advocating for children’s right to education!</h5>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod  tempor incididunt.</p>
          </div>
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
      
      </div>
    </>
  );
};