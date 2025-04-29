import React from 'react';
import { Container, Row, Col, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './SectionsTooltip.css';

const SectionsTooltip: React.FC = () => {
  const navigate = useNavigate();

  // Jargon terms and their definitions
  const jargons = {
    "Accommodations": "Adaptations made for specific individuals with disabilities when a product or service isn't accessible. These techniques and materials don't change the basic curriculum but do make learning a little easier and help students communicate what they know.",
    "Assessment": "Process of identifying strengths and needs to assist in educational planning; includes observation, record review, interviews, and tests to develop appropriate educational programs, and to monitor progress",
    "Assistive Technology": "Any item, piece of equipment, product or system used to increase, maintain, or improve the functional capabilities of a child with a disability.",
    "IEP": "An IEP is a plan developed to ensure that a child who has a disability identified under the law receives specialized instruction and related services.",
    "Informed Consent": "Agreement in writing from parents that they have been informed and understand implications of special education evaluation and program decisions; permission is voluntary and may be withdrawn.",
    "Occupational Therapy": "A related service that helps students improve fine motor skills and perform tasks needed for daily living and school activities.",
    "Speech": "A related service involving therapy to improve verbal communication abilities.",
    "Resiliency": "Ability to pursue personal goals and bounce back from challenges.",
    "Transition": "Process of preparing kids to function in future environments and emphasizing movement from one educational program to another.",
    "Accessibility": "The ability to access the functionality and benefit of a system or entity; describes how accessible a product or environment is to as many people as possible."
  };

  // Original summary text
  const summaryText = "Keiry Mejia is an 8-year-old student in 3rd grade with a primary eligibility of Autism and a secondary eligibility for Speech or Language Impairment. Her IEP identifies both strengths and areas that need improvement. Keiry is kind, friendly, imaginative, and motivated, enjoying music and drawing. Academically, her strengths include recognizing up to 100 sight words, using phonic decoding strategies, and identifying numbers up to 1,000. However, she has difficulties with reading comprehension, written communication, and math problem-solving, particularly with regrouping and understanding problem structure. In speech, she participates in both verbal and augmented (AAC device) communication but is often not understood, especially outside familiar contexts. Keiry's occupational therapy progress is positive—she manages fine motor tasks such as writing and cutting and is becoming more independent in daily self-care routines. Socially and emotionally, she is pleasant but may be easily distracted and sometimes struggles to stay on task. Her goals focus on improving reading comprehension, writing skills, math accuracy, spoken language intelligibility, and both receptive/expressive language development. Accommodations include visual supports, extra time for assignments, separate settings for assessments, technological aids for communication, and consistent adult support. Her placement is mostly in the general education classroom, with specialized instruction and therapies provided. Services include 300 min/week (5 hrs/week) of specialized academic instruction, 100 min/week (1 hr 40 min/week) of speech/language therapy, and 30 min/week of occupational therapy. Parents are actively involved, and consent to the IEP has been recorded. Keiry also qualifies for Extended School Year services to prevent learning regression.";

  // Function to highlight jargon terms with tooltips
  const highlightJargons = (text: string) => {
    let result = text;
    
    // Sort jargon terms by length (descending) to prevent substring matching issues
    const sortedJargonTerms = Object.keys(jargons).sort((a, b) => b.length - a.length);
    
    // Process each jargon term
    for (const term of sortedJargonTerms) {
      // Create a regular expression to find all occurrences of the term
      // Use word boundaries to match whole words only
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      
      // Replace each occurrence with a tooltipped span
      result = result.replace(regex, (match) => {
        return `<span class="jargon-term" data-term="${term}">${match}</span>`;
      });
    }
    
    return result;
  };

  // Process the summary with highlighted jargon terms
  const processedSummary = highlightJargons(summaryText);

  const handleBackClick = () => {
    navigate('/welcome-page');
  };

  // Render tooltip for a jargon term
  const renderTooltip = (term: string) => (
    <Tooltip id={`tooltip-${term}`}>
      {jargons[term]}
    </Tooltip>
  );

  return (
    <Container className="mt-4 mb-5">
      <div className="mt-3 text-start">
        <Button variant="outline-secondary" onClick={handleBackClick}>
          ← Back
        </Button>
      </div>
      <Row className="justify-content-center">
        <Col xs={12} md={10} lg={8}>
          <h2 className="mb-4">IEP Summary</h2>
          <div className="summary-container p-4">
            <p className="summary-text" 
               dangerouslySetInnerHTML={{ __html: processedSummary }}
               onClick={(e) => {
                 // Handle click on jargon terms
                 const target = e.target as HTMLElement;
                 if (target.classList.contains('jargon-term')) {
                   const term = target.getAttribute('data-term');
                   if (term) {
                     // You could show a modal or other UI element here if needed
                   }
                 }
               }}
               onMouseOver={(e) => {
                 // Handle mouseover for jargon terms
                 const target = e.target as HTMLElement;
                 if (target.classList.contains('jargon-term')) {
                   // Add active class or handle hover state
                   target.setAttribute('title', jargons[target.getAttribute('data-term') || '']);
                 }
               }}
            />
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default SectionsTooltip;