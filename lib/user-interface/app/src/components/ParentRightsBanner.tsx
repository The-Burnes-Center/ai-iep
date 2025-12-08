import { useState } from 'react';
import { Carousel } from 'react-bootstrap';
import './ParentRightsBanner.css';
import { defaultSlideData, SlideData, ParentRightsCarouselProps } from './ParentRightsCarousel';

const ParentRightsBanner: React.FC<ParentRightsCarouselProps> = ({ slides = defaultSlideData, className = '', onLastSlideReached, headerPinkTitle = "Your rights as a parent", headerGreenTitle = "Your data is safe with us" }) => {
    const [activeIndex, setActiveIndex] = useState(0);

    const handleSelect = (selectedIndex: number) => {
        if (selectedIndex === 0 && activeIndex && slides.length - 1) {
            onLastSlideReached?.();
        }
        setActiveIndex(selectedIndex);
    };

    const handlePrevious = () => {
        if (activeIndex > 0) {
            setActiveIndex((prev) => prev - 1);
        }
    };

    const handleNext = () => {
        if (activeIndex < slides.length) {
            setActiveIndex((prev) => prev + 1);
        }
        if (activeIndex === slides.length - 1) {
            onLastSlideReached?.();
        }
    };

    return(
        <div className="parent-rights-banner-container">
            <div className='parent-rights-banner-content'>
                <div className='parent-rights-banner-content-left'>
                    {
                        activeIndex <= 1 ? 
                        <div className="banner-card banner-card--green">
                        <h1>{headerGreenTitle}</h1>
                        <img src={slides[activeIndex].image} className="banner-slide-image" alt={slides[activeIndex].title} /> 
                    </div>
                        : (
                        <div className="banner-card banner-card--pink">
                        <h1>{headerPinkTitle}</h1>
                        <img src={slides[activeIndex].image} className="banner-slide-image" alt={slides[activeIndex].title} /> 
                        </div>
                        )
                    }
                </div>
                <div className='parent-rights-banner-content-right'>

                    {/* Carousel*/}
                    <div className="banner-carousel-wrapper">
                        <Carousel 
                        activeIndex={activeIndex}
                        onSelect={handleSelect}       
                        controls={false} 
                        indicators={true}
                        interval={null}
                        pause="hover"
                        className={`banner-carousel ${className}`}
                        >
                        {slides.map((slide, index) => (
                            <Carousel.Item key={slide.id}>
                            <div className={`banner-carousel-slide slide-${index + 1}`}>
                                <div className="banner-slide-content">
                                {index > 1 && <h2>{index - 1}/6</h2>}
                                <h2>{slide.title}</h2>
                                <p>{slide.content}</p>
                                </div>
                            </div>
                            </Carousel.Item>
                        ))}
                        </Carousel>
                    </div>

                    <div className='banner-carousel-buttons'>
                        <button 
                            onClick={handlePrevious}
                            disabled={activeIndex === 0}
                            className='banner-nav-button banner-prev-button'
                        >
                            <img src="/images/arrow.svg" alt="Previous" className="banner-arrow-prev" />
                        </button>
                        <button 
                            onClick={handleNext}
                            className='banner-nav-button banner-next-button'
                        >
                            <img src="/images/arrow.svg" alt="Next" className="banner-arrow-next" />
                        </button>
                    </div>

                </div>
            </div>
        </div> 
    );
}

export default ParentRightsBanner;