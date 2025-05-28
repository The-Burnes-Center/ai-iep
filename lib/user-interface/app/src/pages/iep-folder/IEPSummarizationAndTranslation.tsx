import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Spinner, 
  Alert, 
  Button,
  Badge,
  Accordion,
  Tabs,
  Tab,
  Offcanvas
} from 'react-bootstrap';
import { AppContext } from '../../common/app-context';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import { faFileAlt, faClock, faCheckCircle, faExclamationTriangle, faLanguage } from '@fortawesome/free-solid-svg-icons';
import './IEPSummarizationAndTranslation.css';
import { IEPDocument, IEPSection } from '../../common/types';
import { useLanguage } from '../../common/language-context';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const IEPSummarizationAndTranslation: React.FC = () => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  const { t, language, translationsLoaded } = useLanguage();
  
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showJargonDrawer, setShowJargonDrawer] = useState(false);
  const [selectedJargon, setSelectedJargon] = useState<{term: string, definition: string} | null>(null);

  const [document, setDocument] = useState<IEPDocument>({
    documentId: undefined,
    documentUrl: undefined,
    status: undefined,
    summaries: {
      en: '',
      es: '',
      vi: '',
      zh: ''
    },
    document_index: {
      en: '',
      es: '',
      vi: '',
      zh: ''
    },
    sections: {
      en: [],
      es: [],
      vi: [],
      zh: []
    }
  });
  
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>('en');
  const navigate = useNavigate();
  
  // Reference to store the polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef<boolean>(true);

  const preferredLanguage = language || 'en';

  // Jargon terms dictionary
  const jargonDictionary = {
    "Abeyance": "An abeyance is a temporary halt to something, with the emphasis on \"temporary.\"",
    "Accessibility": "Accessibility is the “ability to access” the functionality and benefit of some system or entity. This term is used to describe the degree to which a product (such as a device, a service, or an environment) is accessible by as many people as possible.",
    "Accommodations": "Accommodations are adaptations made for specific individuals with disabilities (as defined by law) when a product or service isn’t accessible. These techniques and materials don’t change the basic curriculum but do make learning a little easier and help students communicate what they know.",
    "Achievement Tests": "Measures of acquired knowledge in academic skills, such as reading, math, writing, and science.",
    "Adaptive Software": "Adaptive software is any software or program that builds a model of the preferences, goals, and knowledge of each individual student and uses that model throughout the interaction with the student in order to adapt to that student’s assessed needs.",
    "Advocacy": "Recognizing and communicating needs, rights, and interests on behalf of a child; making informed choices.",
    "Alternative Dispute Resolution": "Alternative Dispute Resolution (ADR) is a mediation for the resolution of complaints between parents and school district personnel in a cooperative forum of problem-solving conducted by skilled neutral facilitators who are not SFUSD employees.",
    "Americans with Disabilities Act": "The ADA is a federal civil rights law that provides legal protections for individuals with disabilities from discrimination in employment, state and local government, public accommodations, commercial facilities, telecommunications, and transportation. Title II of the ADA requires schools to make educational opportunities, extracurricular activities, and facilities open and accessible to all students. These provisions apply to brick-and-mortar and online schooling.",
    "Assessment": "Process of identifying strengths and needs to assist in educational planning; includes observation, record review, interviews, and tests to develop appropriate educational programs, and to monitor progress",
    "Assessment Plan": "The description of the battery of tests (psychological, achievement, language, etc.) to be used in a particular student's assessment.",
    "Assistive Technology": "Assistive technology (AT) is any item, piece of equipment, product or system, whether acquired commercially off the shelf, modified, or customized, that is used to increase, maintain, or improve the functional capabilities of a child with a disability.",
    "Auditory Discrimination": "Ability to identify differences between words and sounds that are similar.",
    "Collaboration": "Working in partnership on behalf of a child, e.g., parent and teacher, or special education teacher and general education teacher.",
    "Compliance Complaint": "Complaint filed with the state department of education or local school district by a person who feels that an educational law has been broken.",
    "Discrepancy": "Difference between two tests, such as between measures of a child’s intellectual ability and their academic achievement",
    "Distance Learning": "Distance learning involves how students engage in learning and make academic progress when they are not physically present in schools. This is accomplished using a variety of digital and print resources, and differentiated modes of interaction with teachers and peers, when possible. How teachers engage students in distance learning is informed by the student’s access to technology and the internet.",
    "Due Process": "Procedural safeguards to protect the rights of the parent/guardian and the child under federal and state laws and regulations for special education; includes voluntary mediation or a due process hearing to resolve differences with the school.",
    "Dysarthria": "Difficult or unclear articulation of speech usually occurs when the muscles you use for speech are weak or you have difficulty controlling them; affects ability to pronounce sounds correctly.",
    "Dyscalculia": "Difficulty in understanding numbers which can impact basic math skills; trouble calculating.",
    "Dysgraphia": "Difficulty writing legibly with age-appropriate speed.",
    "Dyslexia": "Difficulty in learning to read or interpret words, letters, and other symbols. Can make reading, writing, spelling, listening, speaking, and math challenging.",
    "Dysnomia": "Difficulty remembering names or recalling specific words; word-finding problems.",
    "Dyspraxia": "Difficulty performing and sequencing fine motor movements, such as buttoning.",
    "IEP": "An IEP is a plan developed to ensure that a child who has a disability identified under the law receives specialized instruction and related services.",
    "Informed Consent": "Agreement in writing from parents that they have been informed and understand implications of special education evaluation and program decisions; permission is voluntary and may be withdrawn.",
    "Least restrictive environment": "A term meaning that children with disabilities must be educated (to the maximum extent appropriate) with children without disabilities.",
    "Modification": "Modifications are changes in the delivery, content, or instructional level of a subject or test. They result in changed or lowered expectations and create a different standard for kids with disabilities than for those without disabilities.",
    "Multidisciplinary Team": "Professionals with different training and expertise; may include, but is not limited to, any combination of the following public school personnel — general education teacher, special education teacher, administrator, school psychologist, speech and language therapist, counselor — and the parent.",
        "Occupational Therapy": "A related service that helps students improve fine motor skills and perform tasks needed for daily living and school activities.",

    "Primary Language": "Language that the child first learned, or the language that’s spoken in the home.",
    "Prior Written Notice": "A Prior Written Notice (PWN) is a document that informs (provides notice to) a parent/guardian/education rights holder of actions that the school intends to take in regard to their child’s Individualized Education Program. It is important that parents understand what the school plans to do (or not do) for their child.",
    "Procedural Safeguards": "Legal requirements that ensure parents and kids will be treated fairly and equally in the decision-making process about special education.",
    "Progress Reports": "Progress Reports must, at a minimum: inform parents of their child's progress toward each annual goal; determine whether progress is sufficient for their child to achieve the goals by the annual IEP due date; must be reported on when report cards are sent out ( a copy must be sent home to parent/guardian)",
    "Pupil Records": "Personal information about the child that is kept by the school system and is available for review by legal guardians and others directly involved in their education.",
    "Resiliency": "Ability to pursue personal goals and bounce back from challenges.",
    "Resource Specialist Program": "Students who can participate in regular education may also receive special education instruction in the RSP. These students can receive services within the classroom, or can be \"pulled out\" of the regular education classroom for special assistance during specific periods of the day or week and are taught by credentialed teachers with resource specialist authorization.",
    "Retention": "The practice of having a student repeat a certain grade-level (year) in school; also called grade retention.",
    "SB 117": "SB-117 is emergency legislation signed by Governor Newsom on March 17, 2020. SB-117 waived certain special education timelines in California, such as sending an assessment plan or responding to records requests.",
    "Section 504 of the Rehabilitation Act": "Section 504 of the Rehabilitation Act prohibits discrimination in the education of children and youth with disabilities; vocational education; college and other post-secondary programs; employment; health, welfare and other social programs; and other programs and activities that receive federal funds.",
    "Self-Advocacy": "Child’s ability to explain specific learning needs and seek necessary assistance or accommodations.",
    "SOAR Academy": "SOAR is a special education setting that is designed to support students whose disabilities significantly impact their emotional regulation, social skills, and behaviors. SOAR stands for Success, Opportunity, Achievement and Resilience.",
    "Special Day Class": "Students in Special Day Classes (SDC) are enrolled in self-contained special education classes. They are assigned to these classes by their IEP eligibility and receive support from the Special Day Class teacher and the support staff.",
    "Special Education": "Specially designed instruction to meet the unique needs of eligible kids whose educational needs can’t be met through modification of the regular instructional program; provides for a range of options for services, such as pull out programs, special day classes; available to kids enrolled in public schools.",
    "Special Education Local Plan Area ": "The county office from which some special education services are funded; SFUSD is both a local school district and the county office for San Francisco.",
    "Specialized Academic Instruction": "Specialized academic instruction (SAI) is determined by the IEP team and is derived from assessment information, data collected, and goals/objectives developed in the student's area(s) of need. Each student's educational needs are unique; thus, SAI and services may vary greatly between students.",
    "Speech Therapy": "A related service involving therapy to improve verbal communication abilities.",
    "Student Success Team": "A regular education process designed to make preliminary modifications within the regular education program of a student not succeeding in class. Each SST is to meet on a weekly basis.",
    "Transition": "Process of preparing kids to function in future environments and emphasizing movement from one educational program to another, such as from elementary school to middle school, or from school to work.",
    "Universal Design for Learning": "UDL is a way to optimize teaching to effectively instruct a diverse group of learners. The approach is based on insights from the science of how people learn. It emphasizes accessibility in how students access material, engage with it, and show what they have learned. UDL can be applied to in-person or virtual educational settings.",
    "Visual Processing": "Ability to interpret visual information",
  };

  // Configure minimal marked options that are type-safe
  marked.setOptions({
    gfm: true,
    breaks: true
  });

  // Section configuration with translations
  const sectionConfigRef = useRef([
    { apiName: "Student Information", englishName: "About Student", displayName: t('sections.studentInfo') },
    { apiName: "Accommodations", englishName: "Accommodations", displayName: t('sections.accommodations') },
    { apiName: "Goals", englishName: "Goals", displayName: t('sections.goals') },
    { apiName: "Services", englishName: "Services", displayName: t('sections.services') },
    { apiName: "Placement", englishName: "Placement", displayName: t('sections.placement') },
    { apiName: "Present Levels", englishName: "Present Levels of Performance", displayName: t('sections.presentLevels') },
    { apiName: "Eligibility", englishName: "Eligibility", displayName: t('sections.eligibility') },
    { apiName: "Informed Consent", englishName: "Informed Consent", displayName: t('sections.informedConsent') },
    { apiName: "Assistive Technology", englishName: "Assistive Technology", displayName: t('sections.assistiveTechnology') },
    { apiName: "State Testing", englishName: "State Testing", displayName: t('sections.stateTesting') }
  ]);

  // Handle jargon click
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('jargon-term')) {
      e.preventDefault();
      const term = target.textContent || '';
      const definition = target.getAttribute('data-tooltip') || '';
      setSelectedJargon({ term, definition });
      setShowJargonDrawer(true);
    }
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
  
  // Update section config with translations when language changes
  useEffect(() => {
    if (translationsLoaded) {
      sectionConfigRef.current = [
        { apiName: "Student Information", englishName: "About Student", displayName: t('sections.studentInfo') },
        { apiName: "Accommodations", englishName: "Accommodations", displayName: t('sections.accommodations') },
        { apiName: "Goals", englishName: "Goals", displayName: t('sections.goals') },
        { apiName: "Services", englishName: "Services", displayName: t('sections.services') },
        { apiName: "Placement", englishName: "Placement", displayName: t('sections.placement') },
        { apiName: "Present Levels", englishName: "Present Levels of Performance", displayName: t('sections.presentLevels') },
        { apiName: "Eligibility", englishName: "Eligibility", displayName: t('sections.eligibility') },
        { apiName: "Informed Consent", englishName: "Informed Consent", displayName: t('sections.informedConsent') },
        { apiName: "Assistive Technology", englishName: "Assistive Technology", displayName: t('sections.assistiveTechnology') },
        { apiName: "State Testing", englishName: "State Testing", displayName: t('sections.stateTesting') }
      ];
      
      // Reprocess sections if document is already loaded
      if (document && document.status === "PROCESSED") {
        processDocumentSections(document);
      }
    }
  }, [t, translationsLoaded]);

  const getDisplayName = (apiName: string, useTranslation: boolean = false): string => {
    const config = sectionConfigRef.current.find(s => 
      s.apiName === apiName || 
      s.englishName === apiName || 
      apiName.toLowerCase().includes(s.apiName.toLowerCase())
    );
    
    if (!config) return apiName;
    return useTranslation ? config.displayName : config.englishName;
  };

  // Function to sort sections by predefined order
  const sortSections = (sections: IEPSection[]) => {
    return [...sections].sort((a, b) => {
      const indexA = sectionConfigRef.current.findIndex(s => 
        s.apiName === a.name || 
        s.englishName === a.name ||
        a.name.toLowerCase().includes(s.apiName.toLowerCase())
      );
      const indexB = sectionConfigRef.current.findIndex(s => 
        s.apiName === b.name || 
        s.englishName === b.name ||
        b.name.toLowerCase().includes(s.apiName.toLowerCase())
      );
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
  };

  // Process document sections for a specific language
  const processLanguageSections = (doc: any, lang: string) => {
    if (!doc || doc.status !== "PROCESSED") return;
    
    if (doc.sections && doc.sections[lang]) {
      try {
        const extractedSections = [];
        
        if (Array.isArray(doc.sections[lang])) {
          console.log(`Processing ${lang} sections as array`);
          doc.sections[lang].forEach(section => {
            if (section.title && section.content) {
              extractedSections.push({
                name: section.title,
                displayName: getDisplayName(section.title, lang !== 'en'),
                content: section.content,
                pageNumbers: section.page_numbers || []
              });
            }
          });
        }
        
        const orderedSections = sortSections(extractedSections);
        console.log(`Processed ${lang} sections:`, orderedSections);
        
        setDocument(prev => ({
          ...prev, 
          sections: { 
            ...prev.sections,
            [lang]: orderedSections
          }
        }));
      } catch (e) {
        console.error(`Error processing ${lang} sections:`, e);
        setDocument(prev => ({
          ...prev, 
          sections: { 
            ...prev.sections,
            [lang]: []
          }
        }));
      }
    } else {
      console.log(`No ${lang} sections found`);
      setDocument(prev => ({
        ...prev, 
        sections: { 
          ...prev.sections,
          [lang]: []
        }
      }));
    }
  };

  // Process all document sections
  const processDocumentSections = (doc: any) => {
    // Process English sections first
    processLanguageSections(doc, 'en');
    
    // Process preferred language if it's not English
    if (preferredLanguage !== 'en') {
      processLanguageSections(doc, preferredLanguage);
    }
  };

  // Function to start polling if document is processing
  const startPollingIfProcessing = (doc: any) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (doc && doc.status === "PROCESSING") {
      console.log("Document is processing. Starting polling...");
      pollingIntervalRef.current = setInterval(() => {
        console.log("Polling for updates...");
        setRefreshCounter(prev => prev + 1);
      }, 5000);
    }
  };

  // Fetch document data
  useEffect(() => {
    if (!translationsLoaded) return;
    
    const fetchDocument = async () => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
      }
      
      try {
        const retrievedDocument = await apiClient.getMostRecentDocumentWithSummary();
        console.log("Fetched document data:", retrievedDocument);
        
        if (retrievedDocument) {
          setDocument(prev => {
            if (!prev || 
                prev.status !== retrievedDocument.status || 
                prev.createdAt !== retrievedDocument.createdAt) {
              return {
                ...retrievedDocument,
                sections: {
                  ...prev.sections, // Keep existing processed sections
                  ...(retrievedDocument.sections || {}) // Add new sections if available
                }
              };
            }
            return prev;
          });
          
          startPollingIfProcessing(retrievedDocument);
          
          if (retrievedDocument.status === "PROCESSED") {
            // Set summaries
            const newSummaries = { ...document.summaries };
            
            // Update each available language summary
            if (retrievedDocument.summaries) {
              Object.keys(retrievedDocument.summaries).forEach(lang => {
                if (retrievedDocument.summaries[lang]) {
                  newSummaries[lang] = retrievedDocument.summaries[lang];
                }
              });
            }
            
            // Set document index
            const newDocumentIndex = { ...document.document_index };
            
            // Update each available language document index
            if (retrievedDocument.document_index) {
              Object.keys(retrievedDocument.document_index).forEach(lang => {
                if (retrievedDocument.document_index[lang]) {
                  newDocumentIndex[lang] = retrievedDocument.document_index[lang];
                }
              });
            }
            
            setDocument(prev => ({
              ...prev, 
              summaries: newSummaries,
              document_index: newDocumentIndex
            }));
            
            // Process sections
            processDocumentSections(retrievedDocument);
          }
        } else {
          // Clear document data if no document found
          setDocument(prev => ({
            ...prev,
            documentId: undefined,
            documentUrl: undefined,
            status: undefined,
            summaries: {
              en: '',
              es: '',
              vi: '',
              zh: ''
            },
            document_index: {
              en: '',
              es: '',
              vi: '',
              zh: ''
            },
            sections: {
              en: [],
              es: [],
              vi: [],
              zh: []
            }
          }));
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching document:', err);
      } finally {
        if (initialLoading) {
          setInitialLoading(false);
        }
      }
    };
    
    fetchDocument();
    
    // Clean up interval
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [refreshCounter, translationsLoaded]);

  // Safe check for content availability
  const hasContent = (lang: string) => {
    const hasSummary = Boolean(document.summaries && document.summaries[lang]);
    const hasDocumentIndex = Boolean(document.document_index && document.document_index[lang]);
    const hasSections = Boolean(
      document.sections && 
      document.sections[lang] && 
      document.sections[lang].length > 0
    );
    return hasSummary || hasSections || hasDocumentIndex;
  };

  // Set active tab based on language preference and content availability
  useEffect(() => {
    // Default to English tab
    let tabToShow = 'en';
    
    // If user prefers another language and content exists for that language, show it
    if (preferredLanguage !== 'en' && hasContent(preferredLanguage)) {
      tabToShow = preferredLanguage;
    }
    
    setActiveTab(tabToShow);
  }, [language, document.summaries, document.sections, preferredLanguage]);

  const handleBackClick = () => {
    navigate('/welcome-page');
  };

  // Extract filename from document URL
  const getFileName = (documentUrl: string) => {
    if (!documentUrl) return 'Document';
    return documentUrl.split('/').pop() || 'Document';
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch(status) {
      case "PROCESSING":
        return <Badge bg="warning" text="dark"><FontAwesomeIcon icon={faClock} className="me-1" /> Processing</Badge>;
      case "PROCESSED":
        return <Badge bg="success"><FontAwesomeIcon icon={faCheckCircle} className="me-1" /> Processed</Badge>;
      case "FAILED":
        return <Badge bg="danger"><FontAwesomeIcon icon={faExclamationTriangle} className="me-1" /> Failed</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  // Render tab content for a specific language
  const renderTabContent = (lang: string) => {
    const hasSummary = document.summaries && document.summaries[lang];
    const hasDocumentIndex = document.document_index && document.document_index[lang];
    const hasSections = (
      document.sections && 
      document.sections[lang] && 
      document.sections[lang].length > 0
    );
    
    const isEnglishTab = lang === 'en';

    return (
      <>        
        {/* Summary Section */}
        {hasSummary ? (
          <>
            <h4 className="mt-4 mb-3">
              {isEnglishTab ? 'IEP Summary' : t('summary.iepSummary')}
            </h4>
            <Card className="summary-content mb-3">
              <Card.Body className="py-3">
                <div 
                  className="markdown-content"
                  onClick={handleContentClick}
                  dangerouslySetInnerHTML={{ 
                    __html: processContent(
                      document.summaries[lang], 
                      isEnglishTab // Only process jargon in English
                    )
                  }}
                />
              </Card.Body>
            </Card>
          </>
        ) : (
          <Alert variant="info">
            <h5>
              {isEnglishTab 
                ? t('summary.noSummary.title')
                : t('summary.noTranslatedSummary.title')}
            </h5>
            <p>
              {isEnglishTab
                ? t('summary.noSummary.message')
                : t('summary.noTranslatedSummary.message')}
            </p>
          </Alert>
        )}
        
        {/* Sections Accordion */}
        {hasSections ? (
          <>
            <h4 className="mt-4 mb-3">
              {isEnglishTab ? 'Key Insights' : t('summary.keyInsights')}
            </h4>
            <Accordion className="mb-3 summary-accordion">
              {document.sections[lang].map((section, index) => (
                <Accordion.Item key={index} eventKey={index.toString()}>
                  <Accordion.Header>
                    {section.displayName}
                  </Accordion.Header>
                  <Accordion.Body>
                    {section.pageNumbers && section.pageNumbers.length > 0 && (
                      <p className="text-muted mb-2">
                        <small>
                          {isEnglishTab ? 'The original content for this section can be found in your IEP document on Pages: ' : 'Páginas: '}
                          {Array.isArray(section.pageNumbers) 
                            ? section.pageNumbers.join(', ') 
                            : section.pageNumbers}
                        </small>
                      </p>
                    )}
                    <div 
                      className="markdown-content"
                      onClick={handleContentClick}
                      dangerouslySetInnerHTML={{ 
                        __html: processContent(
                          section.content || t('summary.noContent'), 
                          isEnglishTab // Only process jargon in English
                        )
                      }}
                    />
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          </>
        ) : (
          <Alert variant="info">
            <h5>
              {isEnglishTab
                ? t('summary.noSections.title')
                : t('summary.noTranslatedSections.title')}
            </h5>
            <p>
              {isEnglishTab
                ? t('summary.noSections.message')
                : t('summary.noTranslatedSections.message')}
            </p>
          </Alert>
        )}
      </>
    );
  };

  // Check if document is processing
  const isProcessing = document && document.status === "PROCESSING";

  // Get tab title based on language code
  const getTabTitle = (languageCode: string) => {
    switch(languageCode) {
      case 'en': return t('summary.english');
      case 'es': return 'Español';
      case 'vi': return 'Tiếng Việt';
      case 'zh': return '中文';
      default: return languageCode.toUpperCase();
    }
  };

  // Loading state while translations are being loaded
  if (!translationsLoaded) {
    return (
      <Container className="summary-container mt-4 mb-5">
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading translations...</span>
          </Spinner>
          <p className="mt-3">Loading translations...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="summary-container mt-3 mb-3">
      <div className="mt-2 text-start button-container">
        <Button variant="outline-secondary" onClick={handleBackClick}>
          {t('summary.back')}
        </Button>
      </div>
      <Row className="mt-2">
        <Col>
          {error && <Alert variant="danger">{error}</Alert>}
          
          {initialLoading ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">{t('summary.loading')}</span>
              </Spinner>
              <p className="mt-3">{t('summary.loading')}</p>
            </div>
          ) : !document ? (
            <Alert variant="info">
              {t('summary.noDocuments')}
            </Alert>
          ) : (
            <Card className="summary-card">
              <Card.Body className="summary-card-body pt-2 pb-0">
                <Row>
                  <Col md={12}>
                    {isProcessing ? (
                      <div className="text-center my-5">
                        <Spinner animation="border" variant="warning" role="status">
                          <span className="visually-hidden">Processing document...</span>
                        </Spinner>
                        <Alert variant="warning" className="mt-3">
                          <h5>{t('summary.processing.title')}</h5>
                          <p>{t('summary.processing.message')}</p>
                          <div className="text-start">
                            <p>{t('rights.description')}</p>
                            <ul className="mt-3 text-start">
                              <li className="mb-2">{t('rights.bulletPoints.1')}</li>
                              <li className="mb-2">{t('rights.bulletPoints.2')}</li>
                              <li className="mb-2">{t('rights.bulletPoints.3')}</li>
                              <li className="mb-2">{t('rights.bulletPoints.4')}</li>
                              <li className="mb-2">{t('rights.bulletPoints.5')}</li>
                              <li className="mb-2">{t('rights.bulletPoints.6')}</li>
                            </ul>
                          </div>
                        </Alert>
                      </div>
                    ) : document.status === "FAILED" ? (
                      <Alert variant="danger">
                        <h5>{t('summary.failed.title')}</h5>
                        <p>{t('summary.failed.message')}</p>
                      </Alert>
                    ) : (
                      <>
                        <Tabs
                          activeKey={activeTab}
                          onSelect={(k) => k && setActiveTab(k)}
                          className="mb-2 mt-2 summary-tabs"
                        >
                          {/* Always show English tab */}
                          <Tab 
                            eventKey="en" 
                            title={t('summary.english')}
                          >
                            {renderTabContent('en')}
                          </Tab>
                          
                          {/* Show preferred language tab if content exists */}
                          {preferredLanguage !== 'en' && hasContent(preferredLanguage) && (
                            <Tab 
                              eventKey={preferredLanguage} 
                              title={
                                <span>
                                  <FontAwesomeIcon icon={faLanguage} className="me-1" />
                                  {getTabTitle(preferredLanguage)}
                                </span>
                              }
                            >
                              {renderTabContent(preferredLanguage)}
                            </Tab>
                          )}
                        </Tabs>
                        
                        {!hasContent('en') && !hasContent(preferredLanguage) && (
                          <Alert variant="info">
                            <h5>{t('summary.noContentAvailable.title')}</h5>
                            <p>{t('summary.noContentAvailable.message')}</p>
                          </Alert>
                        )}
                      </>
                    )}
                  </Col>
                </Row>
              </Card.Body>
              <Card.Header className="summary-card-header d-flex justify-content-between align-items-center">
                <div>
                  <FontAwesomeIcon icon={faFileAlt} className="me-2" />
                  {document.documentUrl ? getFileName(document.documentUrl) : 'Document'}
                </div>
                {document.status && renderStatusBadge(document.status)}
              </Card.Header>
            </Card>
          )}
        </Col>
      </Row>
      
      {/* Jargon Drawer */}
      <Offcanvas 
        show={showJargonDrawer} 
        onHide={() => setShowJargonDrawer(false)}
        placement="end"
        className="jargon-drawer"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>{selectedJargon?.term}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <p>{selectedJargon?.definition}</p>
        </Offcanvas.Body>
      </Offcanvas>
    </Container>
  );
};

export default IEPSummarizationAndTranslation;