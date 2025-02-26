// UploadIEPDocument.tsx
import React, { useState, useContext } from 'react';
import { 
  Form, 
  Button, 
  Container, 
  Row, 
  Col, 
  Alert, 
  ProgressBar, 
  Card,
  ListGroup
} from 'react-bootstrap';
import { AppContext } from '../../common/app-context';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import { FileUploader } from '../../common/file-uploader';
import { Utils } from '../../common/utils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faTimesCircle, faUpload } from '@fortawesome/free-solid-svg-icons';

// Define allowed file types and MIME types
const fileExtensions = new Set([
  ".csv", ".doc", ".docx", ".epub", ".odt", ".pdf", ".ppt", ".pptx",
  ".tsv", ".xlsx", ".eml", ".html", ".json", ".md", ".msg",
  ".rst", ".rtf", ".txt", ".xml",
]);

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
  
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<Map<string, string>>(new Map());
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);
  const [currentFileName, setCurrentFileName] = useState<string>("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;
    
    // Convert FileList to array
    const fileArray = Array.from(selectedFiles);
    
    if (fileArray.length > 10) {
      setGlobalError("Maximum 10 files allowed. Please select fewer files.");
      return;
    }
    
    const errors = new Map<string, string>();
    const validFiles: File[] = [];
    
    fileArray.forEach(file => {
      const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!fileExtensions.has(fileExtension)) {
        errors.set(file.name, "File format not supported");
      } else if (file.size > 100 * 1024 * 1024) { // 100MB
        errors.set(file.name, "File size exceeds 100MB limit");
      } else {
        validFiles.push(file);
      }
    });
    
    setFiles(validFiles);
    setFileErrors(errors);
    setGlobalError(null);
  };

  const removeFile = (index: number) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploadStatus('uploading');
    setUploadProgress(0);
    setCurrentFileIndex(0);
    
    const uploader = new FileUploader();
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    let uploadedSize = 0;
    let hasError = false;
    
    for (let i = 0; i < files.length; i++) {
      if (hasError) break;
      
      const file = files[i];
      setCurrentFileName(file.name);
      setCurrentFileIndex(i);
      let currentFileUploaded = 0;
      
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
            currentFileUploaded = uploaded;
            const totalUploaded = uploadedSize + currentFileUploaded;
            const percent = Math.round((totalUploaded / totalSize) * 100);
            setUploadProgress(percent);
          }
        );
        
        uploadedSize += file.size;
      } catch (error) {
        console.error('Upload error:', error);
        setGlobalError(typeof error === 'string' ? error : 'An error occurred during upload');
        hasError = true;
        setUploadStatus('error');
      }
    }
    
    if (!hasError) {
      setUploadStatus('success');
      setFiles([]);
      // Call the callback function to notify parent component
      onUploadComplete();
    }
  };

  const renderFileList = () => {
    if (files.length === 0) return null;
    
    return (
      <ListGroup className="mt-3">
        {files.map((file, index) => (
          <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
            <div>
              <FontAwesomeIcon icon={faFileAlt} className="me-2" />
              {file.name} ({Utils.bytesToSize(file.size)})
            </div>
            <Button 
              variant="link" 
              className="text-danger" 
              onClick={() => removeFile(index)}
            >
              <FontAwesomeIcon icon={faTimesCircle} />
            </Button>
          </ListGroup.Item>
        ))}
      </ListGroup>
    );
  };

  const renderProgressBar = () => {
    if (uploadStatus !== 'uploading') return null;
    
    return (
      <div className="mt-3">
        <p>
          Uploading {currentFileIndex + 1} of {files.length}: {currentFileName}
        </p>
        <ProgressBar 
          now={uploadProgress} 
          label={`${uploadProgress}%`} 
          animated 
        />
      </div>
    );
  };

  const renderStatusAlert = () => {
    if (uploadStatus === 'success') {
      return (
        <Alert variant="success" className="mt-3">
          All files have been uploaded successfully!
        </Alert>
      );
    } else if (uploadStatus === 'error') {
      return (
        <Alert variant="danger" className="mt-3">
          Error uploading files. Please try again.
        </Alert>
      );
    }
    return null;
  };

  return (
    <Container>
      <Card className="mt-4">
        <Card.Body>
          <Card.Title>Upload IEP Documents</Card.Title>
          <Card.Text>
            Select files to upload. Supported file types include PDF, Word, Excel, and other document formats.
            Maximum 10 files, each up to 100MB.
          </Card.Text>
          
          {globalError && (
            <Alert variant="danger">{globalError}</Alert>
          )}
          
          <Form>
            <Form.Group controlId="formFileMultiple" className="mb-3">
              <Form.Label>Choose files</Form.Label>
              <Form.Control 
                type="file" 
                multiple 
                onChange={handleFileChange}
                disabled={uploadStatus === 'uploading'}
              />
              <Form.Text className="text-muted">
                Supported formats: {Array.from(fileExtensions).join(', ')}
              </Form.Text>
            </Form.Group>
            
            {renderFileList()}
            {renderProgressBar()}
            {renderStatusAlert()}
            
            <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-3">
              <Button 
                variant="primary" 
                onClick={handleUpload}
                disabled={files.length === 0 || uploadStatus === 'uploading'}
              >
                <FontAwesomeIcon icon={faUpload} className="me-2" />
                Upload Documents
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default UploadIEPDocument;