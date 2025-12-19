import { useState, useMemo } from 'react';
import { Carousel } from 'react-bootstrap';
import './ParentRightsBanner.css';
import { defaultSlideData, SlideData, ParentRightsCarouselProps } from './ParentRightsCarousel';
import { useLanguage } from '../common/language-context';

const ParentRightsBanner: React.FC<ParentRightsCarouselProps> = ({ slides, className = '', onLastSlideReached, headerPinkTitle, headerGreenTitle }) => {
    const { t, translationsLoaded } = useLanguage();
    const [activeIndex, setActiveIndex] = useState(0);

    // Build translated slide data with fallback to defaults
    const translatedSlideData: SlideData[] = useMemo(() => {
        if (!translationsLoaded) return defaultSlideData;
        
        return [
            // Privacy slides (first 2)
            { id: 'slide-1', type: 'privacy' as const, title: t('privacy.slide1.title'), content: t('privacy.slide1.content'), image: '/images/carousel/surprised.png' },
            { id: 'slide-2', type: 'privacy' as const, title: t('privacy.slide2.title'), content: t('privacy.slide2.content'), image: '/images/carousel/blissful.png' },
            // Rights slides (slides 3-8)
            { id: 'slide-3', type: 'rights' as const, title: t('rights.slide1.title'), content: t('rights.slide1.content'), image: '/images/carousel/joyful.png' },
            { id: 'slide-4', type: 'rights' as const, title: t('rights.slide2.title'), content: t('rights.slide2.content'), image: '/images/carousel/surprised.png' },
            { id: 'slide-5', type: 'rights' as const, title: t('rights.slide3.title'), content: t('rights.slide3.content'), image: '/images/carousel/blissful.png' },
            { id: 'slide-6', type: 'rights' as const, title: t('rights.slide4.title'), content: t('rights.slide4.content'), image: '/images/carousel/joyful.png' },
            { id: 'slide-7', type: 'rights' as const, title: t('rights.slide5.title'), content: t('rights.slide5.content'), image: '/images/carousel/surprised.png' },
            { id: 'slide-8', type: 'rights' as const, title: t('rights.slide6.title'), content: t('rights.slide6.content'), image: '/images/carousel/blissful.png' },
        ];
    }, [t, translationsLoaded]);

    // Use provided slides, or translated data, or default
    const displaySlides = slides ?? translatedSlideData;
    
    // Translate header titles with fallback
    const displayHeaderGreenTitle = headerGreenTitle ?? t('rights.header.title.green') ?? "Your data is safe with us";
    const displayHeaderPinkTitle = headerPinkTitle ?? t('rights.header.title.pink') ?? "Your rights as a parent";

    // Default behavior: cycle back to first slide
    const defaultOnLastSlideReached = () => {
        setActiveIndex(0);
    };

    const handleLastSlideReached = onLastSlideReached ?? defaultOnLastSlideReached;

    const handleSelect = (selectedIndex: number) => {
        if (selectedIndex === 0 && activeIndex && displaySlides.length - 1) {
            handleLastSlideReached();
        }
        setActiveIndex(selectedIndex);
    };

    const handlePrevious = () => {
        if (activeIndex > 0) {
            setActiveIndex((prev) => prev - 1);
        }
    };

    const handleNext = () => {
        if (activeIndex < displaySlides.length - 1) {
            setActiveIndex((prev) => prev + 1);
        } else {
            handleLastSlideReached();
        }
    };

    return(
        <div className="parent-rights-banner-container">
            <div className='parent-rights-banner-content'>
                <div className='parent-rights-banner-content-left'>
                    {
                        activeIndex <= 1 ? 
                        <div className="banner-card banner-card--green">
                        <h1>{displayHeaderGreenTitle}</h1>
                        <img src={displaySlides[activeIndex].image} className="banner-slide-image" alt={displaySlides[activeIndex].title} /> 
                    </div>
                        : (
                        <div className="banner-card banner-card--pink">
                        <h1>{displayHeaderPinkTitle}</h1>
                        <img src={displaySlides[activeIndex].image} className="banner-slide-image" alt={displaySlides[activeIndex].title} /> 
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
                        {displaySlides.map((slide, index) => (
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