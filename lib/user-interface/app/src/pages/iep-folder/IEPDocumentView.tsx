import React, { useState } from 'react';
import { Container, Row, Col, Alert } from 'react-bootstrap';
import UploadIEPDocument from './UploadIEPDocument';
import CurrentIEPDocument from './CurrentIEPDocument';

const IEPDocumentView: React.FC = () => {
  const [refreshNeeded, setRefreshNeeded] = useState(false);

  const handleUploadComplete = () => {
    setRefreshNeeded(true);
  };

  const handleRefreshNeeded = () => {
    setRefreshNeeded(false);
  };

  return (
    <Container className="mt-4 mb-5">
      <Row>
        <Col>
          <h1>IEP Document Management</h1>
          <p className="lead">
            Upload and manage your IEP document.
          </p>
          
          {refreshNeeded && (
            <Alert variant="info" dismissible onClose={() => setRefreshNeeded(false)}>
              Document has been updated. Your current document information will refresh.
            </Alert>
          )}
          
          <div className="mb-4">
            <UploadIEPDocument onUploadComplete={handleUploadComplete} />
          </div>
          
          <div>
            <CurrentIEPDocument onRefreshNeeded={handleRefreshNeeded} />
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default IEPDocumentView;