import React from 'react';
import MobileBottomNavigation from './MobileBottomNavigation';
import { Container, Row, Col, Card, Accordion} from 'react-bootstrap';
import './SupportCenter.css';

const SupportCenter: React.FC = () => {
  // FAQ data object
  const faqs = [
    {
      id: "0",
      question: "How do I log in?",
      answer: "When you log in, you'll receive a code by email to set a password or a one-time code for phone log ins. Only one option, either email or phone, will be active for your account."
    },
    {
      id: "1",
      question: "Do I need to end my session to erase my IEP completely?",
      answer: "The IEP is already deleted as soon as it's processed and the summary created."
    },
    {
      id: "2",
      question: "What happens to the summary of my IEP?",
      answer: "Your summary is saved securely in your account so you can come back to it anytime, even if you log out."
    },
    {
      id: "3",
      question: "Can I print my summary?",
      answer: "Yes! You can print your summary whenever you'd like."
    },
    {
      id: "4",
      question: "Who can see my IEP or summary?",
      answer: "Only you. The AIEP team cannot see your IEP, while it is being processed, or your summary."
    },
    {
      id: "5",
      question: "Is my data secure?",
      answer: "Yes. We take your privacy seriously. Your IEP file is deleted immediately after processing, and only you can see your summaries."
    },
    {
      id: "6",
      question: "Does AIEP keep my IEP file?",
      answer: "No. Your IEP file is deleted right after it's processed. The system only shows the file name so you know which document you uploaded, but the file itself is never stored. You don't need to do anything extra, your IEP is erased automatically after processing for your privacy."
    },
    {
      id: "7",
      question: "Does AIEP translate my IEP into my preferred language?",
      answer: "Not the full IEP. AIEP translates the summary of your IEP into the language you choose."
    },
    {
      id: "8",
      question: "Is the AIEP tool changing my child's IEP or their services?",
      answer: "No. The AIEP tool does not make any changes to your child's IEP or the services they receive. It only translates and summarizes the information already in the IEP to make it easier to understand."
    },
    {
      id: "9",
      question: "Can I use AIEP on my phone or tablet?",
      answer: "Yes! AIEP works on computers, phones, and tablets."
    },
    {
      id: "10",
      question: "What if I lose access to my account?",
      answer: "You can request a new login code through your registered email or phone number."
    },
    {
      id: "11",
      question: "How long will AIEP be free to use?",
      answer: "Always. AIEP is free for everyone."
    },
    {
      id: "12",
      question: "What is the difference between an IEP and a 504 Plan?",
      answer: "An Individualized Education Program (IEP) is a plan created under the Individuals with Disabilities Education Act (IDEA). It provides specialized instruction, services, and support to help a student meet their unique learning needs. A 504 Plan, on the other hand, is created under Section 504 of the Rehabilitation Act. It provides accommodations (like extra time on tests or preferential seating) so the student can access learning in the general classroom but does not include specialized instruction."
    },
    {
      id: "13",
      question: "Where can I get a copy of my child's IEP in PDF form?",
      answer: "You can request a copy directly from your child's case manager or the school's principal. They can provide you with the official PDF document and answer any questions you may have about it."
    }
  ];

  return (
    <>
      <Container className="faqs-container mt-3 mb-3">
        <Row className="mt-2">
          <Col>
            <Card className="faqs-card">
              <Row className="g-0">
                <Col md={12} className="no-padding-inherit-faq">
                  <>
                    <h4 className="faqs-header mt-4 px-4"> Frequently Asked Questions</h4>
                    <Accordion defaultActiveKey="0" className="mb-3 pb-5 faqs-accordion">
                      {faqs.map((faq) => (
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

export default SupportCenter;