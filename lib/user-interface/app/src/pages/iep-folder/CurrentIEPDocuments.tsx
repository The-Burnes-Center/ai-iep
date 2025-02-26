import React, { useContext, useEffect, useState } from 'react';
import { 
  Table, 
  Button, 
  Container, 
  Row, 
  Col, 
  Alert, 
  Card,
  Spinner,
  Modal
} from 'react-bootstrap';
import { AppContext } from '../../common/app-context';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faDownload, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { Utils } from '../../common/utils';
import { saveAs } from 'file-saver';

export interface CurrentIEPDocumentsProps {
  onRefreshNeeded: () => void;
}

interface DocumentItem {
  Key: string;
  LastModified: string;
  Size: number;
}

const CurrentIEPDocuments: React.FC<CurrentIEPDocumentsProps> = ({ onRefreshNeeded }) => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiClient.getDocuments();
      if (result && result.Contents) {
        setDocuments(result.Contents);
      } else {
        setDocuments([]);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleRefresh = () => {
    fetchDocuments();
  };

  const handleDeleteClick = (document: DocumentItem) => {
    setSelectedDocument(document);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedDocument) return;
    
    setLoading(true);
    try {
      await apiClient.deleteFile(selectedDocument.Key);
      await fetchDocuments();
      onRefreshNeeded();
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Failed to delete document. Please try again.');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setSelectedDocument(null);
    }
  };

  const handleDownload = async (document: DocumentItem) => {
    try {
      const downloadUrl = await apiClient.getDownloadURL(document.Key);
      
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${document.Key}`);
      }
      
      const blob = await response.blob();
      const fileName = document.Key.substring(document.Key.lastIndexOf('/') + 1);
      
      saveAs(blob, fileName);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file. Please try again.');
    }
  };

  // Extract filename from the full path key
  const getFileName = (key: string) => {
    return key.split('/').pop() || key;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Container>
      <Card className="mt-4">
        <Card.Body>
          <Card.Title className="d-flex justify-content-between align-items-center">
            IEP Documents
            <Button 
              variant="outline-primary" 
              onClick={handleRefresh}
              disabled={loading}
            >
              <FontAwesomeIcon icon={faSyncAlt} className="me-2" />
              Refresh
            </Button>
          </Card.Title>
          
          {error && (
            <Alert variant="danger">{error}</Alert>
          )}
          
          {loading ? (
            <div className="text-center my-4">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : documents.length === 0 ? (
            <Alert variant="info">
              No documents found. Upload documents to see them here.
            </Alert>
          ) : (
            <Table responsive striped hover>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Upload Date</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, index) => (
                  <tr key={index}>
                    <td>{getFileName(doc.Key)}</td>
                    <td>{formatDate(doc.LastModified)}</td>
                    <td>{Utils.bytesToSize(doc.Size)}</td>
                    <td>
                      <Button 
                        variant="outline-primary" 
                        size="sm" 
                        className="me-2"
                        onClick={() => handleDownload(doc)}
                      >
                        <FontAwesomeIcon icon={faDownload} />
                      </Button>
                      <Button 
                        variant="outline-danger" 
                        size="sm"
                        onClick={() => handleDeleteClick(doc)}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete {selectedDocument ? getFileName(selectedDocument.Key) : ''}?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default CurrentIEPDocuments;