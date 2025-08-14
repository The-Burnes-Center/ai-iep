import React from 'react';
import { Button, Spinner } from 'react-bootstrap';
import './SubmitButton.css';

interface SubmitButtonProps {
  loading: boolean;
  buttonText: string;
  disabled?: boolean;
  type?: 'submit' | 'button' | 'reset';
}

const SubmitButton = ({ 
  loading, 
  buttonText, 
  disabled = loading,
  type = 'submit'
}: SubmitButtonProps) => {
  return (
    <Button 
      variant="primary" 
      type={type} 
      disabled={disabled} 
      className="button-text"
    >
      {loading ? <Spinner animation="border" size="sm" /> : buttonText}
    </Button>
  );
};

export default SubmitButton;