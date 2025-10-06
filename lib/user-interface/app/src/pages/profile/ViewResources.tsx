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

export default function ViewResources() {
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext);
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { t, setLanguage } = useLanguage();

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
          <Breadcrumb.Item onClick={handleBackClick}>SUPPORT CENTER</Breadcrumb.Item>
          <Breadcrumb.Item active>RESOURCES</Breadcrumb.Item>
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
            <h4 className="update-profile-header">Resources</h4>
            <p className='update-profile-description'>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod  tempor incididunt.</p>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  <MobileBottomNavigation />
  </>
  );
}