import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Alert, Spinner, Button } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import { Language } from '../../common/types';
import { useNotifications } from '../../components/notif-manager';
import { useLanguage, SupportedLanguage } from '../../common/language-context'; // Updated import
import './ProfileForms.css';

const LANGUAGE_OPTIONS = [
  { 
    value: 'en', 
    label: 'English',
    translatedPreference: 'I prefer English'
  },
  { 
    value: 'es', 
    label: 'Spanish',
    translatedPreference: 'Prefiero Español' // "I prefer Spanish" in Spanish
  },
  { 
    value: 'zh', 
    label: 'Chinese',
    translatedPreference: '我喜欢中文' // "I prefer Chinese" in Chinese
  },
  { 
    value: 'vi', 
    label: 'Vietnamese',
    translatedPreference: 'Tôi thích tiếng Việt' // "I prefer Vietnamese" in Vietnamese
  }
];

export default function PreferredLanguage() {
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { addNotification } = useNotifications();
  const { setLanguage } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Language | null>(null);
  const [saving, setSaving] = useState(false);

  // Check if user came from profile page to update language
  const isUpdatingFromProfile = location.state?.fromProfile === true;

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await apiClient.profile.getProfile();
      setProfile(data);

      // Skip automatic redirects if user is updating from profile page
      if (isUpdatingFromProfile) {
        setError(null);
        return;
      }

      // Check if this is a new phone signup
      const isNewPhoneSignup = localStorage.getItem('isNewPhoneSignup') === 'true';
      
      if (isNewPhoneSignup) {
        console.log('New phone signup detected, starting onboarding flow');
        // Clear the flag since we're handling it
        localStorage.removeItem('isNewPhoneSignup');
        // For new phone signups, always start with language selection (stay on current screen)
        setError(null);
        return;
      }

      // Check if the user has already completed all required fields
      const hasLanguage = data && data.secondaryLanguage;
      const hasConsent = data && data.consentGiven === true;
      const hasCompleteChildData = data && data.parentName

      // If everything is complete, go to welcome page
      if (hasLanguage && hasConsent && hasCompleteChildData) {
        navigate('/welcome-page');
        return;
      }

      // If user has language but missing consent or child data, go to consent form
      if (hasLanguage) {
        navigate('/consent-form');
        return;
      }

      // Otherwise, stay on language selection (current screen)
      setError(null);
    } catch (err) {
      setError('Service unavailable');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageSelect = async (languageValue: string) => {
    if (!profile) return;

    try {
      setSaving(true);
      
      // Set the language in the context
      setLanguage(languageValue as SupportedLanguage);
      
      // Create updated profile with the selected language
      const preferredLanguage = {
        secondaryLanguage: languageValue,
        primaryLanguage: 'en'
      };
      
      setProfile(preferredLanguage);
      
      // Only update if there are changes to save
      if (profile.secondaryLanguage !== languageValue) {
        await apiClient.profile.updateProfile(preferredLanguage);
        addNotification('success', 'Language preference updated successfully');
      }
      
      // Navigate back to appropriate page
      if (isUpdatingFromProfile) {
        navigate('/profile');
      } else {
        navigate('/consent-form');
      }
    } catch (err) {
      addNotification('error', 'Failed to update language preference');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container className="text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
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
    <Container 
      fluid 
      className="profile-form-container"
    >
      <Row style={{ width: '100%', justifyContent: 'center' }}>
        <Col xs={12} md={8} lg={6}>
          <div className="profile-form">
            {isUpdatingFromProfile && (
              <div className="text-center mb-4">
                <h3>Update Language Preferences</h3>
                <p className="text-muted">Select your preferred language for IEP translations</p>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={() => navigate('/profile')}
                  className="mb-3"
                >
                  ← Back to Profile
                </Button>
              </div>
            )}
            <Row className="g-3">
              {LANGUAGE_OPTIONS.map(option => (
                <Col xs={12} key={option.value}>
                  <Button 
                    variant={profile?.secondaryLanguage === option.value ? "primary" : "outline-primary"}
                    className="w-100 py-3 language-button"
                    onClick={() => handleLanguageSelect(option.value)}
                    disabled={saving}
                  >
                    <div className="d-flex justify-content-between align-items-center w-100">
                      <span>{option.translatedPreference}</span>
                     </div>
                  </Button>
                </Col>
              ))}
            </Row>
          </div>
        </Col>
      </Row>
    </Container>
  );
}