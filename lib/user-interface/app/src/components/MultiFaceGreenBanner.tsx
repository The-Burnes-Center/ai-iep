import React from 'react';
import './MultiFaceGreenBanner.css';

const MultiFaceGreenBanner: React.FC = () => {
    return (
        <div className='multi-face-green-banner-container'>
            <div className='multi-face-green-banner-content' >
                <div className='multi-face-green-banner-text-container'>
                    <h2 className='multi-face-green-banner-title'>All children deserve education, regardless of their needs</h2>
                    <p className='multi-face-green-banner-text'>Just like plants, each child learns in their own way. Some need light, some need shade, some bloom quickly, others take time. The AIEP tool helps families care for their child’s educational needs.</p>
                </div>
                <div className='multi-face-green-banner-faces-container'>
                    <img src="/images/9_x_9_faces.png" alt="9x9 faces" className="multi-face-green-banner-faces" />
                </div>
            </div>
        </div>
    )
}

export default MultiFaceGreenBanner;