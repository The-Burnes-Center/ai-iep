import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useNavigate } from 'react-router-dom';

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

  const navigate = useNavigate();
  // Array of four strings for the carousel headings
  const carouselHeadings = [
    <>Your IEP Document,<br />made accessible</>,
    "Summarize", 
    "Translate",
    "Advocate"
  ];

  const carouselParagraphs = [
    <>The AIEP tool can help you understand<br /> your child or student’s IEP documents.</>,
    <>The tool will break down the key aspects<br /> of your IEP document into easy-to-understand language.</>,
    <>AIEP can also translate the summaries of IEP documents into your the language of your choice.</>,
    <>Advocate for your child’s education by exploring the IEP and understanding your rights.</>,
  ];

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
  
  return (
    <div className="carousel-container">
      {/* Swiper component */}
      <Swiper
        slidesPerView="auto"
        spaceBetween={15}
        centeredSlides={true}
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
            <Button variant="primary" className="continue-onboarding" disabled={activeSlide < 3} onClick={() => navigate('/consent-form')}>CONTINUE</Button>
      </div>

    </div>
  );
};

export default OnboardingUser;