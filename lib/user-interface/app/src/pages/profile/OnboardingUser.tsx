import React, { useMemo, useState } from 'react';
import { Button } from 'react-bootstrap';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useNavigate } from 'react-router-dom';
// Add this import at the top
import { useLanguage } from '../../common/language-context';

// Then inside your component function, add this line after the component declaration:



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

const getStartedText = useMemo(() => [
  t('parent.button.save'),
], [t, language]);

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
          threshold={5} 
          pagination={{
            clickable: true,
            el: '.swiper-custom-pagination',
          }}
          onSlideChange={(swiper) => setActiveSlide(swiper.activeIndex)}
          modules={[Pagination]}
          className="mySwiper"
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
        
        <div className="d-grid" >
              <Button variant="primary" className="continue-onboarding" disabled={activeSlide < 3} onClick={() => navigate('/consent-form')}>{getStartedText}</Button>
        </div>

      </div>
    </div>
  );
};

export default OnboardingUser;