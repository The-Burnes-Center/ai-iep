import React, { useState } from 'react';
import { Carousel } from 'react-bootstrap';
import './AppTutorialCarousel.css';

interface SlideData {
  id: string;
  title: string;
  content: string;
  image: string;
}

interface AppTutorialCarouselProps {
  slides: SlideData[];
  className?: string;
}

const AppTutorialCarousel: React.FC<AppTutorialCarouselProps> = ({ slides, className = '' }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleSelect = (selectedIndex: number) => {
    setActiveIndex(selectedIndex);
  };

  const handlePrevious = () => {
    console.log("Active Index",activeIndex);
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  return (
    <div className="app-tutorial-container">
      <div className="app-tutorial-carousel-wrapper">
        <Carousel 
          controls={false} 
          indicators={true}
          interval={null}
          pause="hover"
          activeIndex={activeIndex}
          onSelect={handleSelect}
          className={`app-tutorial-carousel ${className}`}
        >
          {slides.map((slide, index) => (
            <Carousel.Item key={slide.id}>
              <div className={`carousel-slide slide-${index + 1}`}>
                <img src={slide.image} className="slide-image" alt="" />
                <div className="slide-tutorial-content">
                  <p>{slide.content}</p>
                </div>
              </div>
            </Carousel.Item>
          ))}
        </Carousel>
        
        <div className="carousel-desktop-navigation">
          <button 
            className="carousel-nav-btn prev-btn" 
            onClick={handlePrevious}
            disabled={activeIndex === 0}
          >
            PREVIOUS
          </button>
          <button 
            className="carousel-nav-btn next-btn" 
            onClick={handleNext}
            disabled={activeIndex === slides.length - 1}
          >
            NEXT
          </button>
         </div>
      </div>
    </div>
  );
};

export default AppTutorialCarousel;