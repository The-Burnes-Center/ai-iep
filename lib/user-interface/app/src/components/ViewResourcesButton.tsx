import { Button } from 'react-bootstrap';
import './ViewResourcesButton.css';

interface ViewResourcesButtonProps {
  url: string;
  buttonText: string;
}

const ViewResourcesButton = ({ url, buttonText }: ViewResourcesButtonProps) => {
  return (
    <Button 
      variant="outline-secondary" 
      className="view-resources-button"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {buttonText}
    </Button>
  );
};

export default ViewResourcesButton;