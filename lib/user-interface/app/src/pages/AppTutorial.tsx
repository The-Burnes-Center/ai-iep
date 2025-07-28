import React from 'react';
import AppTutorialCarousel from '../components/AppTutorialCarousel';

const AppTutorial: React.FC = () => {
  const slideData = [
    {
      id: 'slide-1',
      title: 'What are we doing right now?',
      content: 'We’re summarizing the key aspects of your IEP. You’ll first see a general overview of the document, and then a summary for each one of the key sections.',
      image: '/images/carousel/surprised.png'
    },
    {
      id: 'slide-2',
      title: 'What are we doing right now?',
      content: 'We’re including the pages where we found the information we’re about to show. That way, you can double check the information in case something doesn’t make sense.',
      image: '/images/carousel/blissful.png'
    },
    {
      id: 'slide-3',
      title: 'What are we doing right now?',
      content: 'We’re translating the summaries to your language. The IEP document will remain in English, but the summaries we created will be translated to the language of your choice.',
      image: '/images/carousel/joyful.png'
    },
    {
      id: 'slide-4',
      title: 'What are we doing right now?',
      content: 'We’re removing your personal information from the summaries. You can rest assured that we will not store any of your or your child’s personal details.',
      image: '/images/carousel/surprised.png'
    },
    {
      id: 'slide-5',
      title: 'What are we doing right now?',
      content: 'Your IEP document won’t be changed. You can download the summaries we’re creating by clicking on the download button.',
      image: '/images/carousel/blissful.png'
    },
    {
      id: 'slide-6',
      title: 'What are we doing right now?',
      content: 'We’re creating a glossary to help you understand the document. You can click over the highlighted words and read their definitions on the panel that will emerge.',
      image: '/images/carousel/confident.png'
    }
  ];

  return <AppTutorialCarousel slides={slideData} />;
};

export default AppTutorial; 