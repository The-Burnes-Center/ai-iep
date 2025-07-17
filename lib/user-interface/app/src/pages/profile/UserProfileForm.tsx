import React, { useState, useEffect, useContext } from 'react';
import { Container, Form, Button, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import { UserProfile } from '../../common/types';
import { useNotifications } from '../../components/notif-manager';
import { useLanguage } from '../../common/language-context';
import { useNavigate } from 'react-router-dom';
import MobileBottomNavigation from '../../components/MobileBottomNavigation';
import DeleteProfileModal from './DeleteProfileModal';
import './ProfileForms.css';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'es', label: 'Spanish' },
  { value: 'vi', label: 'Vietnamese' }
];

export default function UserProfileForm() {
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext);
  const { addNotification } = useNotifications();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const navigate = useNavigate();

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
      setError(t('profile.error.serviceUnavailable'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      setSaving(true);
      await apiClient.profile.updateProfile(profile);
      addNotification('success', t('profile.success.update'));
    } catch (err) {
      addNotification('error', t('profile.error.update'));
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageSelectionClick = () => {
    // Navigate to language selection page with state to indicate coming from profile
    navigate('/', { state: { fromProfile: true } });
  };

  // Helper function to get language label
  const getLanguageLabel = (languageCode: string) => {
    const option = LANGUAGE_OPTIONS.find(opt => opt.value === languageCode);
    return option ? option.label : languageCode;
  };

  const handleDeleteProfile = () => {
    setShowDeleteModal(true);
  };

  if (loading) {
    return (
      <Container className="mt-4 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">{t('profile.loading')}</span>
        </Spinner>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  const handleBackClick = () => {
    navigate('/welcome-page');
  };

  return (
    <>
    <Container className="mt-4">
      <div className="mt-3 text-start">
        <Button variant="outline-secondary" onClick={handleBackClick}>
          {t('common.back')}
        </Button>
      </div>
      <Form onSubmit={handleSubmit} className="mt-4">
        <h3 className="mb-3">{t('profile.title')}</h3>
        
        <Row className="mb-3">
          <Col md={10}>
            <Form.Group controlId="formParentName">
              <Form.Label className="small">{t('profile.parentName')}</Form.Label>
              <Form.Control 
                type="text" 
                value={profile?.parentName || ''}
                onChange={e => {
                  setProfile(prev => prev ? {...prev, parentName: e.target.value} : null);
                }}
              />
            </Form.Group>
          </Col>
        </Row>

        {/* Language Preferences Section */}
        <Row className="mb-4">
          <Col md={10}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="small mb-0">{t('profile.languagePreferences')}</Form.Label>
              <Button 
                variant="outline-primary" 
                size="sm"
                onClick={handleLanguageSelectionClick}
              >
                {t('profile.button.changeLanguage')}
              </Button>
            </div>
            <div className="bg-light p-3 rounded">
              <div className="mb-2">
                <strong>{t('profile.primaryLanguage')}:</strong> {getLanguageLabel(profile?.primaryLanguage || 'en')}
              </div>
              {profile?.secondaryLanguage && (
                <div>
                  <strong>{t('profile.secondaryLanguage')}:</strong> {getLanguageLabel(profile.secondaryLanguage)}
                </div>
              )}
              {!profile?.secondaryLanguage && (
                <div className="text-muted">
                  {t('profile.noSecondaryLanguage')}
                </div>
              )}
            </div>
          </Col>
        </Row>

        <div className="mt-4 profile-actions">
          <Button 
            variant="primary" 
            type="submit" 
            disabled={saving}
          >
            {saving ? t('profile.button.updating') : t('profile.button.update')}
          </Button>
          <Button 
            variant="outline-danger" 
            onClick={() => navigate('/revoke-consent')}
            className="button-text"
          >
            {t('profile.button.revokeConsent')}
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteProfile}
            className="button-text"
          >
            {t('profile.button.deleteProfile')}
          </Button>
        </div>
      </Form>
    </Container>
    <DeleteProfileModal 
      show={showDeleteModal} 
      onHide={() => setShowDeleteModal(false)} 
    />
    <MobileBottomNavigation />
    </>
  );
}