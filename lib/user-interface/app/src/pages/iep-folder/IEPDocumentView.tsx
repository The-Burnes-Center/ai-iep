import React, { useState } from 'react';
import { Container, Row, Col, Tabs, Tab, Alert } from 'react-bootstrap';
import UploadIEPDocument from './UploadIEPDocument';
import CurrentIEPDocuments from './CurrentIEPDocuments';

const IEPDocumentView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('current');
  const [refreshNeeded, setRefreshNeeded] = useState(false);

  const handleTabChange = (key: string | null) => {
    if (key) {
      setActiveTab(key);
      if (key === 'current' && refreshNeeded) {
        setRefreshNeeded(false);
      }
    }
  };

  const handleUploadComplete = () => {
    setRefreshNeeded(true);
    setActiveTab('current');
  };

  const handleRefreshNeeded = () => {
    setRefreshNeeded(true);
  };

  return (
    <Container className="mt-4 mb-5">
      <Row>
        <Col>
          <h1>IEP Document Management</h1>
          <p className="lead">
            Upload and manage IEP documents for your students.
          </p>
          
          {refreshNeeded && (
            <Alert variant="info" dismissible onClose={() => setRefreshNeeded(false)}>
              Documents have been updated. Please refresh the document list.
            </Alert>
          )}
          
          <Tabs
            activeKey={activeTab}
            onSelect={handleTabChange}
            className="mb-3"
          >
            <Tab eventKey="current" title="Current Documents">
              <CurrentIEPDocuments onRefreshNeeded={handleRefreshNeeded} />
            </Tab>
            <Tab eventKey="upload" title="Upload Documents">
              <UploadIEPDocument onUploadComplete={handleUploadComplete} />
            </Tab>
          </Tabs>
        </Col>
      </Row>
    </Container>
  );
};

export default IEPDocumentView;