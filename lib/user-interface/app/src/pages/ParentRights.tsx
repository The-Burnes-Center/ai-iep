import React from 'react';
import ParentRightsCarousel from '../components/ParentRightsCarousel';

const ParentRights: React.FC = () => {
  const slideData = [
    {
      id: 'slide-1',
      title: 'You can request a translator',
      content: 'You can request a translator for IEP meetings to ensure clear communication.'
    },
    {
      id: 'slide-2',
      title: 'You can take your time',
      content: 'You have the right to take your time before signing an IEP - you don\'t need to sign until you\'re ready.'
    },
    {
      id: 'slide-3',
      title: 'You can consent or not',
      content: 'You can consent to all, some, or none of the proposed services - your child won\'t receive new services without your approval.'
    },
    {
      id: 'slide-4',
      title: 'You can request a meeting',
      content: 'You have the right to request an IEP meeting at any time, not just at  the annual review, and the school must schedule it within 30 days.'
    },
    {
      id: 'slide-5',
      title: 'You can reschedule',
      content: 'If an administrator isn\'t present at the meeting, you have the right to reschedule for a time when they can attend.'
    },
    {
      id: 'slide-6',
      title: 'You must be given a booklet of your rights',
      content: 'By law, your case manager must provide you with a booklet of your parental rights before the IEP meeting.'
    }
  ];

  return <ParentRightsCarousel slides={slideData} />;
};

export default ParentRights; 