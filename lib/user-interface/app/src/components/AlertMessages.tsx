import React from 'react';
import { Alert } from 'react-bootstrap';
import './AlertMessages.css';

interface AlertMessagesProps {
  error: string | null;
  successMessage: string | null;
}

const AlertMessages = ({ error, successMessage }: AlertMessagesProps) => {
  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}
    </>
  );
};

export default AlertMessages;