import React, { useContext, useEffect, useState } from 'react';
import { 
  Alert, 
  Card,
  Spinner
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import './CurrentIEPDocument.css';
import { useLanguage } from '../../common/language-context';

export interface CurrentIEPDocumentProps {
  onRefreshNeeded: () => void;
}

const CurrentIEPDocument: React.FC<CurrentIEPDocumentProps> = ({ onRefreshNeeded }) => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  const navigate = useNavigate();
  
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { t } = useLanguage();

  const fetchDocument = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get the most recent document
      const recentDocument = await apiClient.getMostRecentDocumentWithSummary();

      if (recentDocument && recentDocument.documentUrl) {
        // Extract the filename from the document URL
        // Example: s3://bucket/path/to/file/filename.pdf
        const documentUrl = recentDocument.documentUrl;
        const fileName = documentUrl.split('/').pop() || 'No filename available';
        setDocumentName(fileName);
      } else {
        setDocumentName(null);
      }
    } catch (err) {
      console.error('Error fetching document:', err);
      // setError('Failed to load document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocument();
    // Call the onRefreshNeeded callback after fetching to signal that refresh is complete
    if (onRefreshNeeded) {
      onRefreshNeeded();
    }
  }, [onRefreshNeeded]);

  const handleAlertClick = () => {
    navigate('/summary-and-translations');
  };

  return (
    <Card className="current-document-container">
      <Card.Body>        
        {error && (
          <Alert variant="danger">{error}</Alert>
        )}
        
        {loading ? (
          <div className="text-center my-4">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">{t('current.loading')}</span>
            </Spinner>
          </div>
        ) : documentName ? (
        <>
        <h4 className="document-title">{t('current.title')}</h4>
          <Alert 
            variant="info" 
            className="document-info-alert d-flex align-items-center"
            onClick={handleAlertClick}
            style={{ cursor: 'pointer' }}
          >
            <i className="bi bi-file-earmark-text me-3" style={{ fontSize: '1.5rem' }}></i>
            <div>
              <p className="mb-0 fw-bold">{documentName}</p>
              <small>{t('current.documentOnFile')}</small>
            </div>
          </Alert>
          </>
        ) : (
          <Alert variant="info" className="document-info-alert">
            {t('current.noDocument')}
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

export default CurrentIEPDocument;