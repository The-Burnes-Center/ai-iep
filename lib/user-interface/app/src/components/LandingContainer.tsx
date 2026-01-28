import './LandingContainer.css';
import LandingSection from './LandingSection';
import { useLanguage } from '../common/language-context';

const LandingContainer = () => {
  const { t } = useLanguage();

  return (
    <div className="landing-container">
      <LandingSection title={t('landingContainer.outputs.title')}>
        <p className="landing-content-title">{t('landingContainer.outputs.subtitle')}</p>
        <ul>
          <li className="landing-content-list-item"><a href="#">{t('landingContainer.outputs.item1.link')}</a> {t('landingContainer.outputs.item1.text')}</li>
          <li className="landing-content-list-item">{t('landingContainer.outputs.item2.text1')} <a href="#">{t('landingContainer.outputs.item2.link')}</a> {t('landingContainer.outputs.item2.text2')}</li>
          <li className="landing-content-list-item">{t('landingContainer.outputs.item3.text1')} <a href="#">{t('landingContainer.outputs.item3.link')}</a> {t('landingContainer.outputs.item3.text2')}</li>
          <li className="landing-content-list-item"><a href="#">{t('landingContainer.outputs.item4.link1')}</a> {t('landingContainer.outputs.item4.and')} <a href="#">{t('landingContainer.outputs.item4.link2')}</a> {t('landingContainer.outputs.item4.text')}</li>
        </ul>
        <p className="landing-content-text">{t('landingContainer.outputs.conclusion')}</p>
      </LandingSection>
      <LandingSection title={t('landingContainer.challenge.title')}>
        <p className="landing-content-text">{t('landingContainer.challenge.description')}</p>
        <p className="landing-content-title">{t('landingContainer.challenge.subtitle')}</p>
        <ul>
          <li className="landing-content-list-item">{t('landingContainer.challenge.item1')}</li>
          <li className="landing-content-list-item">{t('landingContainer.challenge.item2')}</li>
          <li className="landing-content-list-item">{t('landingContainer.challenge.item3')}</li>
          <li className="landing-content-list-item">{t('landingContainer.challenge.item4')}</li>
        </ul>
        <p className="landing-content-text">{t('landingContainer.challenge.conclusion')}</p>
      </LandingSection>
      <LandingSection title={t('landingContainer.codesign.title')}>
        <p className="landing-content-text">{t('landingContainer.codesign.description')}</p>
        <p className="landing-content-title">{t('landingContainer.codesign.subtitle')}</p>
        <ul>
          <li className="landing-content-list-item">{t('landingContainer.codesign.item1')}</li>
          <li className="landing-content-list-item">{t('landingContainer.codesign.item2')}</li>
          <li className="landing-content-list-item">{t('landingContainer.codesign.item3')}</li>
          <li className="landing-content-list-item">{t('landingContainer.codesign.item4')}</li>
        </ul>
        <p className="landing-content-text">{t('landingContainer.codesign.conclusion1')}</p>
        <p className="landing-content-title">{t('landingContainer.codesign.reimaginingTitle')}</p>
        <p className="landing-content-text">{t('landingContainer.codesign.reimaginingDescription')}</p>
        <ul>
          <li className="landing-content-list-item">{t('landingContainer.codesign.role1')}</li>
          <li className="landing-content-list-item">{t('landingContainer.codesign.role2')}</li>
          <li className="landing-content-list-item">{t('landingContainer.codesign.role3')}</li>
        </ul>
        <p className="landing-content-text">{t('landingContainer.codesign.conclusion2')}</p>
      </LandingSection>
      <LandingSection title={t('landingContainer.research.title')}>
        <p className="landing-content-title">{t('landingContainer.research.subtitle')}</p>
        <ul>
          <li className="landing-content-list-item">{t('landingContainer.research.item1')}</li>
          <li className="landing-content-list-item">{t('landingContainer.research.item2')}</li>
          <li className="landing-content-list-item">{t('landingContainer.research.item3')}</li>
          <li className="landing-content-list-item">{t('landingContainer.research.item4')}</li>
        </ul>
        <p className="landing-content-text">{t('landingContainer.research.conclusion')}</p>
      </LandingSection>
    </div>
  );
};

export default LandingContainer;
