import React, { useState, useEffect, useContext } from 'react';
import { Container, Form, Button, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import { UserProfile, Kid } from '../../common/types';
import { useNotifications } from '../../components/notif-manager';

export default function ViewAndAddChild() {
  const appContext = useContext(AppContext);
  const apiClient = new ApiClient(appContext);
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

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
      if (data.kids && data.kids.length > 0) {
        const firstChild = data.kids[0];
        setChildName(firstChild.name || '');
        setSchoolCity(firstChild.schoolCity || '');
        setFirstChildId(firstChild.kidId || null);
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
        if (updatedProfile.kids && updatedProfile.kids.length > 0) {
          updatedProfile.kids[0] = {
            ...updatedProfile.kids[0],
            name: childName,
            schoolCity: schoolCity,
            // Keep the existing kidId
            kidId: firstChildId
          };
          
          await apiClient.profile.updateProfile(updatedProfile);
          addNotification('success', 'Child information updated successfully');
        }
      } else {
        // Add new child
        await apiClient.profile.addKid(childName, schoolCity);
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
            <h2 className="text-center mb-4">
              {hasExistingChild ? 'Update Child Details' : 'Add Child Details'}
            </h2>
            
            <Form>
              <Row className="mb-3">
                <Col md={12}>
                  <Form.Group controlId="formChildName">
                    <Form.Label>Child Name</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Enter child's name"
                      value={childName} 
                      onChange={(e) => setChildName(e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-4">
                <Col md={12}>
                  <Form.Group controlId="formSchoolCity">
                    <Form.Label>City of School</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Enter school city"
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
                >
                  {saving ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
}