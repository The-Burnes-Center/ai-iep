import { Form } from 'react-bootstrap';
import './FormLabel.css';

interface FormLabelProps {
  label: string;
}

const FormLabel = ({ label }: FormLabelProps) => {
  return (
    <Form.Label className="form-label-bold">{label}</Form.Label>
  );
};

export default FormLabel;