import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, Button, Badge, Nav } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import ReactMarkdown from 'react-markdown';
import './IEPMarkdown.css';

const IEPMarkdown: React.FC = () => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [documentPages, setDocumentPages] = useState<any[]>([]);
  const [activePage, setActivePage] = useState<number>(0);
  
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        const document = await apiClient.getMostRecentDocumentWithSummary();
        
        if (document && document.ocrData && document.ocrData.pages) {
          console.log("OCR data:", document.ocrData);
          setDocumentPages(document.ocrData.pages);
        } else {
          setError('No OCR data found in the document');
        }
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('Failed to load document. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDocument();
  }, []);
  
  const handleBackClick = () => {
    navigate('/welcome-page');
  };
  
  const handlePageSelect = (pageIndex: number) => {
    setActivePage(pageIndex);
  };
  
  const renderPageNavigation = () => {
    return (
      <Nav variant="pills" className="page-navigation">
        {documentPages.map((page, index) => (
          <Nav.Item key={index}>
            <Nav.Link 
              active={activePage === index}
              onClick={() => handlePageSelect(index)}
            >
              Page {index + 1}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
    );
  };
  
  if (loading) {
    return (
      <Container className="markdown-container">
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-3">Loading document...</p>
        </div>
      </Container>
    );
  }
  
  if (error) {
    return (
      <Container className="markdown-container">
        <Alert variant="danger">
          {error}
        </Alert>
        <Button variant="outline-secondary" onClick={handleBackClick}>
          Back to Home
        </Button>
      </Container>
    );
  }
  
  if (!documentPages || documentPages.length === 0) {
    return (
      <Container className="markdown-container">
        <Alert variant="info">
          No document content available. Please upload a document first.
        </Alert>
        <Button variant="outline-secondary" onClick={handleBackClick}>
          Back to Home
        </Button>
      </Container>
    );
  }
  
  const currentPage = documentPages[activePage];
  
  return (
    <Container className="markdown-container mt-4 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Button variant="outline-secondary" onClick={handleBackClick}>
          Back
        </Button>
        <h2 className="mb-0">IEP Document - Original Text</h2>
        <div></div> {/* Empty div for flex spacing */}
      </div>
      
      {renderPageNavigation()}
      
      <Card className="markdown-card mt-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">Page {activePage + 1} of {documentPages.length}</h4>
          <Badge bg="info">Index: {currentPage.index}</Badge>
        </Card.Header>
        <Card.Body className="markdown-content">
          <ReactMarkdown>
            {currentPage.markdown}
          </ReactMarkdown>
        </Card.Body>
      </Card>
      
      {currentPage.images && currentPage.images.length > 0 && (
        <div className="mt-3">
          <h5>Page contains {currentPage.images.length} image(s)</h5>
          <div className="image-info">
            {currentPage.images.map((image, idx) => (
              <div key={idx} className="image-metadata">
                <Badge bg="secondary">Image ID: {image.id}</Badge>
                <small>Position: ({image.top_left_x}, {image.top_left_y}) - ({image.bottom_right_x}, {image.bottom_right_y})</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </Container>
  );
};

export default IEPMarkdown;