import React from 'react';
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
  onLastSlideReached?: () => void;
}

const AppTutorialCarousel: React.FC<AppTutorialCarouselProps> = ({ slides, className = '', onLastSlideReached }) => {
  const handleSlideChange = (selectedIndex: number) => {
    // Check if we've reached the last slide (0-indexed, so slides.length - 1)
    if (selectedIndex === slides.length - 1 && onLastSlideReached) {
      // Add a small delay to ensure the slide transition completes
      setTimeout(() => {
        onLastSlideReached();
      }, 1500);
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
          onSlide={handleSlideChange}
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
      </div>
    </div>
  );
};

export default AppTutorialCarousel; 