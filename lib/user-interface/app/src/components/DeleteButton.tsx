import { Button, Spinner } from 'react-bootstrap';
import './DeleteButton.css';

interface DeleteButtonProps {
  loading: boolean;
  buttonText: string;
  disabled?: boolean;
  type?: 'submit' | 'button' | 'reset';
}

const DeleteButton = ({ 
  loading, 
  buttonText, 
  disabled = loading,
  type = 'submit'
}: DeleteButtonProps) => {
  return (
    <Button 
      variant="outline-primary" 
      type={type} 
      disabled={disabled} 
      className="delete-button-login"
    >
      {loading ? <Spinner animation="border" size="sm" /> : buttonText}
    </Button>
  );
};

export default DeleteButton;