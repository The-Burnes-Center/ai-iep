import React, { useState } from 'react';
import { Container, Row, Col, Alert } from 'react-bootstrap';
import UploadIEPDocument from './UploadIEPDocument';
import CurrentIEPDocument from './CurrentIEPDocument';
import './IEPDocumentView.css';

const IEPDocumentView: React.FC = () => {
  const [refreshNeeded, setRefreshNeeded] = useState(false);

  const handleUploadComplete = () => {
    setRefreshNeeded(true);
  };

  const handleRefreshNeeded = () => {
    setRefreshNeeded(false);
  };

  return (
    <Container className="document-container mt-4 mb-5">
      <Row>
        <Col>
          <h1 className="document-title"></h1>          
          {refreshNeeded && (
            <Alert variant="info" dismissible onClose={() => setRefreshNeeded(false)}>
              Document has been updated. Your current document information will refresh.
            </Alert>
          )}
          
          <div className="document-sections-container">
            <div className="document-section">
              <UploadIEPDocument onUploadComplete={handleUploadComplete} />
            </div>
            
            <div className="document-section">
              <CurrentIEPDocument onRefreshNeeded={handleRefreshNeeded} />
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default IEPDocumentView;