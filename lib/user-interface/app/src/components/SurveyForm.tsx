import React, { useEffect } from 'react';
import MobileBottomNavigation from './MobileBottomNavigation';
import './SurveyForm.css';

// Extend Window interface to include jotformEmbedHandler
declare global {
  interface Window {
    jotformEmbedHandler: (selector: string, baseUrl: string) => void;
  }
}

const SurveyForm: React.FC = () => {
  useEffect(() => {
    // Load JotForm embed handler script
    const script = document.createElement('script');
    script.src = 'https://cdn.jotfor.ms/s/umd/latest/for-form-embed-handler.js';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      // Initialize JotForm embed handler after script loads
      if (window.jotformEmbedHandler) {
        window.jotformEmbedHandler("iframe[id='JotFormIFrame-250765400338050']", "https://form.jotform.com/");
      }
    };

    return () => {
      // Cleanup script on component unmount
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="survey-form-container">
      <h2 className="survey-form-title">Survey Form:</h2>

      <div className="jotform-container">
        <iframe
          id="JotFormIFrame-250765400338050"
          title="The AIEP Project"
          onLoad={() => window.parent.scrollTo(0,0)}
          allowTransparency={true}
          allow="geolocation; microphone; camera; fullscreen; payment"
          src="https://form.jotform.com/250765400338050"
          className="jotform-iframe"
          scrolling="no"
        />
      </div>

      <MobileBottomNavigation />
    </div>
  );
};

export default SurveyForm;