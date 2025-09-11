import React from 'react';
import MobileBottomNavigation from './MobileBottomNavigation';

const SurveyForm: React.FC = () => {
  return (
    <div style={{ 
      backgroundColor: '#F5F3EE',
      minHeight: '100vh',
      width: '100%'
    }}>
      <h2>Survey Form :</h2>

      <MobileBottomNavigation />
    </div>
  );
};

export default SurveyForm;