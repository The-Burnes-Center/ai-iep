import React from 'react';
import LandingTopNavigation from '../components/LandingTopNavigation';
import './LandingPage.css';
import MultiFaceGreenBanner from '../components/MultiFaceGreenBanner';
import SummarizeTranslateAdvocateBanner from '../components/SummarizeTranslateAdvocateBanner';
import HeroSection from '../components/HeroSection';
import AIEPFooter from '../components/AIEPFooter';
import ParentRightsBanner from '../components/ParentRightsBanner';
import ResourcesBanner from '../components/ResourcesBanner';

const LandingPage: React.FC = () => { 
    return (
        <>
        <LandingTopNavigation />
        <div className="landing-page-container">
            <HeroSection />
            <SummarizeTranslateAdvocateBanner />
            <MultiFaceGreenBanner />
            <ParentRightsBanner />
            <ResourcesBanner />
            <AIEPFooter />
        </div>
        </>

    )
}

export default LandingPage;