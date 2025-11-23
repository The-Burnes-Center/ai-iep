import React from 'react';
import './AIEPFooter.css';

const AIEPFooter: React.FC = () => {
  return (
    <footer className="aiep-footer">
      <img 
        src="/images/rainbow-stripe-desktop.png" 
        alt="Rainbow stripe" 
        className="footer-stripe-desktop"
      />
      <img 
        src="/images/rainbow-stripe-mobile.png" 
        alt="Rainbow stripe" 
        className="footer-stripe-mobile"
      />
      
      <div className="footer-content">
        <div className="footer-logo">
            <img src="/images/aiep-logo-vertical-white.svg" alt="AIEP Logo" />
            <p>Designing AI <br /> with and for <br /> communities</p>
        </div>
        <div className="footer-links">
            <ul>
                <li>Home</li>
                <li>Upload An IEP</li>
                <li>Support Center</li>
                <li>About Us</li>
            </ul>
        </div>
        <div className="footer-project-partners">
          <div className="footer-project-partners-logo">
            <img src="/images/govlab-negative.svg" alt="The Gov Lab Logo" />
          </div>
          <div className="footer-project-partners-logo">
            <img src="/images/burnes-logo-negative 1.svg" alt="The Burnes Center Logo" />
          </div>
          <div className="footer-project-partners-logo">
            <img src="/images/innovate-negative-tight 1.svg" alt="Innovate Public Schools Logo" />
          </div>
        </div>
      </div>


    </footer>
  );
};

export default AIEPFooter;

