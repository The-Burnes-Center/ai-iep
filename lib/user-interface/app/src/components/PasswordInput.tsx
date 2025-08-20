import React from 'react';
import { Form, InputGroup, Button } from 'react-bootstrap';
import FormLabel from './FormLabel';
import './PasswordInput.css';

interface PasswordInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onToggleVisibility: () => void;
  required?: boolean;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  showPassword,
  onToggleVisibility,
  required = false
}) => {
  return (
    <Form.Group className="password-input-container mb-3">
      <FormLabel label={label} />
      <InputGroup>
        <Form.Control
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="password-input-control" 
        />
        <Button 
          variant="outline-secondary"
          onClick={onToggleVisibility}
        >
          <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
        </Button>
      </InputGroup>
    </Form.Group>
  );
};

export default PasswordInput;