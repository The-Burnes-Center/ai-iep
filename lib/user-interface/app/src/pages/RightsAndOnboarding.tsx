import React, { useState } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Tabs, 
  Tab 
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLanguage } from '@fortawesome/free-solid-svg-icons';
import './RightsAndOnboarding.css';

const RightsAndOnboarding: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('spanish');

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

  const spanishContent = {
    title: "Sus Derechos como Padre",
    description: "¡Hola! Estamos aquí para ayudarle a entender mejor el Programa de Educación Individualizada (IEP) de su hijo. Navegar por este proceso puede resultar abrumador, pero usted tiene derechos importantes como padre. Aquí hay algunas cosas que debe saber:",
    bulletPoints: [
      "Puede solicitar un traductor para las reuniones del IEP para garantizar una comunicación clara.",
      "Tiene derecho a tomarse su tiempo antes de firmar un IEP - no necesita firmar hasta que esté listo.",
      "Puede dar su consentimiento a todos, algunos o ninguno de los servicios propuestos - su hijo no recibirá nuevos servicios sin su aprobación.",
      "Tiene derecho a solicitar una reunión del IEP en cualquier momento, no solo en la revisión anual, y la escuela debe programarla dentro de los 30 días.",
      "Si un administrador no está presente en la reunión, tiene derecho a reprogramarla para un momento en que pueda asistir.",
      "Por ley, su gestor de casos debe proporcionarle un folleto de sus derechos parentales antes de la reunión del IEP."
    ]
  };

  return (
    <Container className="mt-4 mb-5">
      <Row>
        <Col>
        <p></p>
          {/* <h1>Rights and Onboarding</h1>
          <p className="lead">
            Learn about your rights and the IEP process.
          </p>
           */}
          <div className="tab-container">
            <Tabs
              activeKey={activeTab}
              onSelect={(k) => k && setActiveTab(k)}
              className="mb-4 rights-nav-tabs"
            >        
              <Tab eventKey="english" title="English">
                <div className="content-section rights-tab-content">
                  <h2>{englishContent.title}</h2>
                  <p>{englishContent.description}</p>
                  <ul className="mt-3 rights-list">
                    {englishContent.bulletPoints.map((point, index) => (
                      <li key={index} className="mb-2">{point}</li>
                    ))}
                  </ul>
                </div>
              </Tab>
            </Tabs>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default RightsAndOnboarding;