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
      <span className="arrow-icon">
        <img src="/images/arrow.svg" alt="" />
      </span>
    </Button>
  );
};

export default GoToWebsiteButton;