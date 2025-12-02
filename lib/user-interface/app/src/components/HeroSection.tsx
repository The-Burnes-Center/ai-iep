import React from 'react';
import { useLanguage } from '../common/language-context';
import CustomLogin from './CustomLogin';
import './CustomLogin.css';
import './HeroSection.css';

const HeroSection: React.FC = () => { 
    const { t } = useLanguage();
    
    return (
        <div className='hero-section-container'>
            <div className='hero-section-content'>
                <div className='hero-section-image-container'>
                    <img src="/images/hero-section-image.png" alt="Hero Section Image" className='hero-section-image' />
                    <div className='hero-illustration-text-container'>
                        <h2 className='hero-illustration-title'>{t('hero.title')}</h2>
                        <p className='hero-illustration-text'>{t('hero.description')}</p>
                    </div>
                </div>
                <div className='hero-section-login-container'>
                    <div className='hero-section-login-container-content'>
                        <CustomLogin />
                    </div> 
                </div>
            </div>
        </div>
    )
}

export default HeroSection;