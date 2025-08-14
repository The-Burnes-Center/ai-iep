import React from 'react';
import { Button } from 'react-bootstrap';
import './LinkButton.css';

interface LinkButtonProps {
  onClick: () => void;
  disabled: boolean;
  buttonText: string;
}

const LinkButton = ({ onClick, disabled, buttonText }: LinkButtonProps) => {
  return (
    <Button 
      variant="link" 
      onClick={onClick}
      disabled={disabled}
      className="forgot-password-link"
    >
      {buttonText}
    </Button>
  );
};

export default LinkButton;