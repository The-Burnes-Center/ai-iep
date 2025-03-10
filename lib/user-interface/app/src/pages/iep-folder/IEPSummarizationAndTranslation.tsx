import React, { useState, useEffect, useContext } from 'react';
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
import { faFileAlt, faClock, faCheckCircle, faExclamationTriangle, faLanguage } from '@fortawesome/free-solid-svg-icons';
import './IEPSummarizationAndTranslation.css';

const IEPSummarizationAndTranslation: React.FC = () => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [recentDocument, setRecentDocument] = useState<any>(null);
  const [summary, setSummary] = useState<string>('');
  const [translatedSummary, setTranslatedSummary] = useState<string>('');
  const [sections, setSections] = useState<{name: string, displayName: string, content: string}[]>([]);
  const [translatedSections, setTranslatedSections] = useState<{name: string, displayName: string, content: string}[]>([]);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>('translated');

  // Define the desired section order and display names
  const sectionConfig = [
    { apiName: "Student Information", displayName: "About Student" },
    { apiName: "Accommodations", displayName: "Accommodations" },
    { apiName: "Goals", displayName: "Goals" },
    { apiName: "Services", displayName: "Services" },
    { apiName: "Present Levels of Performance", displayName: "Present Levels of Performance" }
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

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Use our combined method to get the most recent document with its summary
        const mostRecentDocWithSummary = await apiClient.getMostRecentDocumentWithSummary();
        
        if (mostRecentDocWithSummary) {
          setRecentDocument(mostRecentDocWithSummary);
          
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
        } else {
          setRecentDocument(null);
          setSummary('');
          setTranslatedSummary('');
          setSections([]);
          setTranslatedSections([]);
        }
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError('Failed to load documents. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [refreshCounter]);

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

  // Check if translated content exists
  const hasTranslatedContent = translatedSummary || translatedSections.length > 0;

  return (
    <Container className="summary-container mt-4 mb-5">
      <Row>
        <Col>
        <p></p>          
          {error && (
            <Alert variant="danger">{error}</Alert>
          )}
          
          {loading && !error ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading document summary...</span>
              </Spinner>
              <p className="mt-3">Loading document summary...</p>
            </div>
          ) : !recentDocument ? (
            <Alert variant="info">
              No documents found. Please upload an IEP document first.
            </Alert>
          ) : (
            <Card className="summary-card">
              <Card.Body className="summary-card-body">
                <Row>
                  <Col md={12}>
                    {recentDocument.status === "PROCESSING" ? (
                      <Alert variant="warning">
                        <h5>Document is still processing</h5>
                        <p>Please check back later for the summary. Processing can take a few minutes.</p>
                      </Alert>
                    ) : recentDocument.status === "FAILED" ? (
                      <Alert variant="danger">
                        <h5>Processing Failed</h5>
                        <p>There was an error processing your document. Please try uploading it again.</p>
                      </Alert>
                    ) : (
                      <>
                        <Tabs
                          activeKey={activeTab}
                          onSelect={(k) => k && setActiveTab(k)}
                          className="mb-3 mt-4 summary-tabs"
                        >
                          <Tab 
                            eventKey="translated" 
                            title={
                              <span>
                                <FontAwesomeIcon icon={faLanguage} className="me-1" />
                                Spanish
                              </span>
                            }
                            disabled={!hasTranslatedContent}
                          >
                            {translatedSummary ? (
                              <>
                                <h4 className="mt-4">Document Summary</h4>
                                <Card className="summary-content mb-4">
                                  <Card.Body>
                                    <p className="mb-0">{translatedSummary}</p>
                                  </Card.Body>
                                </Card>
                              </>
                            ) : (
                              <Alert variant="info">
                                <h5>No Translated Summary Available</h5>
                                <p>No summary in your preferred language was found for this document.</p>
                              </Alert>
                            )}
                            
                            {translatedSections.length > 0 ? (
                              <>
                                <h4 className="mt-4">Document Sections</h4>
                                <Accordion className="mb-3 summary-accordion">
                                  {translatedSections.map((section, index) => (
                                    <Accordion.Item key={index} eventKey={index.toString()}>
                                      <Accordion.Header>
                                        {section.displayName}
                                      </Accordion.Header>
                                      <Accordion.Body>
                                        {section.content || 'No content available for this section.'}
                                      </Accordion.Body>
                                    </Accordion.Item>
                                  ))}
                                </Accordion>
                              </>
                            ) : (
                              <Alert variant="info">
                                <h5>No Translated Sections Available</h5>
                                <p>No sections in your preferred language were found for this document.</p>
                              </Alert>
                            )}
                            
                            {!translatedSummary && translatedSections.length === 0 && (
                              <Alert variant="warning">
                                <h5>No Translated Content Available</h5>
                                <p>No content in your preferred language was found for this document.</p>
                              </Alert>
                            )}
                          </Tab>
                          
                          <Tab eventKey="english" title="English">
                            {summary ? (
                              <>
                                <h4 className="mt-4">Document Summary</h4>
                                <Card className="summary-content mb-4">
                                  <Card.Body>
                                    <p className="mb-0">{summary}</p>
                                  </Card.Body>
                                </Card>
                              </>
                            ) : (
                              <Alert variant="info">
                                <h5>No Summary Available</h5>
                                <p>No English summary was found for this document.</p>
                              </Alert>
                            )}
                            
                            {sections.length > 0 ? (
                              <>
                                <h4 className="mt-4">Document Sections</h4>
                                <Accordion className="mb-3 summary-accordion">
                                  {sections.map((section, index) => (
                                    <Accordion.Item key={index} eventKey={index.toString()}>
                                      <Accordion.Header>
                                        {section.displayName}
                                      </Accordion.Header>
                                      <Accordion.Body>
                                        {section.content || 'No content available for this section.'}
                                      </Accordion.Body>
                                    </Accordion.Item>
                                  ))}
                                </Accordion>
                              </>
                            ) : (
                              <Alert variant="info">
                                <h5>No Sections Available</h5>
                                <p>No English sections were found for this document.</p>
                              </Alert>
                            )}
                          </Tab>
                        </Tabs>
                        
                        {!summary && !translatedSummary && sections.length === 0 && translatedSections.length === 0 && (
                          <Alert variant="info">
                            <h5>No Content Available</h5>
                            <p>The document has been processed, but no summary or sections were found in any language.</p>
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