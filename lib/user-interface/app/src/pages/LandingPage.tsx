import React from 'react';
import LandingTopNavigation from '../components/LandingTopNavigation';
import './LandingPage.css';
import MultiFaceGreenBanner from '../components/MultiFaceGreenBanner';
import SummarizeTranslateAdvocateBanner from '../components/SummarizeTranslateAdvocateBanner';
import HeroSection from '../components/HeroSection';
import AIEPFooter from '../components/AIEPFooter';

const LandingPage: React.FC = () => { 
    return (
        <>
        <LandingTopNavigation />
        <div className="landing-page-container">
            <HeroSection />
            <SummarizeTranslateAdvocateBanner />
            <MultiFaceGreenBanner />
            <AIEPFooter />
        </div>
        </>

    )
}

export default LandingPage;