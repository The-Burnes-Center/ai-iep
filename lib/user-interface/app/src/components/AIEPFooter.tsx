import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../common/language-context';
import './AIEPFooter.css';

const AIEPFooter: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleNavigation = (route: string) => {
    navigate(route);
  };

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
            <p dangerouslySetInnerHTML={{ __html: t('footer.tagline') }} />
        </div>
        <div className="footer-links">
            <ul>
                <li onClick={() => handleNavigation('/summary-and-translations')}>{t('footer.home')}</li>
                <li onClick={() => handleNavigation('/iep-documents')}>{t('footer.uploadIEP')}</li>
                <li onClick={() => handleNavigation('/support-center')}>{t('footer.supportCenter')}</li>
                <li onClick={() => handleNavigation('/about-the-app')}>{t('footer.aboutUs')}</li>
            </ul>
        </div>
        <div className="footer-project-partners">
          <div className="footer-project-partners-logo">
            <a href="https://thegovlab.org/" target="_blank" rel="noopener noreferrer">
              <img src="/images/govlab-negative.svg" alt="The Gov Lab Logo" />
            </a>
          </div>
          <div className="footer-project-partners-logo">
            <a href="https://burnes.northeastern.edu/" target="_blank" rel="noopener noreferrer">
              <img src="/images/burnes-logo-negative 1.svg" alt="The Burnes Center Logo" />
            </a>
          </div>
          <div className="footer-project-partners-logo">
            <a href="https://innovateschools.org/" target="_blank" rel="noopener noreferrer">
              <img src="/images/innovate-negative-tight 1.svg" alt="Innovate Public Schools Logo" />
            </a>
          </div>
        </div>
      </div>


    </footer>
  );
};

export default AIEPFooter;

