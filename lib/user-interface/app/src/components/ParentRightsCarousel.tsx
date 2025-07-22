import React from 'react';
import { Carousel } from 'react-bootstrap';
import './ParentRightsCarousel.css';

interface SlideData {
  id: string;
  title: string;
  content: string;
}

interface ParentRightsCarouselProps {
  slides: SlideData[];
  className?: string;
}

const ParentRightsCarousel: React.FC<ParentRightsCarouselProps> = ({ slides, className = '' }) => {
  return (
    <div className="parent-rights-container">
      <div className="parent-rights-carousel-wrapper">
        <Carousel 
          controls={false} 
          indicators={true}
          interval={null}
          pause="hover"
          className={`parent-rights-carousel ${className}`}
        >
          {slides.map((slide, index) => (
            <Carousel.Item key={slide.id}>
              <div className={`carousel-slide slide-${index + 1}`}>
                <div className="slide-content">
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