import React from 'react';
import LandingTopNavigation from '../components/LandingTopNavigation';
import './LandingPage.css';
import MultiFaceGreenBanner from '../components/MultiFaceGreenBanner';
import SummarizeTranslateAdvocateBanner from '../components/SummarizeTranslateAdvocateBanner';

const LandingPage: React.FC = () => { 
    return (
        <>
        <LandingTopNavigation />
        <div className="landing-page-container">
            <SummarizeTranslateAdvocateBanner />
            <MultiFaceGreenBanner />
        </div>
        </>

    )
}

export default LandingPage;