import React from 'react';
import { Form } from 'react-bootstrap';
import FormLabel from './FormLabel';
import './MobileInput.css';

interface MobileInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoFocus?: boolean;
}

const MobileInput: React.FC<MobileInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  required = true,
  autoFocus = true
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove non-digits and limit to 6 characters
    const sanitizedValue = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange(sanitizedValue);
  };

  return (
    <Form.Group className="mb-3">
      <FormLabel label={label} />
      <Form.Control
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        maxLength={6}
        required={required}
        className="sms-code-input"
        autoFocus={autoFocus}
      />
    </Form.Group>
  );
};

export default MobileInput;