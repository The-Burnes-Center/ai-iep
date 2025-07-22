import React from 'react';
// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

// Import your custom CSS
import styles from './ParentRights.module.css';

// import required modules
import { Pagination } from 'swiper/modules';

const ParentRights: React.FC = () => {
  return (
    <div className={styles['parent-rights-carousel']}>
      <Swiper pagination={true} modules={[Pagination]} className={styles.swiper}>
        <SwiperSlide>
          <div className={styles['slide-img']}>
            <img src="/images/carousel/surprised.png" alt="Surprised emoji" />
          </div>
          <div className={styles['slide-content']}>
            <h3 className={styles['slide-title']}>1/6</h3>
            <h3 className={styles['slide-title']}>You can request a translator</h3>
            <p className={styles['slide-paragraph']}>You can request a translator for IEP meetings to ensure clear communication.</p>
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div className={styles['slide-img']}>
            <img src="/images/carousel/blissful.png" alt="Blissful emoji" />
          </div>
          <div className={styles['slide-content']}>
            <h3 className={styles['slide-title']}>2/6</h3>
            <h3 className={styles['slide-title']}>You can take your time</h3>
            <p className={styles['slide-paragraph']}>You have the right to take your time before signing an IEP - you don't need to sign until you're ready.</p>
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div className={styles['slide-img']}>
            <img src="/images/carousel/excited.png" alt="Excited emoji" />
          </div>
          <div className={styles['slide-content']}>
            <h3 className={styles['slide-title']}>3/6</h3>
            <h3 className={styles['slide-title']}>You can consent or not</h3>            
            <p className={styles['slide-paragraph']}>You can consent to all, some, or none of the proposed services - your child won't receive new services without your approval.</p>
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div className={styles['slide-img']}>
            <img src="/images/carousel/blissful.png" alt="Blissful emoji" />
          </div>
          <div className={styles['slide-content']}>
            <h3 className={styles['slide-title']}>4/6</h3>
            <h3 className={styles['slide-title']}>You can request a meeting</h3>            
            <p className={styles['slide-paragraph']}>You have the right to request an IEP meeting at any time, not just at  the annual review, and the school must schedule it within 30 days.</p>
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div className={styles['slide-img']}>
            <img src="/images/carousel/surprised.png" alt="Surprised emoji" />
          </div>
          <div className={styles['slide-content']}>
            <h3 className={styles['slide-title']}>5/6</h3>
            <h3 className={styles['slide-title']}>You can reschedule</h3>            
            <p className={styles['slide-paragraph']}>If an administrator isn't present at the meeting, you have the right to reschedule for a time when they can attend.</p>
          </div>
        </SwiperSlide>
        <SwiperSlide>
          <div className={styles['slide-img']}>
            <img src="/images/carousel/confident.png" alt="Confident emoji" />
          </div>
          <div className={styles['slide-content']}>
            <h3 className={styles['slide-title']}>6/6</h3>
            <h3 className={styles['slide-title']}>You must be given a booklet of your rights</h3>            
            <p className={styles['slide-paragraph']}>By law, your case manager must provide you with a booklet of your parental rights before the IEP meeting.</p>
          </div>
        </SwiperSlide>
      </Swiper>
    </div>
  );
};

export default ParentRights;