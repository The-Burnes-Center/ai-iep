import React from 'react';
import MobileBottomNavigation from './MobileBottomNavigation';

const SupportCenter: React.FC = () => {
  return (
    <div style={{ 
      backgroundColor: '#F5F3EE',
      minHeight: '100vh',
      width: '100%'
    }}>
      {/* Support Center content will go here */}
      <MobileBottomNavigation />
    </div>
  );
};

export default SupportCenter;