import React from 'react';
import ParentRightsCarousel from '../components/ParentRightsCarousel';

const ParentRights: React.FC = () => {
  const slideData = [
    {
      id: 'slide-1',
      title: 'Your Rights as a Parent',
      content: 'You have the right to be involved in all decisions about your child\'s education and services.'
    },
    {
      id: 'slide-2',
      title: 'Right to Information',
      content: 'You have the right to access your child\'s educational records and receive information in your native language.'
    },
    {
      id: 'slide-3',
      title: 'Due Process Rights',
      content: 'You have the right to request a due process hearing if you disagree with decisions about your child\'s education.'
    },
    {
      id: 'slide-4',
      title: 'Right to Advocate',
      content: 'You have the right to bring an advocate or attorney to meetings about your child\'s educational program.'
    }
  ];

  return <ParentRightsCarousel slides={slideData} />;
};

export default ParentRights; 