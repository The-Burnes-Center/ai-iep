import { Button } from 'react-bootstrap';
import './GoToWebsiteButton.css';

interface GoToWebsiteButtonProps {
  url: string;
  buttonText: string;
}

const GoToWebsiteButton = ({ url, buttonText }: GoToWebsiteButtonProps) => {
  return (
    <Button 
      variant="outline-secondary" 
      className="go-to-website-button"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {buttonText}
    </Button>
  );
};

export default GoToWebsiteButton;