import React from 'react';
import { Form } from 'react-bootstrap';
import './EmailInput.css';
import FormLabel from './FormLabel';

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
      <FormLabel label={label} />
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