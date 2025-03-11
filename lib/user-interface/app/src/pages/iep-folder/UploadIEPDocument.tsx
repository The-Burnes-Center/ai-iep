// UploadIEPDocument.tsx
import React, { useState, useContext } from 'react';
import { 
  Form, 
  Button, 
  Container, 
  Alert, 
  ProgressBar, 
  Card,
  ListGroup
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import { FileUploader } from '../../common/file-uploader';
import { Utils } from '../../common/utils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faTimesCircle, faUpload } from '@fortawesome/free-solid-svg-icons';
import './UploadIEPDocument.css';

// Define allowed file types and MIME types
const fileExtensions = new Set([".doc", ".docx", ".pdf"]);

const mimeTypes = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.xml': 'application/xml',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.rtf': 'application/rtf',
  '.epub': 'application/epub+zip',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.tsv': 'text/tab-separated-values',
  '.eml': 'message/rfc822',
  '.msg': 'application/vnd.ms-outlook',
  '.rst': 'text/x-rst'
};

export interface UploadIEPDocumentProps {
  onUploadComplete: () => void;
}

const UploadIEPDocument: React.FC<UploadIEPDocumentProps> = ({ onUploadComplete }) => {
  const appContext = useContext(AppContext);
  const apiClient = new IEPDocumentClient(appContext);
  const navigate = useNavigate();
  
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentFileName, setCurrentFileName] = useState<string>("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    
    const fileExtension = selectedFile.name.slice(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!fileExtensions.has(fileExtension)) {
      setFileError("File format not supported");
      setFile(null);
    } else if (selectedFile.size > 100 * 1024 * 1024) { // 100MB
      setFileError("File size exceeds 100MB limit");
      setFile(null);
    } else {
      setFile(selectedFile);
      setFileError(null);
    }
    
    setGlobalError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploadStatus('uploading');
    setUploadProgress(0);
    setCurrentFileName(file.name);
    
    const uploader = new FileUploader();
    let hasError = false;
    
    try {
      const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const fileType = mimeTypes[fileExtension];
      
      // Get upload URL
      const uploadUrl = await apiClient.getUploadURL(file.name, fileType);
      
      // Upload file to S3
      await uploader.upload(
        file,
        uploadUrl,
        fileType,
        (uploaded: number) => {
          const percent = Math.round((uploaded / file.size) * 100);
          setUploadProgress(percent);
        }
      );
    } catch (error) {
      console.error('Upload error:', error);
      setGlobalError(typeof error === 'string' ? error : 'An error occurred during upload');
      hasError = true;
      setUploadStatus('error');
    }
    
    if (!hasError) {
      setUploadStatus('success');
      setFile(null);
      // Call the callback function to notify parent component
      onUploadComplete();
      
      // Navigate to summary page immediately after successful upload
      navigate('/summary-and-translations');
    }
  };

  const getProgressbarStatus = () => {
    switch (uploadStatus) {
      case 'error':
        return 'danger';
      case 'success':
        return 'success';
      default:
        return 'info';
    }
  };

  return (
    <Container className="p-0">
      <Card className="upload-container">
        <Card.Body>
          <h4 className="mb-3">Upload IEP Document</h4>
          <p>
            Maximum file size: 100MB.
          </p>
          
          {globalError && (
            <Alert variant="danger">{globalError}</Alert>
          )}
          
          <Form>
            <Form.Group controlId="formFile" className="mb-3">
              <Form.Control 
                type="file" 
                onChange={handleFileChange}
                disabled={uploadStatus === 'uploading'}
              />
              {fileError && (
                <Form.Text className="text-danger">
                  {fileError}
                </Form.Text>
              )}
              <Form.Text className="text-muted">
                Supported formats: {Array.from(fileExtensions).join(', ')}
              </Form.Text>
            </Form.Group>
            
            {file && (
              <ListGroup className="file-list">
                <ListGroup.Item className="d-flex justify-content-between align-items-center">
                  <div>
                    <FontAwesomeIcon icon={faFileAlt} className="me-2" />
                    {file.name} ({Utils.bytesToSize(file.size)})
                  </div>
                  <Button 
                    variant="link" 
                    className="text-danger" 
                    onClick={() => setFile(null)}
                  >
                    <FontAwesomeIcon icon={faTimesCircle} />
                  </Button>
                </ListGroup.Item>
              </ListGroup>
            )}
            
            {uploadStatus === 'uploading' && (
              <div className="progress-container">
                <p>{currentFileName}</p>
                <ProgressBar 
                  now={uploadProgress} 
                  label={`${uploadProgress}%`} 
                  variant={getProgressbarStatus()}
                  animated={uploadStatus === 'uploading'}
                />
              </div>
            )}
            
            {uploadStatus === 'success' && (
              <Alert variant="success" className="mt-3">
                File has been uploaded successfully!
              </Alert>
            )}
            
            {uploadStatus === 'error' && (
              <Alert variant="danger" className="mt-3">
                Error uploading file. Please try again.
              </Alert>
            )}
            
            <div className="d-grid gap-2 mt-3">
              <Button 
                variant="primary" 
                onClick={handleUpload}
                disabled={!file || uploadStatus === 'uploading'}
              >
                <FontAwesomeIcon icon={faUpload} className="me-2" />
                Upload Document
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default UploadIEPDocument;