import React from 'react';
import { Form } from 'react-bootstrap';
import AuthHeader from './AuthHeader';
import EmailInput from './EmailInput';
import PasswordInput from './PasswordInput';
import AlertMessages from './AlertMessages';
import SubmitButton from './SubmitButton';
import LinkButton from './LinkButton';
import './CustomLogin.css';
import FormLabel from './FormLabel';

interface ForgotPasswordProps {
  t: (key: string) => string;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  resetSent: boolean;
  resetEmail: string;
  resetCode: string;
  newPassword: string;
  confirmPassword: string;
  showNewPassword: boolean;
  showConfirmPassword: boolean;
  setResetEmail: (value: string) => void;
  setResetCode: (value: string) => void;
  setNewPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  setShowNewPassword: (value: boolean) => void;
  setShowConfirmPassword: (value: boolean) => void;
  setShowForgotPassword: (value: boolean) => void;
  setResetSent: (value: boolean) => void;
  handleForgotPassword: (e: React.FormEvent) => void;
  handleResetPassword: (e: React.FormEvent) => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({
  t,
  loading,
  error,
  successMessage,
  resetSent,
  resetEmail,
  resetCode,
  newPassword,
  confirmPassword,
  showNewPassword,
  showConfirmPassword,
  setResetEmail,
  setResetCode,
  setNewPassword,
  setConfirmPassword,
  setShowNewPassword,
  setShowConfirmPassword,
  setShowForgotPassword,
  setResetSent,
  handleForgotPassword,
  handleResetPassword
}) => {
  return (
    <>
      <AuthHeader title={t('auth.resetPassword')} />
        
        {!resetSent ? (
          <Form onSubmit={handleForgotPassword}>
            <EmailInput
              label={t('auth.email')}
              placeholder={t('auth.enterEmail')}
              value={resetEmail}
              onChange={setResetEmail}
            />
            
            <AlertMessages error={error} successMessage={successMessage} />
            
            <div className="d-grid gap-2">
              <SubmitButton 
                loading={loading}
                buttonText={t('auth.sendResetCode')}
              />
              <LinkButton
                onClick={() => setShowForgotPassword(false)}
                disabled={loading}
                buttonText={t('auth.backToLogin')}
              />
            </div>
          </Form>
        ) : (
          <Form onSubmit={handleResetPassword}>
            <Form.Group className="mb-3">
              <FormLabel label={t('auth.resetCode')} />
              <Form.Control
                type="text"
                placeholder={t('auth.enterResetCode')}
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                required
              />
            </Form.Group>
            
            <PasswordInput
              label={t('auth.newPassword')}
              placeholder={t('auth.newPassword')}
              value={newPassword}
              onChange={setNewPassword}
              showPassword={showNewPassword}
              onToggleVisibility={() => setShowNewPassword(!showNewPassword)}
              required
            />

            <PasswordInput
              label={t('auth.passwordConfirm')}
              placeholder={t('auth.passwordConfirm')}
              value={confirmPassword}
              onChange={setConfirmPassword}
              showPassword={showConfirmPassword}
              onToggleVisibility={() => setShowConfirmPassword(!showConfirmPassword)}
              required
            />

            <AlertMessages error={error} successMessage={successMessage} />

            <div className="d-grid gap-2">
              <SubmitButton 
                loading={loading}
                buttonText={t('auth.resetPassword')}
              />
              <LinkButton
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                }}
                disabled={loading}
                buttonText={t('auth.backToLogin')}
              />
            </div>
          </Form>
        )}
    </>
  );
};

export default ForgotPassword;