import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../common/language-context';
import { IconFileDescription, IconHeartHandshake, IconUser, IconInfoCircle } from '@tabler/icons-react';
import './MobileBottomNavigation.css';

interface MobileBottomNavigationProps {
  tutorialPhaseEnabled?: boolean;
  tutorialPhase?:string;
}

const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({ 
  tutorialPhaseEnabled = false,
  tutorialPhase =''
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const navigationItems = [
    {
      icon: IconFileDescription,
      label: t('navigation.summary') || 'Summary',
      route: '/summary-and-translations'
    },
    {
      icon: IconHeartHandshake,
      label: t('navigation.support') || 'Support',
      route: '/support-center'
    },
    {
      icon: IconInfoCircle,
      label: t('navigation.rights') || 'Rights',
      route: '/parent-rights'
    },
    {
      icon: IconUser,
      label: t('navigation.account') || 'Account',
      route: '/account-center'
    },
  ];

  const handleNavigation = (route: string) => {
    navigate(route);
  };

  return (
    <div className="mobile-bottom-navigation">
      {tutorialPhaseEnabled ?
      (

        tutorialPhase === 'app-tutorial' || tutorialPhase === 'parent-rights' ? (
        <div className="processing-line">
          {t('navigation.processing') || 'Your document is being processed...'}
        </div>
        ) :
        (<>
        <div className="processing-header">
          {t('navigation.processing') || 'Your document is being processed...'}
        </div>
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
        </>)
      ) : (
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
      )}
    </div>
  );
};

export default MobileBottomNavigation;