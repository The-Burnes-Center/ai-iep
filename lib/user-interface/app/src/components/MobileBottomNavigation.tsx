import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './MobileBottomNavigation.css';

const MobileBottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    {
      icon: 'bi-book-fill',
      label: 'Summary',
      route: '/summary-and-translations'
    },
    {
      icon: 'bi-question-circle-fill',
      label: 'Support',
      route: '/support-center'
    },
    {
      icon: 'bi-person-fill',
      label: 'Account',
      route: '/profile'
    },
    {
      icon: 'bi-info-circle-fill',
      label: 'About',
      route: '/about-aiep'
    }
  ];

  const handleNavigation = (route: string) => {
    navigate(route);
  };

  return (
    <div className="mobile-bottom-navigation">
      <div className="navigation-container">
        {navigationItems.map((item, index) => (
          <button
            key={index}
            className={`nav-item ${location.pathname === item.route ? 'active' : ''}`}
            onClick={() => handleNavigation(item.route)}
            aria-label={`Navigate to ${item.label}`}
          >
            <i className={`bi ${item.icon}`}></i>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MobileBottomNavigation;