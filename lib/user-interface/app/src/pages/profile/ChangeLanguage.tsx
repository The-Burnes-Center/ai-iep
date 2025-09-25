import React, { useState, useEffect, useContext } from 'react';
import { Container, Form, Button, Row, Col, Alert, Spinner, Breadcrumb } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import MobileBottomNavigation from '../../components/MobileBottomNavigation';
import { ApiClient } from '../../common/api-client/api-client';
import { UserProfile } from '../../common/types';
import { useNotifications } from '../../components/notif-manager';
import { useLanguage, SupportedLanguage } from '../../common/language-context'; 
import './ChangeLanguage.css';
import './ProfileForms.css';

export default function ChangeLanguage() {
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext);
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { t, setLanguage } = useLanguage();

  // Language options - hardcoded so users can always read the language names
  const LANGUAGE_OPTIONS = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: 'Chinese' },
    { value: 'es', label: 'Spanish' },
    { value: 'vi', label: 'Vietnamese' }
  ];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
      loadProfile();
    }, []);
  
    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await apiClient.profile.getProfile();
        setProfile(data);
        setOriginalProfile(data);
        setError(null);
      } catch (err) {
        setError(t('profile.error.serviceUnavailable'));
      } finally {
        setLoading(false);
      }
    };

  const handleBackClick = () => {
    navigate('/account-center');
  };

const handlePreferredLanguageChange = async (languageCode: string) => {
  if (!profile || languageCode === profile.secondaryLanguage) return;
  
  const updatedProfile = {...profile, secondaryLanguage: languageCode};
  setProfile(updatedProfile);
  
  try {
    setSaving(true);
    await apiClient.profile.updateProfile(updatedProfile);
    
    // Update language context
    setLanguage(languageCode as SupportedLanguage);
    
    setOriginalProfile(updatedProfile);
    addNotification('success', t('profile.success.update'));
  } catch (err) {
    // Revert on error
    setProfile(originalProfile);
    addNotification('error', t('profile.error.update'));
  } finally {
    setSaving(false);
  }
};

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profile) return;
  
      try {
        setSaving(true);
        await apiClient.profile.updateProfile(profile);
        
        // Update language context if secondary language changed
        if (profile.secondaryLanguage && profile.secondaryLanguage !== originalProfile?.secondaryLanguage) {
          setLanguage(profile.secondaryLanguage as SupportedLanguage);
        }
        
        setOriginalProfile(profile); // Update original profile after successful save
        addNotification('success', t('profile.success.update'));
      } catch (err) {
        addNotification('error', t('profile.error.update'));
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <Container className="text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">{t('changeLanguage.loading')}</span>
        </Spinner>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
  <>
      <div>
      {/* Breadcrumbs */}
      <div className="mt-3 text-start px-4">
        <Breadcrumb>
          <Breadcrumb.Item onClick={handleBackClick}>{t('changeLanguage.breadcrumb.account')}</Breadcrumb.Item>
          <Breadcrumb.Item active>{t('changeLanguage.breadcrumb.changeLanguage')}</Breadcrumb.Item>
        </Breadcrumb>
      </div>
      
      <Container 
        fluid 
        className="update-profile-container"
      >
        <Row style={{ width: '100%', justifyContent: 'center' }}>
          <Col xs={12} md={8} lg={6}>
            <div className="profile-form">
            {/*Add translations*/}
            <h4 className="update-profile-header">{t('changeLanguage.title')}</h4>
            <p className='update-profile-description'>{t('changeLanguage.description')}</p>
              <Form>
                <Row className="mb-4">
                  <Col md={12}>
                    <Form.Group controlId="formParentName">
                      <Form.Label className="form-label">{t('changeLanguage.label.translation')}</Form.Label>
                    </Form.Group>
                  </Col>
                </Row>

                {/* Preferred Language Section */}
                <Row className="mb-4">
                  <Col md={10}>
                    <Form.Group controlId="formPreferredLanguage">
                      <Form.Select 
                        value={profile?.secondaryLanguage || 'en'}
                        onChange={e => handlePreferredLanguageChange(e.target.value)}
                        disabled={saving}
                        className='language-select-dropdown'
                      >
                        {LANGUAGE_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              </Form>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  <MobileBottomNavigation />
  </>
  );
}