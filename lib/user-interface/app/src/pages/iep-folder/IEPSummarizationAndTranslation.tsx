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
  Tab
} from 'react-bootstrap';
import { AppContext } from '../../common/app-context';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import { faFileAlt, faClock, faCheckCircle, faExclamationTriangle, faLanguage } from '@fortawesome/free-solid-svg-icons';
import './IEPSummarizationAndTranslation.css';
import { IEPDocument, IEPSection } from '../../common/types';
import { useLanguage } from '../../common/language-context';
import ReactMarkdown from 'react-markdown';

const IEPSummarizationAndTranslation: React.FC = () => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  const { t, language, translationsLoaded } = useLanguage();
  
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
    "Accommodations": "Adaptations made for specific individuals with disabilities when a product or service isn't accessible. These techniques and materials don't change the basic curriculum but do make learning a little easier and help students communicate what they know.",
    "Assessment": "Process of identifying strengths and needs to assist in educational planning; includes observation, record review, interviews, and tests to develop appropriate educational programs, and to monitor progress",
    "Assistive Technology": "Any item, piece of equipment, product or system used to increase, maintain, or improve the functional capabilities of a child with a disability.",
    "IEP": "An IEP is a plan developed to ensure that a child who has a disability identified under the law receives specialized instruction and related services.",
    "Informed Consent": "Agreement in writing from parents that they have been informed and understand implications of special education evaluation and program decisions; permission is voluntary and may be withdrawn.",
    "Occupational Therapy": "A related service that helps students improve fine motor skills and perform tasks needed for daily living and school activities.",
    "Speech Therapy": "A related service involving therapy to improve verbal communication abilities.",
    "Resiliency": "Ability to pursue personal goals and bounce back from challenges.",
    "Transition": "Process of preparing kids to function in future environments and emphasizing movement from one educational program to another.",
    "Accessibility": "The ability to access the functionality and benefit of a system or entity; describes how accessible a product or environment is to as many people as possible.",
  };

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

  // Helper function to find jargon terms in text
  const checkForJargonTerms = (text: string) => {
    if (!text) return null;
    
    // Process each word in the text
    const words = text.split(/\b/); // Split by word boundaries
    const result: React.ReactNode[] = [];
    
    words.forEach((word, index) => {
      // Clean the word for matching but keep original for display
      const cleanWord = word.trim().replace(/[.,!?;:()]/g, '');
      
      // Check if word matches any jargon term (case-insensitive)
      const matchedTerm = Object.keys(jargonDictionary).find(
        term => term.toLowerCase() === cleanWord.toLowerCase()
      );
      
      if (matchedTerm && cleanWord.length > 0) {
        // Add the jargon term with tooltip
        result.push(
          <span 
            key={index} 
            className="jargon-term" 
            data-tooltip={jargonDictionary[matchedTerm]}
          >
            {word}
          </span>
        );
      } else {
        // Add normal word
        result.push(<React.Fragment key={index}>{word}</React.Fragment>);
      }
    });
    
    return <>{result}</>;
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
  
  // Direct display of summary with jargon term processing
  const SummaryWithJargon = ({ content, isEnglish = false }) => {
    if (!content) return null;
    
    if (!isEnglish) {
      return <p className="mb-0">{content}</p>;
    }
    
    return (
      <div className="summary-content-wrapper">
        {checkForJargonTerms(content)}
      </div>
    );
  };
  
  // Custom renderer for markdown section content
  const renderSectionContent = (content: string, isEnglish: boolean) => {
    if (!isEnglish) {
      // For non-English content, just use standard ReactMarkdown
      return (
        <ReactMarkdown>
          {content}
        </ReactMarkdown>
      );
    }
    
    // For English content, manually parse markdown and apply jargon highlighting
    
    // Handle ** for bold text
    const processBoldText = (text: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      let currentText = '';
      let inBold = false;
      let boldContent = '';
      
      for (let i = 0; i < text.length; i++) {
        if (i < text.length - 1 && text.substr(i, 2) === '**') {
          if (inBold) {
            // End bold section
            if (currentText) {
              parts.push(checkForJargonTerms(currentText));
              currentText = '';
            }
            parts.push(<strong key={`bold-${i}`}>{checkForJargonTerms(boldContent)}</strong>);
            boldContent = '';
            inBold = false;
            i++; // Skip the second *
          } else {
            // Start bold section
            if (currentText) {
              parts.push(checkForJargonTerms(currentText));
              currentText = '';
            }
            inBold = true;
            i++; // Skip the second *
          }
        } else if (inBold) {
          boldContent += text[i];
        } else {
          currentText += text[i];
        }
      }
      
      // Add any remaining text
      if (currentText) {
        parts.push(checkForJargonTerms(currentText));
      }
      
      return parts;
    };
    
    // Split content by line breaks
    const lines = content.split('\n');
    const result: React.ReactNode[] = [];
    
    lines.forEach((line, lineIndex) => {
      // Skip empty lines
      if (!line.trim()) {
        result.push(<br key={`br-${lineIndex}`} />);
        return;
      }
      
      // Handle headers (# Header)
      if (line.startsWith('# ')) {
        const headerText = line.substring(2);
        result.push(
          <h1 key={`h1-${lineIndex}`} style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
            {processBoldText(headerText)}
          </h1>
        );
        return;
      }
      
      if (line.startsWith('## ')) {
        const headerText = line.substring(3);
        result.push(
          <h2 key={`h2-${lineIndex}`} style={{ marginTop: '0.8rem', marginBottom: '0.4rem' }}>
            {processBoldText(headerText)}
          </h2>
        );
        return;
      }
      
      if (line.startsWith('### ')) {
        const headerText = line.substring(4);
        result.push(
          <h3 key={`h3-${lineIndex}`} style={{ marginTop: '0.6rem', marginBottom: '0.3rem' }}>
            {processBoldText(headerText)}
          </h3>
        );
        return;
      }
      
      // Handle lists (- item)
      if (line.startsWith('- ')) {
        const listItemText = line.substring(2);
        result.push(
          <div key={`li-${lineIndex}`} style={{ display: 'flex', marginBottom: '0.5rem' }}>
            <span style={{ marginRight: '0.5rem' }}>•</span>
            <div>{processBoldText(listItemText)}</div>
          </div>
        );
        return;
      }
      
      // Handle normal paragraphs
      result.push(
        <p key={`p-${lineIndex}`} style={{ marginBottom: '0.5rem' }}>
          {processBoldText(line)}
        </p>
      );
    });
    
    return <div>{result}</div>;
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
        {/* Table of Contents Section */}
        {hasDocumentIndex ? (
          <>
            <h4 className="mt-4 mb-3">
              {isEnglishTab ? 'Table of Contents' : t('summary.tableOfContents')}
            </h4>
            <Card className="summary-content mb-3">
              <Card.Body className="p-2">
                <div className="markdown-content table-of-contents-content">
                  <ReactMarkdown>
                    {document.document_index[lang]
                      ? document.document_index[lang]
                          // Add two spaces at the end of each line to create a line break in markdown
                          .split('\n')
                          .join('  \n')
                      : ''
                    }
                  </ReactMarkdown>
                </div>
              </Card.Body>
            </Card>
          </>
        ) : null}
        
        {/* Summary Section */}
        {hasSummary ? (
          <>
            <h4 className="mt-4 mb-3">
              {isEnglishTab ? 'IEP Summary' : t('summary.iepSummary')}
            </h4>
            <Card className="summary-content mb-3">
              <Card.Body className="py-3">
                {isEnglishTab ? (
                  // For English content, use SummaryWithJargon
                  <SummaryWithJargon content={document.summaries[lang]} isEnglish={true} />
                ) : (
                  // For non-English content, just display the text
                  <p className="mb-0">{document.summaries[lang]}</p>
                )}
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
                          {isEnglishTab ? 'Pages: ' : 'Páginas: '}
                          {Array.isArray(section.pageNumbers) 
                            ? section.pageNumbers.join(', ') 
                            : section.pageNumbers}
                        </small>
                      </p>
                    )}
                    <div className="markdown-content">
                      {renderSectionContent(
                        section.content || t('summary.noContent'), 
                        isEnglishTab
                      )}
                    </div>
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
    </Container>
  );
};

export default IEPSummarizationAndTranslation;