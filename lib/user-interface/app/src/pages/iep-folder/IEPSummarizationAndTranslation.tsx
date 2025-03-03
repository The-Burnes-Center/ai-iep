import React, { useState, useEffect, useContext } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Spinner, 
  Alert, 
  Button,
  Badge
} from 'react-bootstrap';
import { AppContext } from '../../common/app-context';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faClock, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

const IEPSummarizationAndTranslation: React.FC = () => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [recentDocument, setRecentDocument] = useState<any>(null);
  const [summary, setSummary] = useState<string>('');
  const [refreshCounter, setRefreshCounter] = useState<number>(0);

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Use our combined method to get the most recent document with its summary
        const mostRecentDocWithSummary = await apiClient.getMostRecentDocumentWithSummary();
        
        if (mostRecentDocWithSummary) {
          setRecentDocument(mostRecentDocWithSummary);
          
          // Set the summary if available (the method now returns it directly)
          if (mostRecentDocWithSummary.summary) {
            setSummary(mostRecentDocWithSummary.summary);
          } else {
            setSummary('');
          }
        } else {
          setRecentDocument(null);
          setSummary('');
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

  return (
    <Container className="mt-4 mb-5">
      <Row>
        <Col>
          <h1>IEP Document Summary</h1>
          <p className="lead">
            View the latest summary of your IEP document.
          </p>
          
          <Button 
            variant="outline-primary" 
            onClick={handleRefresh}
            className="mb-4"
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Refreshing...
              </>
            ) : (
              'Refresh Status'
            )}
          </Button>
          
          {error && (
            <Alert variant="danger">{error}</Alert>
          )}
          
          {loading && !error ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p className="mt-3">Loading document summary...</p>
            </div>
          ) : !recentDocument ? (
            <Alert variant="info">
              No documents found. Please upload an IEP document first.
            </Alert>
          ) : (
            <Card className="shadow-sm">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <div>
                  <FontAwesomeIcon icon={faFileAlt} className="me-2" />
                  {recentDocument.Key ? recentDocument.Key.split('/').pop() : 'Document'}
                </div>
                {recentDocument.status && renderStatusBadge(recentDocument.status)}
              </Card.Header>
              
              <Card.Body>
                <Row>
                  <Col md={12}>
                    <Card.Title>Document Details</Card.Title>
                    {/* <p>
                      <strong>Upload Date:</strong> {recentDocument.createdAt}
                    </p> */}
                    
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
                        <Card.Title className="mt-4">Document Summary</Card.Title>
                        <Card className="bg-light">
                          <Card.Body>
                            {summary ? (
                              <p className="mb-0">{summary}</p>
                            ) : (
                              <p className="text-muted mb-0">No summary available for this document.</p>
                            )}
                          </Card.Body>
                        </Card>
                      </>
                    )}
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default IEPSummarizationAndTranslation;