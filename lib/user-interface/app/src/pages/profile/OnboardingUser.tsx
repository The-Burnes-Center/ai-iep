import React, { useMemo, useState } from 'react';
import { Button } from 'react-bootstrap';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useNavigate } from 'react-router-dom';
// Add this import at the top
import { useLanguage } from '../../common/language-context';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

// import required modules
import { Pagination } from 'swiper/modules';

// Import component-specific styles
import './OnboardingUser.css';

const OnboardingUser: React.FC = () => {
  // Track the active slide to show dynamic content
  const [activeSlide, setActiveSlide] = useState(0);
  const { t, language } = useLanguage();
  // Define total slides for easier reference
  const totalSlides = 4;
  const isLastSlide = activeSlide === totalSlides - 1;
  const isFirstSlide = activeSlide === 0;

  const navigate = useNavigate();
  // Array of four strings for the carousel headings

  // Replace the carouselHeadings array with:
  const carouselHeadings = useMemo(() => [
    t('onboarding.carousel.heading.accessible'),
    t('onboarding.carousel.heading.summarize'), 
    t('onboarding.carousel.heading.translate'),
    t('onboarding.carousel.heading.advocate')
  ], [t, language]);


  const carouselParagraphs = useMemo(() => [
    t('onboarding.carousel.paragraph.accessible'),
    t('onboarding.carousel.paragraph.summarize'),
    t('onboarding.carousel.paragraph.translate'),
    t('onboarding.carousel.paragraph.advocate')
  ], [t, language]);

  const getStartedText = useMemo(() => 
    t('parent.button.save'),
  [t, language]);

  // Array of image data
  const slideImages = [
    {
      src: '/images/carousel/Complex_IEP.png',
      alt: 'Complex IEP Document made accessible'
    },
    {
      src: '/images/carousel/Summarize.png', 
      alt: 'Summarize IEP content'
    },
    {
      src: '/images/carousel/Translate.png',
      alt: 'Translate IEP documents'
    },
    {
      src: '/images/carousel/Advocate.png',
      alt: 'Advocate for your child'
    }
  ];

  const handleBackClick = () => {
    navigate('/');
  };
  
  // Create a ref to access Swiper instance
  const swiperRef = React.useRef<any>(null);
  
  const handlePrevClick = () => {
    if (swiperRef.current && !isFirstSlide) {
      swiperRef.current.slidePrev();
    }
  };
  
  const handleNextClick = () => {
    if (swiperRef.current && !isLastSlide) {
      swiperRef.current.slideNext();
    }
  };
  
  const handleGetStarted = () => {
    navigate('/consent-form');
  };
  
  return (
    <div>
      <div className="mt-3 text-start px-3 py-2">
        <Button variant="outline-secondary" onClick={handleBackClick}>
          {t('common.back')}
        </Button>
      </div>
      
      <div className="carousel-container">
        {/* Swiper component */}
        <Swiper
          slidesPerView="auto"
          spaceBetween={15}
          centeredSlides={true}
          threshold={20}
          pagination={{
            clickable: true,
            el: '.swiper-custom-pagination',
          }}
          onSlideChange={(swiper) => setActiveSlide(swiper.activeIndex)}
          modules={[Pagination]}
          className="mySwiper"
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
        >
          {slideImages.map((image, index) => (
            <SwiperSlide key={index}>
              <img 
                src={image.src} 
                alt={image.alt}
                className="carousel-image"
              />
            </SwiperSlide>
          ))}
        </Swiper>
        
        <div className='heading-paragraph-container'>
          <h5 className="carousel-heading">
            {carouselHeadings[activeSlide]}
          </h5>
          <p className="carousel-paragraph">
            {carouselParagraphs[activeSlide]}
          </p>
        </div>

        {/* Custom pagination element */}
        <div className="swiper-custom-pagination"></div>
        
        {/* Mobile "Get Started" button */}
        <div className="d-grid mobile-cta">
          <Button 
            variant="primary" 
            className="continue-onboarding" 
            disabled={activeSlide < 3} 
            onClick={handleGetStarted}
          >
            {getStartedText}
          </Button>
        </div>
        
        {/* Desktop navigation buttons */}
        <div className="desktop-navigation">
          <Button 
            variant="outline-primary" 
            className="nav-btn prev-btn" 
            disabled={isFirstSlide}
            onClick={handlePrevClick}
          >
            Previous
          </Button>
          
          {isLastSlide ? (
            <Button 
              variant="primary" 
              className="nav-btn next-btn" 
              onClick={handleGetStarted}
            >
              {getStartedText}
            </Button>
          ) : (
            <Button 
              variant="primary" 
              className="nav-btn next-btn" 
              onClick={handleNextClick}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingUser;