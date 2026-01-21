import React, { useState, useEffect, useContext } from 'react';
import { Container, Form, Row, Col, Alert, Spinner, Breadcrumb } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppContext } from '../../common/app-context';
import MobileTopNavigation from '../../components/MobileTopNavigation';
import AIEPFooter from '../../components/AIEPFooter';
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
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { t, setLanguage } = useLanguage();

  // Language options - hardcoded so users can always read the language names
  const LANGUAGE_OPTIONS = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '中文' },
    { value: 'es', label: 'Español' },
    { value: 'vi', label: 'Tiếng Việt' }
  ];

  // ============================================================================
  // DATA FETCHING WITH REACT QUERY
  // ============================================================================
  // useQuery automatically handles:
  // - Loading state (isLoading) - no need for manual setLoading(true/false)
  // - Error state (error) - no need for manual try/catch and setError
  // - Caching - if user navigates away and back, data is served from cache
  // - Background refetching - keeps data fresh automatically
  //
  // The 'queryKey' is a unique identifier for this cached data. Any component
  // using the same queryKey will share the same cached data.
  const { data: originalProfile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.profile.getProfile(),
  });

  // ============================================================================
  // LOCAL STATE FOR OPTIMISTIC UPDATES
  // ============================================================================
  // We keep a separate local 'profile' state because we want to show the new
  // value immediately when the user selects a language (optimistic update),
  // before the API call completes. The 'originalProfile' from useQuery
  // represents the server's confirmed state.
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Sync local state when query data loads or changes.
  // This runs when the component mounts and whenever originalProfile updates
  // (e.g., after a successful mutation invalidates the cache).
  useEffect(() => {
    if (originalProfile) {
      setProfile(originalProfile);
    }
  }, [originalProfile]);

  // ============================================================================
  // MUTATION FOR UPDATING PROFILE
  // ============================================================================
  // useMutation handles async operations that modify data (POST, PUT, DELETE).
  // Unlike useQuery which runs automatically, mutations only run when you
  // explicitly call mutate().
  //
  // Key properties:
  // - mutationFn: The async function to call
  // - onSuccess: Called after successful API response
  // - onError: Called if the API call fails
  // - isPending: Boolean indicating if the mutation is in progress (replaces manual 'saving' state)
  const updateProfileMutation = useMutation({
    mutationFn: (updatedProfile: UserProfile) => apiClient.profile.updateProfile(updatedProfile),
    onSuccess: (_, updatedProfile) => {
      // Update the app's language context so UI translations change
      if (updatedProfile.secondaryLanguage) {
        setLanguage(updatedProfile.secondaryLanguage as SupportedLanguage);
      }
      // Invalidate the 'profile' query cache. This marks the cached data as stale
      // and triggers a background refetch, ensuring our originalProfile stays
      // in sync with the server.
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      addNotification('success', t('profile.success.update'));
    },
    onError: () => {
      // If the API call fails, revert the optimistic update by resetting
      // local state back to the server's confirmed state (originalProfile).
      setProfile(originalProfile ?? null);
      addNotification('error', t('profile.error.update'));
    },
  });

  const handleBackClick = () => {
    navigate('/account-center');
  };

  // ============================================================================
  // LANGUAGE CHANGE HANDLER - OPTIMISTIC UPDATE PATTERN
  // ============================================================================
  // Flow:
  // 1. User selects new language
  // 2. We immediately update local state (optimistic update) - UI changes instantly
  // 3. We trigger the API call via mutation
  // 4. If API succeeds: cache is invalidated, originalProfile updates
  // 5. If API fails: we revert local state to originalProfile (in onError above)
  const handlePreferredLanguageChange = (languageCode: string) => {
    // Don't do anything if no profile loaded or same language selected
    if (!profile || languageCode === profile.secondaryLanguage) return;
    
    const updatedProfile = {...profile, secondaryLanguage: languageCode};
    
    // Step 1: Optimistic update - show the change immediately in the UI
    // This provides instant feedback to the user without waiting for the API
    setProfile(updatedProfile);
    
    // Step 2: Trigger the actual API call. The mutation's onSuccess/onError
    // callbacks will handle the result.
    updateProfileMutation.mutate(updatedProfile);
  };

  if (isLoading) {
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
        <Alert variant="danger">{t('profile.error.serviceUnavailable')}</Alert>
      </Container>
    );
  }

  return (
  <>
      <MobileTopNavigation />
      <div>
      {/* Breadcrumbs */}
      <div className="mt-3 text-start px-4 breadcrumb-container">
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
                      {/* 
                        isPending is true while the mutation is in progress.
                        We disable the select to prevent multiple rapid changes
                        while a save is in flight.
                      */}
                      <Form.Select 
                        value={profile?.secondaryLanguage || 'en'}
                        onChange={e => handlePreferredLanguageChange(e.target.value)}
                        disabled={updateProfileMutation.isPending}
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
    <AIEPFooter />
  </>
  );
}