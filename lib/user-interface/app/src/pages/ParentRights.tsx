import React from 'react';
import MobileBottomNavigation from '../components/MobileBottomNavigation';
import { Container, Row, Col, Card, Accordion} from 'react-bootstrap';
import '../components/SupportCenter.css';
import { useLanguage } from '../common/language-context'; 

const ParentRights: React.FC = () => {
   // Multilingual FAQ data
   const faqsByLanguage = {
     // English (en) FAQs
     en: [
       {
         id: "0",
         question: "You can request a translator",
         answer: "You can request a translator for IEP meetings to ensure clear communication."
       },
       {
         id: "1",
         question: "You can take your time",
         answer: "You have the right to take your time before signing an IEP - you don\'t need to sign until you\'re ready."
       },
      {
         id: "2",
         question: "You can consent or not",
         answer: "You can consent to all, some, or none of the proposed services - your child won\'t receive new services without your approval."
       },
       {
         id: "3",
         question: "You can request a meeting",
         answer: "You have the right to request an IEP meeting at any time, not just at  the annual review, and the school must schedule it within 30 days."
       },
       {
         id: "4",
         question: "You can reschedule",
         answer: "If an administrator isn\'t present at the meeting, you have the right to reschedule for a time when they can attend."
       },
       {
         id: "5",
         question: "You must be given a booklet of your rights",
         answer: "By law, your case manager must provide you with a booklet of your parental rights before the IEP meeting."
       }
     ],
     
   };
 
   const { language } = useLanguage();
   
   // Use the selected language or fallback to English if the language is not supported
   const displayFaqs = faqsByLanguage['en'];
 
   // Get appropriate heading text based on language
   const getFaqHeaderText = () => {
    return 'Parent Rights';     
   };
 
   return (
     <>
       <Container className="faqs-container mt-3 mb-3">
         <Row className="mt-2">
           <Col>
             <Card className="faqs-card">
               <Row className="g-0">
                 <Col md={12} className="no-padding-inherit-faq">
                   <>
                     <h4 className="faqs-header mt-4 px-4">{getFaqHeaderText()}</h4>
                     <Accordion defaultActiveKey="0" className="mb-3 pb-5 faqs-accordion">
                       {displayFaqs.map((faq) => (
                         <Accordion.Item key={faq.id} eventKey={faq.id}>
                           <Accordion.Header>
                             {faq.question}
                           </Accordion.Header>
                           <Accordion.Body>
                             <div className="faq-content">
                               {faq.answer}
                             </div>
                           </Accordion.Body>
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

export default ParentRights; 