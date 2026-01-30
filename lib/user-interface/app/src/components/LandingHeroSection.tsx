import './LandingHeroSection.css';
import { useLanguage } from '../common/language-context';

const LandingHeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="landing-hero-section">
      <div className="landing-hero-text-container">
        <h1 className="landing-hero-text">
          {t('landingHero.title.part1')} <br /> {t('landingHero.title.part2')} <span className="landing-hero-text-with">{t('landingHero.title.with')}</span> {t('landingHero.title.and')} <span className="landing-hero-text-for">{t('landingHero.title.for')}</span>  <br />  {t('landingHero.title.part3')}
        </h1>
        <div className="landing-hero-project-by">
          <span className="landing-hero-project-by-text">{t('landingHero.projectBy')}</span>
          <div className="landing-hero-logos">
            <img src="/images/the-govlab-logo.svg" alt="The GovLab logo" className="landing-hero-logo" style={{ height: '30px' }} />
            <img src="/images/burnes-center-logo.svg" alt="Burnes Center logo" className="landing-hero-logo" style={{ height: '50px' }} />
            <img src="/images/innovate_logo.png" alt="Innovate logo" className="landing-hero-logo" />
          </div>
        </div>
      </div>
      <div className="landing-hero-image-container">
        <img src="/images/hero-section-image.png" alt="Hero illustration" className="landing-hero-image" />
      </div>
    </section>
  );
};

export default LandingHeroSection;
