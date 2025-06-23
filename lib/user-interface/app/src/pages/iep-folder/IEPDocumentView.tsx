import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Alert, Button } from 'react-bootstrap';
import UploadIEPDocument from './UploadIEPDocument';
import CurrentIEPDocument from './CurrentIEPDocument';
import './IEPDocumentView.css';
import { useLanguage } from '../../common/language-context';
import MobileBottomNavigation from '../../components/MobileBottomNavigation';

const IEPDocumentView: React.FC = () => {
  const navigate = useNavigate();
  
  const [refreshNeeded, setRefreshNeeded] = useState(false);
  const [documentExists, setDocumentExists] = useState(false);

  const handleUploadComplete = () => {
    setRefreshNeeded(true);
  };

  const handleRefreshNeeded = () => {
    setRefreshNeeded(false);
  };

  const handleDocumentStateChange = (exists: boolean) => {
    setDocumentExists(exists);
  };

  const handleBackClick = () => {
    navigate('/welcome-page');
  };

  const { t } = useLanguage();

  return (
    <>
    <Container className="document-container mt-4 mb-5">
      <div className="mt-3 text-start">
        <Button variant="outline-secondary" onClick={handleBackClick}>
        {t('document.back')}
        </Button>
      </div>
      <Row>
        <Col>
          <h1 className="document-title"></h1>          
          {refreshNeeded && (
            <Alert variant="info" dismissible onClose={() => setRefreshNeeded(false)}>
              {t('document.updateAlert')}
            </Alert>
          )}
          
          <div className="document-sections-container">
            <div className="document-section">
              <UploadIEPDocument 
                onUploadComplete={handleUploadComplete} 
                hasExistingDocument={documentExists}
              />
            </div>
            
            <div className="document-section">
              <CurrentIEPDocument 
                onRefreshNeeded={handleRefreshNeeded}
                onDocumentStateChange={handleDocumentStateChange}
              />
            </div>
          </div>
        </Col>
      </Row>
    </Container>
        <MobileBottomNavigation />
    </>
  );
};

export default IEPDocumentView;