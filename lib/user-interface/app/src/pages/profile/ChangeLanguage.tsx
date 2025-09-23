import React, { useState, useEffect, useContext } from 'react';
import { Container, Form, Button, Row, Col, Alert, Spinner, Breadcrumb } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import MobileBottomNavigation from '../../components/MobileBottomNavigation';
import { ApiClient } from '../../common/api-client/api-client';
import { IEPDocumentClient } from '../../common/api-client/iep-document-client';
import { UserProfile } from '../../common/types';
import { useNotifications } from '../../components/notif-manager';
import { useLanguage, SupportedLanguage } from '../../common/language-context'; 
import './UpdateProfileName.css';
import './ProfileForms.css';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'es', label: 'Spanish' },
  { value: 'vi', label: 'Vietnamese' }
];

export default function ChangeLanguage() {
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext);
  const iepDocumentClient = new IEPDocumentClient(appContext);
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { t, setLanguage } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [parentName, setParentName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [hasExistingDocument, setHasExistingDocument] = useState<boolean>(false);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadProfileAndCheckDocument();
  }, []);

  const loadProfileAndCheckDocument = async () => {
    try {
      setLoading(true);
      
      // Load user profile
      const data = await apiClient.profile.getProfile();
      setProfile(data);
      
      // Check if parentName exists in the profile
      if (data.parentName) {
        setParentName(data.parentName);
      }
      
      // Check for existing documents
      await checkForExistingDocument();
      
      setError(null);
    } catch (err) {
      console.error('Error loading profile or checking document:', err);
      setError('Service unavailable');
    } finally {
      setLoading(false);
    }
  };

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

  const checkForExistingDocument = async () => {
    try {
      const document = await iepDocumentClient.getMostRecentDocumentWithSummary();
      
      // Check if document exists and has been processed or is processing
      if (document && (document.status === "PROCESSED" || document.status === "PROCESSING")) {
        setHasExistingDocument(true);
      } else {
        setHasExistingDocument(false);
      }
    } catch (err) {
      console.error('Error checking for existing document:', err);
      // If there's an error checking for documents, assume no document exists
      setHasExistingDocument(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!parentName.trim()) {
      return; // Button should be disabled in this case
    }

    try {
      setSaving(true);
      
      // Prepare updated profile data
      const updatedProfileData = {
        parentName: parentName.trim()
      };
      
      // Update the profile with parent name
      await apiClient.profile.updateProfile(updatedProfileData);
      addNotification('success', 'Parent information saved successfully');
      
      // Check if user has any children - if not, create a default child
      if (!profile?.children || profile.children.length === 0) {
        try {
          // Create a default child with generic information
          // The user can update this later if needed
          await apiClient.profile.addChild('My Child', profile?.city || 'Not specified');
          console.log('Created default child for IEP document functionality');
        } catch (childError) {
          console.error('Error creating default child:', childError);
          // Don't fail the flow if child creation fails - user can add manually later
        }
      }
      
      // Check for existing documents after potentially creating child
      await checkForExistingDocument();
      
      // Mark onboarding as completed since user has finished all required steps
      try {
        await apiClient.profile.updateProfile({ showOnboarding: false });
        console.log('Onboarding completed - showOnboarding set to false');
      } catch (onboardingError) {
        console.error('Error updating onboarding status:', onboardingError);
        // Don't fail the flow if this update fails
      }
      
      // Navigate based on whether user has existing documents
      if (hasExistingDocument) {
        navigate('/account-center');
      } else {
        navigate('/account-center');
      }
    } catch (err) {
      console.error('Error saving parent name:', err);
      addNotification('error', 'Failed to save parent information');
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = () => {
    return parentName.trim() !== '';
  };

  const handleBackClick = () => {
    navigate('/account-center');
  };

  const handlePreferredLanguageChange = (languageCode: string) => {
    setProfile(prev => prev ? {...prev, secondaryLanguage: languageCode} : null);
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
  <>
      <div>
      {/* Breadcrumbs */}
      <div className="mt-3 text-start px-4">
        <Breadcrumb>
          <Breadcrumb.Item onClick={handleBackClick}>ACCOUNT</Breadcrumb.Item>
          <Breadcrumb.Item active>CHANGE LANGUAGE</Breadcrumb.Item>
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
            <h4 className="update-profile-header">Change Language</h4>
            <p className='update-profile-description'>Your name or personal information will not be linked to any IEP summaries. It will only be used to tailor our messages for you on this app.</p>
              <Form onSubmit={handleSubmit}>
                <Row className="mb-4">
                  <Col md={12}>
                    <Form.Group controlId="formParentName">
                      <Form.Label className="form-label">{t('parent.name.label')}</Form.Label>
                    </Form.Group>
                  </Col>
                </Row>

                {/* Preferred Language Section */}
                <Row className="mb-4">
                  <Col md={10}>
                    <Form.Group controlId="formPreferredLanguage">
                      <Form.Label className="small">{t('profile.preferredLanguage')}</Form.Label>
                      <Form.Select 
                        value={profile?.secondaryLanguage || 'en'}
                        onChange={e => handlePreferredLanguageChange(e.target.value)}
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

                <div className="d-grid">
                  <Button 
                    variant="primary" 
                    type='submit'
                    disabled={!isFormValid() || saving}
                    className="consent-button aiep-button"
                  >
                    {saving ? 'Saving' : 'Update Profile'}
                  </Button>
                </div>
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