import React, { useState, useEffect, useContext } from 'react';
import { Container, Form, Button, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import { UserProfile, Child } from '../../common/types';
import { useNotifications } from '../../components/notif-manager';
import { useLanguage } from '../../common/language-context'; 
import './ProfileForms.css';

export default function ViewAndAddChild() {
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext);
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [childName, setChildName] = useState<string>('');
  const [schoolCity, setSchoolCity] = useState<string>('');
  const [hasExistingChild, setHasExistingChild] = useState<boolean>(false);
  const [firstChildId, setFirstChildId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await apiClient.profile.getProfile();
      setProfile(data);
      
      // Check if the user has any children
      if (data.children && data.children.length > 0) {
        const firstChild = data.children[0];
        setChildName(firstChild.name || '');
        setSchoolCity(firstChild.schoolCity || '');
        setFirstChildId(firstChild.childId || null);
        setHasExistingChild(true);
      } else {
        setHasExistingChild(false);
      }
      
      setError(null);
    } catch (err) {
      setError('Service unavailable');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!childName.trim() || !schoolCity.trim()) {
      return; // Button should be disabled in this case
    }

    try {
      setSaving(true);
      
      if (hasExistingChild && firstChildId) {
        // Update existing child's information
        const updatedProfile = { ...profile };
        if (updatedProfile.children && updatedProfile.children.length > 0) {
          updatedProfile.children[0] = {
            ...updatedProfile.children[0],
            name: childName,
            schoolCity: schoolCity,
            // Keep the existing childId
            childId: firstChildId
          };
          
          await apiClient.profile.updateProfile(updatedProfile);
          addNotification('success', 'Child information updated successfully');
        }
      } else {
        // Add new child
        await apiClient.profile.addChild(childName, schoolCity);
        addNotification('success', 'Child added successfully');
      }
      
      // Navigate to welcome page
      navigate('/welcome-page');
    } catch (err) {
      addNotification('error', hasExistingChild ? 'Failed to update child information' : 'Failed to add child');
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = () => {
    return childName.trim() !== '' && schoolCity.trim() !== '';
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
            <h2 className="text-center profile-title">
              {t('child.title')}
            </h2>
            
            <Form>
              <Row className="mb-3">
                <Col md={12}>
                  <Form.Group controlId="formChildName">
                    <Form.Label className="form-label">{t('child.name.label')}</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder={t('child.name.placeholder')}
                      value={childName} 
                      onChange={(e) => setChildName(e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-4">
                <Col md={12}>
                  <Form.Group controlId="formSchoolCity">
                    <Form.Label className="form-label">{t('child.school.label')}</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder={t('child.school.placeholder')}
                      value={schoolCity} 
                      onChange={(e) => setSchoolCity(e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-grid">
                <Button 
                  variant="primary" 
                  onClick={handleSaveAndContinue}
                  disabled={!isFormValid() || saving}
                  className="button-text"
                >
                  {saving ? t('child.button.saving') : t('child.button.save')}
                </Button>
              </div>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
}