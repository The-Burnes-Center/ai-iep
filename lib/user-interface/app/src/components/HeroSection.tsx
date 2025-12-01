import React from 'react';
import CustomLogin from './CustomLogin';
import './CustomLogin.css';
import './HeroSection.css';

const HeroSection: React.FC = () => { 
    return (
        <div className='hero-section-container'>
            <div className='hero-section-content'>
                <div className='hero-section-login-container'>
                    <CustomLogin />
                </div>
            </div>
        </div>
    )
}

export default HeroSection;