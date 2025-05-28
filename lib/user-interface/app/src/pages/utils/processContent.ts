import { marked } from 'marked';
import DOMPurify from 'dompurify';

  // Jargon terms dictionary
  const jargonDictionary = {
    "Accommodations": "Adaptations made for specific individuals with disabilities when a product or service isn't accessible. These techniques and materials don't change the basic curriculum but do make learning a little easier and help students communicate what they know.",
    "Assessment": "Process of identifying strengths and needs to assist in educational planning; includes observation, record review, interviews, and tests to develop appropriate educational programs, and to monitor progress",
    "Assistive Technology": "Any item, piece of equipment, product or system used to increase, maintain, or improve the functional capabilities of a child with a disability.",
    "IEP": "An IEP is a plan developed to ensure that a child who has a disability identified under the law receives specialized instruction and related services.",
    "Informed Consent": "Agreement in writing from parents that they have been informed and understand implications of special education evaluation and program decisions; permission is voluntary and may be withdrawn.",
    "Occupational Therapy": "A related service that helps students improve fine motor skills and perform tasks needed for daily living and school activities.",
    "Speech Therapy": "A related service involving therapy to improve verbal communication abilities.",
    "Resiliency": "Ability to pursue personal goals and bounce back from challenges.",
    "Transition": "Process of preparing kids to function in future environments and emphasizing movement from one educational program to another.",
    "Accessibility": "The ability to access the functionality and benefit of a system or entity; describes how accessible a product or environment is to as many people as possible."
  };

// Process markdown content and add jargon tooltips
  const processContent = (content: string, processJargon: boolean = true): string => {
    if (!content) return '';
    
    // Convert markdown to HTML - ensure we get a string, not a Promise
    const htmlContent = marked.parse(content);
    
    // Process jargon terms if needed and ensure htmlContent is a string
    if (processJargon && typeof htmlContent === 'string') {
      // Create a safe copy of the content to process
      let processedContent = htmlContent;
      
      // Process each jargon term
      Object.keys(jargonDictionary).forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        processedContent = processedContent.replace(regex, 
          `<span class="jargon-term" data-tooltip="${jargonDictionary[term]}">$&</span>`);
      });
      
      // Return sanitized HTML
      return DOMPurify.sanitize(processedContent);
    }
    
    // If htmlContent is a Promise or processJargon is false, just sanitize and return
    return DOMPurify.sanitize(typeof htmlContent === 'string' ? htmlContent : '');
  };

  export default processContent;