import React from 'react';
import { Button } from 'react-bootstrap';
import './LoginMethodToggle.css';

interface LoginMethodToggleProps {
  showMobileLogin: boolean;
  onMobileLoginClick: () => void;
  onEmailLoginClick: () => void;
  mobileLoginText: string;
  emailLoginText: string;
}

const LoginMethodToggle: React.FC<LoginMethodToggleProps> = ({
  showMobileLogin,
  onMobileLoginClick,
  onEmailLoginClick,
  mobileLoginText,
  emailLoginText
}) => {
  return (
    <div className="login-method-toggle-container d-grid gap-2 mb-4">
      <div className="btn-group" role="group">
        <Button
          variant='secondary'
          onClick={onMobileLoginClick}
          className={`button-text ${showMobileLogin ? 'selected-login-method' : 'unselected-login-method'}` }
        >
          {mobileLoginText}
        </Button>
        <Button
          variant='secondary'
          onClick={onEmailLoginClick}
          className={`button-text ${!showMobileLogin ? 'selected-login-method' : 'unselected-login-method'}` }
        >
          {emailLoginText}
        </Button>
      </div>
    </div>
  );
};

export default LoginMethodToggle;