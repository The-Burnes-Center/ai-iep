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
import { useLanguage } from '../../common/language-context';

const IEPSummarizationAndTranslation: React.FC = () => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  
  // Track whether this is the first load
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [recentDocument, setRecentDocument] = useState<any>(null);
  const [summary, setSummary] = useState<string>('');
  const [translatedSummary, setTranslatedSummary] = useState<string>('');
  const [sections, setSections] = useState<{name: string, displayName: string, content: string}[]>([]);
  const [translatedSections, setTranslatedSections] = useState<{name: string, displayName: string, content: string}[]>([]);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  // Initialize activeTab state - will be set properly in the useEffect below
  const [activeTab, setActiveTab] = useState<string>('english');
  const navigate = useNavigate();
  
  // Reference to store the polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef<boolean>(true);

  const { t, translationsLoaded } = useLanguage();

  // Move sectionConfig inside the useEffect to rebuild it when translations change
  // This is a reference to store the section config
  const sectionConfigRef = useRef([
    { apiName: "Student Information", englishName: "Student Information", displayName: "Student Information" },
    { apiName: "Accommodations", englishName: "Accommodations", displayName: "Accommodations" },
    { apiName: "Goals", englishName: "Goals", displayName: "Goals" },
    { apiName: "Services", englishName: "Services", displayName: "Services" },
    { apiName: "Placement", englishName: "Placement", displayName: "Placement" },
    { apiName: "Present Levels", englishName: "Present Levels", displayName: "Present Levels" },
    { apiName: "Eligibility", englishName: "Eligibility", displayName: "Eligibility" },
    { apiName: "Informed Consent", englishName: "Informed Consent", displayName: "Informed Consent" },
    { apiName: "Assistive Technology", englishName: "Assistive Technology", displayName: "Assistive Technology" },
    { apiName: "State Testing", englishName: "State Testing", displayName: "State Testing" },
  ]);

  // Update section config when translations are loaded
  useEffect(() => {
    if (translationsLoaded) {
      sectionConfigRef.current = [
        { apiName: "Student Information", englishName: "Student Information", displayName: t('sections.studentInfo') },
        { apiName: "Accommodations", englishName: "Accommodations", displayName: t('sections.accommodations') },
        { apiName: "Goals", englishName: "Goals", displayName: t('sections.goals') },
        { apiName: "Services", englishName: "Services", displayName: t('sections.services') },
        { apiName: "Placement", englishName: "Placement", displayName: t('sections.placement') },
        { apiName: "Present Levels", englishName: "Present Levels", displayName: t('sections.presentLevels') },
        { apiName: "Eligibility", englishName: "Eligibility", displayName: t('sections.eligibility') },
        { apiName: "Informed Consent", englishName: "Informed Consent", displayName: t('sections.informedConsent') },
        { apiName: "Assistive Technology", englishName: "Assistive Technology", displayName: t('sections.assistiveTechnology') },
        { apiName: "State Testing", englishName: "State Testing", displayName: t('sections.stateTesting') },
      ];
      
      // Re-process sections with new translations if we have a document
      if (recentDocument && recentDocument.status === "PROCESSED") {
        processDocumentSections(recentDocument);
      }
    }
  }, [t, translationsLoaded]);

  const getDisplayName = (apiName: string, useTranslation: boolean = false): string => {
    const config = sectionConfigRef.current.find(s => s.apiName === apiName);
    if (!config) return apiName;
    
    // Return either the translated name or the English name
    return useTranslation ? config.displayName : config.englishName;
  };

  // Function to sort sections based on the predefined order
  const sortSections = (sectionsArray: {name: string, displayName: string, content: string}[]) => {
    return [...sectionsArray].sort((a, b) => {
      const indexA = sectionConfigRef.current.findIndex(s => s.apiName === a.name);
      const indexB = sectionConfigRef.current.findIndex(s => s.apiName === b.name);
      
      // If both sections are in our predefined order list
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only section A is in our list, prioritize it
      if (indexA !== -1) {
        return -1;
      }
      
      // If only section B is in our list, prioritize it
      if (indexB !== -1) {
        return 1;
      }
      
      // If neither section is in our list, maintain their original order
      return 0;
    });
  };

  // Extracted function to process document sections - can be called when translations change
  const processDocumentSections = (document: any) => {
    if (!document || document.status !== "PROCESSED") return;

    // Process English sections
    if (document.sections) {
      try {
        const extractedSections = [];
        const sectionsData = document.sections;
        
        if (sectionsData) {
          for (const [sectionName, sectionContent] of Object.entries(sectionsData)) {
            const sectionContentObj = sectionContent as any;
            const content = sectionContentObj?.M?.S?.S || '';
            
            extractedSections.push({ 
              name: sectionName,
              displayName: getDisplayName(sectionName, false), 
              content: content
            });
          }
        }
        
        const orderedSections = sortSections(extractedSections);
        setSections(orderedSections);
      } catch (e) {
        console.error("Error extracting sections:", e);
        setSections([]);
      }
    }
    
    // Process translated sections
    if (document.translatedSections) {
      try {
        const extractedTranslatedSections = [];
        const translatedSectionsData = document.translatedSections;
        
        if (translatedSectionsData) {
          for (const [sectionName, sectionContent] of Object.entries(translatedSectionsData)) {
            const sectionContentObj = sectionContent as any;
            const content = sectionContentObj?.M?.S?.S || '';
            
            extractedTranslatedSections.push({ 
              name: sectionName,
              displayName: getDisplayName(sectionName, true), 
              content: content
            });
          }
        }
        
        const orderedTranslatedSections = sortSections(extractedTranslatedSections);
        setTranslatedSections(orderedTranslatedSections);
      } catch (e) {
        console.error("Error extracting translated sections:", e);
        setTranslatedSections([]);
      }
    }
  };

  // Function to start polling if document is processing
  const startPollingIfProcessing = (document: any) => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // If the document is processing, start polling every 5 seconds
    if (document && document.status === "PROCESSING") {
      console.log("Document is processing. Starting polling...");
      pollingIntervalRef.current = setInterval(() => {
        console.log("Polling for document status updates...");
        setRefreshCounter(prev => prev + 1);
      }, 5000); // Poll every 5 seconds
    }
  };

  // Effect for document fetching - only depends on refreshCounter now
  useEffect(() => {
    // Skip fetching if translations aren't loaded yet
    if (!translationsLoaded) return;
    
    const fetchDocuments = async () => {
      // Only set loading on initial fetch
      if (isFirstRender.current) {
        isFirstRender.current = false;
      }
      
      try {
        // Use our combined method to get the most recent document with its summary
        const mostRecentDocWithSummary = await apiClient.getMostRecentDocumentWithSummary();
        
        if (mostRecentDocWithSummary) {
          // Only update the document if there's an actual change
          setRecentDocument(prev => {
            // Only trigger re-render if status or other key properties changed
            if (!prev || 
                prev.status !== mostRecentDocWithSummary.status || 
                prev.createdAt !== mostRecentDocWithSummary.createdAt) {
              return mostRecentDocWithSummary;
            }
            return prev; // No change needed
          });
          
          // Start or stop polling based on document status
          startPollingIfProcessing(mostRecentDocWithSummary);
          
          // Only update state if document is processed - prevents unnecessary re-renders during polling
          if (mostRecentDocWithSummary.status === "PROCESSED") {
            // Set the summary if available
            if (mostRecentDocWithSummary.summary) {
              setSummary(mostRecentDocWithSummary.summary);
            } else {
              setSummary('');
            }
            
            // Set the translated summary if available
            if (mostRecentDocWithSummary.translatedSummary) {
              setTranslatedSummary(mostRecentDocWithSummary.translatedSummary);
            } else {
              setTranslatedSummary('');
            }
            
            // Process sections using the extracted function
            processDocumentSections(mostRecentDocWithSummary);
          }
        } else {
          setRecentDocument(null);
          setSummary('');
          setTranslatedSummary('');
          setSections([]);
          setTranslatedSections([]);
        }
        
        // Clear any errors
        setError(null);
      } catch (err) {
        console.error('Error fetching documents:', err);
        // setError('Failed to load documents. Please try again.');
      } finally {
        // Only turn off initial loading after first fetch
        if (initialLoading) {
          setInitialLoading(false);
        }
      }
    };

    fetchDocuments();

    // Cleanup function to clear interval when component unmounts
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [refreshCounter, translationsLoaded]);

  // Check if translated content exists
  const hasTranslatedContent = translatedSummary || translatedSections.length > 0;

  // Set the appropriate active tab based on translated content availability
  useEffect(() => {
    if (hasTranslatedContent) {
      setActiveTab('translated');
    } else {
      setActiveTab('english');
    }
  }, [hasTranslatedContent]);

  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

  // Extract filename from documentUrl 
  const getFileName = (documentUrl: string) => {
    if (!documentUrl) return 'Document';
    return documentUrl.split('/').pop() || 'Document';
  };

  // Determine if we're in initial loading or processing state
  const isProcessing = recentDocument && recentDocument.status === "PROCESSING";

  const handleBackClick = () => {
    navigate('/welcome-page');
  };

  // If translations aren't loaded yet, show a loading state
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
    <Container className="summary-container mt-4 mb-5">
      <div className="mt-3 text-start">
        <Button variant="outline-secondary" onClick={handleBackClick}>
          {t('summary.back')}
        </Button>
      </div>
      <Row>
        <Col>
        <p></p>          
          {error && (
            <Alert variant="danger">{error}</Alert>
          )}
          
          {initialLoading ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">{t('summary.loading')}</span>
              </Spinner>
              <p className="mt-3">{t('summary.loading')}</p>
            </div>
          ) : !recentDocument ? (
            <Alert variant="info">
              {t('summary.noDocuments')}
            </Alert>
          ) : (
            <Card className="summary-card">
              <Card.Body className="summary-card-body">
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
                    ) : recentDocument.status === "FAILED" ? (
                      <Alert variant="danger">
                        <h5>{t('summary.failed.title')}</h5>
                        <p>{t('summary.failed.message')}</p>
                      </Alert>
                    ) : (
                      <>
                        <Tabs
                          activeKey={activeTab}
                          onSelect={(k) => k && setActiveTab(k)}
                          className="mb-3 mt-4 summary-tabs"
                        >
                          {/* Only render the Preferred Language tab if translated content exists */}
                          {hasTranslatedContent && (
                            <Tab 
                              eventKey="translated" 
                              title={
                                <span>
                                  <FontAwesomeIcon icon={faLanguage} className="me-1" />
                                  {t('summary.preferredLanguage')}
                                </span>
                              }
                            >
                              {translatedSummary ? (
                                <>
                                  <h4 className="mt-4">{t('summary.iepSummary')}</h4>
                                  <Card className="summary-content mb-4">
                                    <Card.Body>
                                      <p className="mb-0">{translatedSummary}</p>
                                    </Card.Body>
                                  </Card>
                                </>
                              ) : (
                                <Alert variant="info">
                                  <h5>{t('summary.noTranslatedSummary.title')}</h5>
                                  <p>{t('summary.noTranslatedSummary.message')}</p>
                                </Alert>
                              )}
                              
                              {translatedSections.length > 0 ? (
                                <>
                                  <h4 className="mt-4">{t('summary.keyInsights')}</h4>
                                  <Accordion className="mb-3 summary-accordion">
                                    {translatedSections.map((section, index) => (
                                      <Accordion.Item key={index} eventKey={index.toString()}>
                                        <Accordion.Header>
                                          {section.displayName}
                                        </Accordion.Header>
                                        <Accordion.Body>
                                          {section.content || t('summary.noContent')}
                                        </Accordion.Body>
                                      </Accordion.Item>
                                    ))}
                                  </Accordion>
                                </>
                              ) : (
                                <Alert variant="info">
                                  <h5>{t('summary.noTranslatedSections.title')}</h5>
                                  <p>{t('summary.noTranslatedSections.message')}</p>
                                </Alert>
                              )}
                            </Tab>
                          )}
                          
                          <Tab eventKey="english" title={t('summary.english')}>
                            {summary ? (
                              <>
                                <h4 className="mt-4">{t('summary.iepSummary')}</h4>
                                <Card className="summary-content mb-4">
                                  <Card.Body>
                                    <p className="mb-0">{summary}</p>
                                  </Card.Body>
                                </Card>
                              </>
                            ) : (
                              <Alert variant="info">
                                <h5>{t('summary.noSummary.title')}</h5>
                                <p>{t('summary.noSummary.message')}</p>
                              </Alert>
                            )}
                            
                            {sections.length > 0 ? (
                              <>
                                <h4 className="mt-4">{t('summary.keyInsights')}</h4>
                                <Accordion className="mb-3 summary-accordion">
                                  {sections.map((section, index) => (
                                    <Accordion.Item key={index} eventKey={index.toString()}>
                                      <Accordion.Header>
                                        {section.displayName}
                                      </Accordion.Header>
                                      <Accordion.Body>
                                        {section.content || t('summary.noContent')}
                                      </Accordion.Body>
                                    </Accordion.Item>
                                  ))}
                                </Accordion>
                              </>
                            ) : (
                              <Alert variant="info">
                                <h5>{t('summary.noSections.title')}</h5>
                                <p>{t('summary.noSections.message')}</p>
                              </Alert>
                            )}
                          </Tab>
                        </Tabs>
                        
                        {!summary && !translatedSummary && sections.length === 0 && translatedSections.length === 0 && (
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
                  {recentDocument.documentUrl ? getFileName(recentDocument.documentUrl) : 'Document'}
                </div>
                {recentDocument.status && renderStatusBadge(recentDocument.status)}
              </Card.Header>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default IEPSummarizationAndTranslation;