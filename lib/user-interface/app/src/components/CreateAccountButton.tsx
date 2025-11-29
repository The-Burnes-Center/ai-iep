import React from 'react';
import { Button } from 'react-bootstrap';
import './CreateAccountButton.css';

interface CreateAccountButtonProps {
  onClick: () => void;
  buttonText: string;
  disabled?: boolean;
}

const CreateAccountButton = ({ onClick, buttonText, disabled = false }: CreateAccountButtonProps) => {
  return (
    <Button 
      variant="secondary" 
      onClick={onClick}
      disabled={disabled}
      className="create-account-button"
    >
      {buttonText}
    </Button>
  );
};

export default CreateAccountButton;


