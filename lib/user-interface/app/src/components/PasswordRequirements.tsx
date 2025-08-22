import React from 'react';
import { Container, Form } from 'react-bootstrap';

interface PasswordRequirementsProps {
  title: string;
  firstRequirement: string;
  secondRequirement: string;
}

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ 
  title, 
  firstRequirement, 
  secondRequirement 
}) => {
  return (
    <Container className="mt-3 mb-3 p-3 border rounded bg-light">
      <Form.Text className="text-muted">
        {title}
        <ul>
          <li>{firstRequirement}</li>
          <li>{secondRequirement}</li>
        </ul>
      </Form.Text>
    </Container>
  );
};

export default PasswordRequirements;