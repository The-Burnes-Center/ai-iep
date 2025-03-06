import React, { useState, useEffect, useContext } from 'react';
import { Container, Form, Button, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import { UserProfile } from '../../common/types';
import { useNotifications } from '../../components/notif-manager';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'es', label: 'Spanish' },
  { value: 'vi', label: 'Vietnamese' }
];

export default function AgeAndCity() {
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

  const handleNext = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      
      // Only update if there are changes to save
      const hasChanges = (
        typeof profile.secondaryLanguage !== 'undefined' || 
        typeof profile.city !== 'undefined'
      );
      
      if (hasChanges) {
        console.log("Has Changes")
        await apiClient.profile.updateProfile(profile);
        addNotification('success', 'Profile updated successfully');
      }
      
      // Always navigate to welcome page after clicking Next
      navigate('/view-update-add-child');
    } catch (err) {
      addNotification('error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container className="mt-4 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
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

  return (
    <Container 
      fluid 
      style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '64px'
      }}
    >
      <Row style={{ width: '100%', justifyContent: 'center' }}>
        <Col xs={12} md={8} lg={6}>
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-center mb-4">Please select below to get started</h2>
            
            <Form>
              <Row className="mb-3">
                <Col md={12}>
                  <Form.Group controlId="formPreferredLanguage">
                    <Form.Label>Preferred Language</Form.Label>
                    <Form.Select
                      value={profile?.secondaryLanguage || ''}
                      onChange={e => setProfile(prev => prev ? {...prev, secondaryLanguage: e.target.value} : null)}
                    >
                      <option value="">None</option>
                      {LANGUAGE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-4">
                <Col md={12}>
                  <Form.Group controlId="formCity">
                    <Form.Label>City of Residence</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Enter city"
                      value={profile?.city || ''} 
                      onChange={e => setProfile(prev => prev ? {...prev, city: e.target.value} : null)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-grid">
                <Button 
                  variant="primary" 
                  onClick={handleNext}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Next'}
                </Button>
              </div>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
}