import { Form } from 'react-bootstrap';

interface FormLabelProps {
  label: string;
}

const FormLabel = ({ label }: FormLabelProps) => {
  return (
    <Form.Label className="form-label-bold">{label}</Form.Label>
  );
};

export default FormLabel;