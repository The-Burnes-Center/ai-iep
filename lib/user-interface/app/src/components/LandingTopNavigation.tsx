import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../common/language-context';
import { IconFileDescription, IconHelpCircle, IconInfoCircle, IconHome } from '@tabler/icons-react';
import './LandingTopNavigation.css';

const LandingTopNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const navigationItems = [
    {
      icon: IconHome,
      label: t('navigation.home') || 'Home',
      route: '/'
    },
    {
      icon: IconFileDescription,
      label: t('navigation.uploadIEP') || 'Upload An IEP',
      route: '/login'
    },
    {
      icon: IconHelpCircle,
      label: t('navigation.faqs') || 'FAQs',
      route: '/faqs'
    },
    {
      icon: IconInfoCircle,
      label: t('navigation.about') || 'About The Project',
      route: '/about-the-project'
    },
  ];

  const handleNavigation = (route: string) => {
    navigate(route);
  };

  return (
    <div className="landing-top-navigation">
      <div className="navigation-container">
        {navigationItems.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <button
              key={index}
              className={`nav-item ${location.pathname === item.route ? 'active' : ''}`}
              onClick={() => handleNavigation(item.route)}
              aria-label={`Navigate to ${item.label}`}
            >
              <IconComponent size={24} stroke={1.5} />
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LandingTopNavigation;

