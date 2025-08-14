import React from 'react';
import { Form } from 'react-bootstrap';
import './EmailInput.css';

interface EmailInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

const EmailInput = ({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  required = true 
}: EmailInputProps) => {
  return (
    <Form.Group className="mb-3">
      <Form.Label className="form-label-bold">{label}</Form.Label>
      <Form.Control
        type="email"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </Form.Group>
  );
};

export default EmailInput;