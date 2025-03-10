import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Alert, Spinner, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import { UserProfile } from '../../common/types';
import { useNotifications } from '../../components/notif-manager';
import './ProfileForms.css';

const LANGUAGE_OPTIONS = [
  { 
    value: 'en', 
    label: 'English',
    translatedPreference: 'I prefer English'
  },
  { 
    value: 'zh', 
    label: 'Chinese',
    translatedPreference: '我喜欢中文' // "I prefer Chinese" in Chinese
  },
  { 
    value: 'es', 
    label: 'Spanish',
    translatedPreference: 'Prefiero Español' // "I prefer Spanish" in Spanish
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
  const { addNotification } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await apiClient.profile.getProfile();
      setProfile(data);
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
      
      // Create updated profile with the selected language
      const updatedProfile = {
        ...profile,
        secondaryLanguage: languageValue
      };
      
      setProfile(updatedProfile);
      
      // Only update if there are changes to save
      if (profile.secondaryLanguage !== languageValue) {
        await apiClient.profile.updateProfile(updatedProfile);
        addNotification('success', 'Language preference updated successfully');
      }
      
      // Navigate to consent form
      navigate('/consent-form');
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
            {/* <h2 className="text-center profile-title mb-4">Select your preferred language</h2> */}
            
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