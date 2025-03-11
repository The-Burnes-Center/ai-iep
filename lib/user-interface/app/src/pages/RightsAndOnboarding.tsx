import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Button } from 'react-bootstrap';
import './RightsAndOnboarding.css';

const RightsAndOnboarding: React.FC = () => {
  const navigate = useNavigate();


  const englishContent = {
    title: "Your Rights as a Parent",
    description: "Hi! We're here to help you understand your child's Individualized Education Program (IEP) better. Navigating this process can feel overwhelming, but you have important rights as a parent. Here are some things you should know:",
    bulletPoints: [
      "You can request a translator for IEP meetings to ensure clear communication.",
      "You have the right to take your time before signing an IEP - you don't need to sign until you're ready.",
      "You can consent to all, some, or none of the proposed services - your child won't receive new services without your approval.",
      "You have the right to request an IEP meeting at any time, not just at the annual review, and the school must schedule it within 30 days.",
      "If an administrator isn't present at the meeting, you have the right to reschedule for a time when they can attend.",
      "By law, your case manager must provide you with a booklet of your parental rights before the IEP meeting."
    ]
  };

  const handleBackClick = () => {
    navigate('/welcome-page');
  };


  return (
    <Container className="mt-4 mb-5">
      <div className="mt-3 text-start">
        <Button variant="secondary" onClick={handleBackClick}>
          ← Back
        </Button>
      </div>
      <Row>
        <Col>
          <div className="content-section rights-tab-content">
            <h2>{englishContent.title}</h2>
            <p>{englishContent.description}</p>
            <ul className="mt-3 rights-list">
              {englishContent.bulletPoints.map((point, index) => (
                <li key={index} className="mb-2">{point}</li>
              ))}
            </ul>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default RightsAndOnboarding;
