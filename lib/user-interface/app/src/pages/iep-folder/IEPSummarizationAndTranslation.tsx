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

  const { t } = useLanguage();

  // Define the desired section order and display names
  const sectionConfig = [
    { apiName: "Student Information", displayName: t('sections.studentInfo') },
    { apiName: "Accommodations", displayName: t('sections.accommodations') },
    { apiName: "Goals", displayName: t('sections.goals') },
    { apiName: "Services", displayName: t('sections.services') },
    { apiName: "Present Levels of Performance", displayName: t('sections.presentLevels') }
  ];

  // Function to get display name for a section
  const getDisplayName = (apiName: string): string => {
    const config = sectionConfig.find(s => s.apiName === apiName);
    return config ? config.displayName : apiName;
  };

  // Function to sort sections based on the predefined order
  const sortSections = (sectionsArray: {name: string, displayName: string, content: string}[]) => {
    return [...sectionsArray].sort((a, b) => {
      const indexA = sectionConfig.findIndex(s => s.apiName === a.name);
      const indexB = sectionConfig.findIndex(s => s.apiName === b.name);
      
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

  useEffect(() => {
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
            
            // Extract sections if available
            if (mostRecentDocWithSummary.sections) {
              try {
                const extractedSections = [];
                const sectionsData = mostRecentDocWithSummary.sections;
                
                if (sectionsData) {
                  // Iterate through each section
                  for (const [sectionName, sectionContent] of Object.entries(sectionsData)) {
                    // Extract content by traversing M -> S -> S with type safety
                    const sectionContentObj = sectionContent as any;
                    const content = sectionContentObj?.M?.S?.S || '';
                    
                    extractedSections.push({ 
                      name: sectionName,
                      displayName: getDisplayName(sectionName), 
                      content: content
                    });
                  }
                }
                
                // Sort sections according to our defined order
                const orderedSections = sortSections(extractedSections);
                setSections(orderedSections);
              } catch (e) {
                console.error("Error extracting sections:", e);
                setSections([]);
              }
            } else {
              setSections([]);
            }
            
            // Extract translated sections if available
            if (mostRecentDocWithSummary.translatedSections) {
              try {
                const extractedTranslatedSections = [];
                const translatedSectionsData = mostRecentDocWithSummary.translatedSections;
                
                if (translatedSectionsData) {
                  // Iterate through each section
                  for (const [sectionName, sectionContent] of Object.entries(translatedSectionsData)) {
                    // Extract content by traversing M -> S -> S with type safety
                    const sectionContentObj = sectionContent as any;
                    const content = sectionContentObj?.M?.S?.S || '';
                    
                    extractedTranslatedSections.push({ 
                      name: sectionName,
                      displayName: getDisplayName(sectionName), 
                      content: content
                    });
                  }
                }
                
                // Sort translated sections according to our defined order
                const orderedTranslatedSections = sortSections(extractedTranslatedSections);
                setTranslatedSections(orderedTranslatedSections);
              } catch (e) {
                console.error("Error extracting translated sections:", e);
                setTranslatedSections([]);
              }
            } else {
              setTranslatedSections([]);
            }
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
  }, [refreshCounter]);

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
                                <h5>{t('summary.noSections.title')}No Sections Available</h5>
                                <p>{t('summary.noSections.message')}No English sections were found for this document.</p>
                              </Alert>
                            )}
                          </Tab>
                        </Tabs>
                        
                        {!summary && !translatedSummary && sections.length === 0 && translatedSections.length === 0 && (
                          <Alert variant="info">
                            <h5>{t('summary.noContentAvailable.title')}No Content Available</h5>
                            <p>{t('summary.noContentAvailable.message')}The document has been processed, but no summary or sections were found in any language.</p>
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