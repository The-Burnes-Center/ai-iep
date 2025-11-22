/*Move this component to the pages folder*/
import React from 'react';
import MobileBottomNavigation from './MobileBottomNavigation';

const AboutAIEP: React.FC = () => {
  return (
    <div style={{ 
      backgroundColor: '#F5F3EE',
      minHeight: '100vh',
      width: '100%'
    }}>
      <MobileBottomNavigation />
      <h2>This page is under maintenance</h2>
      {/* About AIEP content will go here */}
    </div>
  );
};

export default AboutAIEP;