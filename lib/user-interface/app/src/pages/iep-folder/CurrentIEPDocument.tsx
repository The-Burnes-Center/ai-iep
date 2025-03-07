import React, { useContext, useEffect, useState } from 'react';
import { 
  Alert, 
  Card,
  Spinner
} from 'react-bootstrap';
import { AppContext } from '../../common/app-context';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import './CurrentIEPDocument.css';

export interface CurrentIEPDocumentProps {
  onRefreshNeeded: () => void;
}

const CurrentIEPDocument: React.FC<CurrentIEPDocumentProps> = ({ onRefreshNeeded }) => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      setError('Failed to load document. Please try again.');
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

  return (
    <Card className="current-document-container">
      <Card.Body>
        <h4 className="document-title">Current IEP Document</h4>
        
        {error && (
          <Alert variant="danger">{error}</Alert>
        )}
        
        {loading ? (
          <div className="text-center my-4">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : documentName ? (
          <Alert variant="info" className="document-info-alert d-flex align-items-center">
            <i className="bi bi-file-earmark-text me-3" style={{ fontSize: '1.5rem' }}></i>
            <div>
              <p className="mb-0 fw-bold">{documentName}</p>
              <small>Current IEP document on file</small>
            </div>
          </Alert>
        ) : (
          <Alert variant="info" className="document-info-alert">
            No IEP document found. Please upload a document to get started.
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

export default CurrentIEPDocument;