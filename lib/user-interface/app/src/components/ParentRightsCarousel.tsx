import React, { useState } from 'react';
import { Carousel } from 'react-bootstrap';
import './ParentRightsCarousel.css';

const defaultSlideData = [
      {
        id: 'slide-1',
        title: 'Your data is safe',
        content: 'We’re removing your personal information from the summaries. We will not store any of your or your child’s personal details.',
        image: '/images/carousel/surprised.png'
      },
      {
        id: 'slide-2',
        title: 'Your IEP won’t be changed',
        content: 'We’re creating a separate document with your summary. You can download it by clicking on the button.',
        image: '/images/carousel/blissful.png'
      },
      {
        id: 'slide-3',
        title: 'You can request a translator',
        content: 'You can request a translator for IEP meetings to ensure clear communication.',
        image: '/images/carousel/joyful.png'
      },
      {
        id: 'slide-4',
        title: 'You can take your time',
        content: "You have the right to take your time before signing an IEP - you don't need to sign until you're ready.",
        image: '/images/carousel/surprised.png'
      },
      {
        id: 'slide-5',
        title: 'You can consent or not',
        content: "You can consent to all, some, or none of the proposed services - your child won't receive new services without your approval.",
        image: '/images/carousel/blissful.png'
      },
    ];

interface SlideData {
  id: string;
  title: string;
  content: string;
  image: string;
}

interface ParentRightsCarouselProps {
  slides?: SlideData[];
  className?: string;
  onLastSlideReached?: () => void;
  headerPinkTitle?: string;
  headerGreenTitle?: string;
}

const ParentRightsCarousel: React.FC<ParentRightsCarouselProps> = ({ slides = defaultSlideData, className = '', onLastSlideReached, headerPinkTitle = "Your rights as a parent", headerGreenTitle = "Your data is safe with us" }) => {
 
  const [activeIndex, setActiveIndex] = useState(0);

  const handleSelect = (selectedIndex: number) => {
    if(selectedIndex === 0 && activeIndex && slides.length -1){
      onLastSlideReached();
    }

    setActiveIndex(selectedIndex);
  };

  const handlePrevious = () => {
    if(activeIndex > 0){
      setActiveIndex((prev) => prev - 1)
    }
  }

  const handleNext = () => {
    if(activeIndex < slides.length){
      setActiveIndex((prev) => prev + 1)
    }

    if(activeIndex == slides.length - 1){
      console.log("Calling callback onLastSlideReached")
      onLastSlideReached();
    }
  }

  console.log("ActiveIndex - slides length", activeIndex,slides.length)

  return (
    <div className="parent-rights-container">
      

      {
        activeIndex <= 1 ? 
        <div className="parent-rights-card parent-rights-card--green">
        <h1>{headerGreenTitle}</h1>
        <img src={slides[activeIndex].image} className="slide-rights-image" alt={slides[activeIndex].title} /> 
      </div>
        : (
          <div className="parent-rights-card parent-rights-card--pink">
          <h1>{headerPinkTitle}</h1>
          <img src={slides[activeIndex].image} className="slide-rights-image" alt={slides[activeIndex].title} /> 
        </div>
        )
      }

      <div className='parent-rights-carousel-buttons'>
          <button 
            onClick={handlePrevious}
            disabled={activeIndex === 0}
            className='carousel-nav-button carousel-prev-button'
          >
            <img src="/images/arrow.svg" alt="Previous" className="arrow-icon-prev" />
          </button>
          <button 
            onClick={handleNext}
            className='carousel-nav-button carousel-next-button'
          >
            <img src="/images/arrow.svg" alt="Next" className="arrow-icon-next" />
          </button>
      </div>

      {/* Carousel*/}
      <div className="parent-rights-carousel-wrapper">
        <Carousel 
          activeIndex={activeIndex}
          onSelect={handleSelect}       
          controls={false} 
          indicators={true}
          interval={null}
          pause="hover"
          className={`parent-rights-carousel ${className}`}
        >
          {slides.map((slide, index) => (
            <Carousel.Item key={slide.id}>
              <div className={`carousel-slide slide-${index + 1}`}>
                <div className="slide-rights-content">
                  {index > 1 && <h2>{index - 1}/6</h2>}
                  <h2>{slide.title}</h2>
                  <p>{slide.content}</p>
                </div>
              </div>
            </Carousel.Item>
          ))}
        </Carousel>
      </div>
    </div>
  );
};

export default ParentRightsCarousel; 