import React, { useState } from 'react';
// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

// Import required modules
import { Pagination } from 'swiper/modules';

// Import local styles
import './OnboardingUser.css';

const OnboardingUser: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState(0);

  // Text content for each slide
  const slideTexts = [
    "Your IEP Document, \nmade accessible",
    "Summarize", 
    "Translate",
    "Advocate"
  ];

    // Paragraph content for each slide
    const slideParagraphs = [
      "The AIEP tool can help you understand your child or student's IEP documents.",
      "The tool will break down the key aspects of your IEP document into easy-to-understand language.",
      "AIEP can also translate the summaries of IEP documents into your the language of your choice.",
      "Advocate for your child's education by exploring the IEP and understanding your rights."
    ];

  const handleSlideChange = (swiper: any) => {
    setActiveSlide(swiper.activeIndex);
  };

  return (
    <div className="onboarding-container">
      <Swiper
        slidesPerView="auto"
        spaceBetween={15}
        centeredSlides={true}
        pagination={{
          clickable: true,
        }}
        modules={[Pagination]}
        className="mySwiper"
        onSlideChange={handleSlideChange}
      >
        <SwiperSlide>
          <img src="/images/carousel/Complex_IEP.png" alt="Complex IEP Processing" />
        </SwiperSlide>
        <SwiperSlide>
          <img src="/images/carousel/Summarize.png" alt="Summarize IEP Documents" />
        </SwiperSlide>
        <SwiperSlide>
          <img src="/images/carousel/Translate.png" alt="Translate IEP Content" />
        </SwiperSlide>
        <SwiperSlide>
          <img src="/images/carousel/Advocate.png" alt="Advocate for Your Child" />
        </SwiperSlide>
      </Swiper>
      
      {/* Dynamic text container */}
      <div className="slide-text-container">
        <h3 className="slide-description">
          {slideTexts[activeSlide]}
        </h3>
        <p className="slide-paragraph">
          {slideParagraphs[activeSlide]}
        </p>
      </div>
    </div>
  );
};

export default OnboardingUser;