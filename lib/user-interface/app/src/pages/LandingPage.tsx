import React from 'react';
import LandingTopNavigation from '../components/LandingTopNavigation';
import './LandingPage.css';
import MultiFaceGreenBanner from '../components/MultiFaceGreenBanner';

const LandingPage: React.FC = () => { 
    return (
        <>
        <LandingTopNavigation />
        <div className="landing-page-container">
            <MultiFaceGreenBanner />
        </div>
        </>

    )
}

export default LandingPage;