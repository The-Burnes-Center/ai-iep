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
import ReactMarkdown from 'react-markdown';
import { IEPDocument } from '../../common/types';

const IEPSummarizationAndTranslation: React.FC = () => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  const { t, language, translationsLoaded } = useLanguage();
  
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [document, setDocument] = useState<IEPDocument>({
    summaries: {},
    sections: {
      en: [],
      es: []
    }
  });
  
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>('english');
  const navigate = useNavigate();
  
  // Reference to store the polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef<boolean>(true);

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
  const sortSections = (sections: {name: string, displayName: string, content: string}[]) => {
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

  // Process document sections
  const processDocumentSections = (document: any) => {
    if (!document || document.status !== "PROCESSED") return;
    
    console.log("Processing document sections:", document);
    
    // Process English sections
    if (document.sections && document.sections.en) {
      try {
        const extractedSections = [];
        
        // Handle array format
        if (Array.isArray(document.sections.en)) {
          console.log("Processing English sections as array");
          document.sections.en.forEach(section => {
            if (section.title && section.content) {
              extractedSections.push({
                name: section.title,
                displayName: getDisplayName(section.title, false),
                content: section.content,
                pageNumbers: section.page_numbers || [] // Extract page numbers
              });
            }
          });
        }
        
        const orderedSections = sortSections(extractedSections);
        console.log("Processed English sections:", orderedSections);
        setDocument(prev => ({...prev, sections: { ...prev.sections,en: orderedSections} }))
      } catch (e) {
        console.error("Error processing English sections:", e);
        setDocument(prev => ({...prev, sections: { ...prev.sections, en: []} }))
      }
    } else {
      console.log("No English sections found");
      setDocument(prev => ({...prev, sections: { ...prev.sections, en: []} }))
    }
    
    // Process Spanish sections
    if (document.sections && document.sections.es) {
      try {
        const extractedSections = [];
        
        // Handle array format
        if (Array.isArray(document.sections.es)) {
          console.log("Processing Spanish sections as array");
          document.sections.es.forEach(section => {
            if (section.title && section.content) {
              extractedSections.push({
                name: section.title,
                displayName: getDisplayName(section.title, true),
                content: section.content,
                pageNumbers: section.page_numbers || [] // Extract page numbers
              });
            }
          });
        }
        
        const orderedSections = sortSections(extractedSections);
        console.log("Processed Spanish sections:", orderedSections);
        setDocument(prev => ({ ...prev, sections: { ...prev.sections, es:  orderedSections}}));
      } catch (e) {
        console.error("Error processing Spanish sections:", e);
        setDocument(prev => ({ ...prev, sections: { ...prev.sections, es:  []}}));
      }
    } else {
      console.log("No Spanish sections found");
      setDocument(prev => ({ ...prev, sections: { ...prev.sections, es:  []}}));
    }
  };

  // Function to start polling if document is processing
  const startPollingIfProcessing = (document: any) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (document && document.status === "PROCESSING") {
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
              return retrievedDocument;
            }
            return prev;
          });
          
          startPollingIfProcessing(retrievedDocument);
          
          if (retrievedDocument.status === "PROCESSED") {
            // Set summaries
            setDocument(prev => ({...prev, summaries: { en: retrievedDocument.summaries?.en || '', es: retrievedDocument.summaries?.es || ''}  }));
            
            // Process sections
            processDocumentSections(retrievedDocument);
          }
        } else {
          setDocument(prev => ({...prev, summaries: { en: '', es: ''}, sections: { en: [], es: []}  }));
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

  // Set active tab based on language preference and content availability
  useEffect(() => {
    const hasSpanishContent = document.summaries.es || document.sections.es.length > 0;
    
    if (language === 'es' && hasSpanishContent) {
      setActiveTab('spanish');
    } else {
      setActiveTab('english');
    }
  }, [language, document.summaries.es, document.sections.es]);

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

  // Check if document is processing
  const isProcessing = document && document.status === "PROCESSING";

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
    <Container className="summary-container mt-4 mb-5">
      <div className="mt-3 text-start">
        <Button variant="outline-secondary" onClick={handleBackClick}>
          {t('summary.back')}
        </Button>
      </div>
      <Row>
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
                          className="mb-3 mt-4 summary-tabs"
                        >
                          {/* Always show English tab */}
                          <Tab 
                            eventKey="english" 
                            title={t('summary.english')}
                          >
                            {document.summaries.en ? (
                              <>
                                <h4 className="mt-4">IEP Summary</h4>
                                <Card className="summary-content mb-4">
                                  <Card.Body>
                                    <p className="mb-0">{document.summaries.en}</p>
                                  </Card.Body>
                                </Card>
                              </>
                            ) : (
                              <Alert variant="info">
                                <h5>{t('summary.noSummary.title')}</h5>
                                <p>{t('summary.noSummary.message')}</p>
                              </Alert>
                            )}
                            
                            {document.sections.en.length > 0 ? (
                              <>
                                <h4 className="mt-4">Key Insights</h4>
                                <Accordion className="mb-3 summary-accordion">
                                  {document.sections.en.map((section, index) => (
                                    <Accordion.Item key={index} eventKey={index.toString()}>
                                      <Accordion.Header>
                                        {section.displayName}
                                      </Accordion.Header>
                                      <Accordion.Body>
                                        {section.pageNumbers && section.pageNumbers.length > 0 && (
                                          <p className="text-muted mb-2">
                                            <small>Pages: {Array.isArray(section.pageNumbers) ? 
                                              section.pageNumbers.join(', ') : 
                                              section.pageNumbers}
                                            </small>
                                          </p>
                                        )}
                                        <div className="markdown-content">
                                          <ReactMarkdown>
                                            {section.content || t('summary.noContent')}
                                          </ReactMarkdown>
                                        </div>
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
                          
                          {/* Show Spanish tab only if there's content */}
                          {(document.summaries.es || document.sections.es.length > 0) && (
                            <Tab 
                              eventKey="spanish" 
                              title={
                                <span>
                                  <FontAwesomeIcon icon={faLanguage} className="me-1" />
                                  Español
                                </span>
                              }
                            >
                              {document.summaries.es ? (
                                <>
                                  <h4 className="mt-4">Resumen del IEP</h4>
                                  <Card className="summary-content mb-4">
                                    <Card.Body>
                                      <p className="mb-0">{document.summaries.es}</p>
                                    </Card.Body>
                                  </Card>
                                </>
                              ) : (
                                <Alert variant="info">
                                  <h5>{t('summary.noTranslatedSummary.title')}</h5>
                                  <p>{t('summary.noTranslatedSummary.message')}</p>
                                </Alert>
                              )}
                              
                              {document.sections.es.length > 0 ? (
                                <>
                                  <h4 className="mt-4">Información Clave</h4>
                                  <Accordion className="mb-3 summary-accordion">
                                    {document.sections.es.map((section, index) => (
                                      <Accordion.Item key={index} eventKey={index.toString()}>
                                        <Accordion.Header>
                                          {section.displayName}
                                        </Accordion.Header>
                                        <Accordion.Body>
                                          {section.pageNumbers && section.pageNumbers.length > 0 && (
                                            <p className="text-muted mb-2">
                                              <small>Páginas: {Array.isArray(section.pageNumbers) ? 
                                                section.pageNumbers.join(', ') : 
                                                section.pageNumbers}
                                              </small>
                                            </p>
                                          )}
                                          <div className="markdown-content">
                                            <ReactMarkdown>
                                              {section.content || t('summary.noContent')}
                                            </ReactMarkdown>
                                          </div>
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
                        </Tabs>
                        
                        {!document.summaries.en && !document.summaries.es && 
                         document.sections.en.length === 0 && document.sections.es.length === 0 && (
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