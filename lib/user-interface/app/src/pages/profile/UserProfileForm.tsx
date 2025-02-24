import React, { useState, useEffect, useContext } from 'react';
import { Container, Form, Button, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { AppContext } from '../../common/app-context';
import { ApiClient } from '../../common/api-client/api-client';
import { UserProfile, Kid } from '../../common/types';
import { useNotifications } from '../../components/notif-manager';

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [newKid, setNewKid] = useState<Kid | null>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      setSaving(true);
      await apiClient.profile.updateProfile(profile);
      addNotification('success', 'Profile updated successfully');
    } catch (err) {
      addNotification('error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddKid = async () => {
    if (!newKid?.name || !newKid?.schoolCity) {
      addNotification('error', 'Please fill in all fields for the child');
      return;
    }
    
    try {
      setSaving(true);
      await apiClient.profile.addKid(newKid.name, newKid.schoolCity);
      await loadProfile();
      setNewKid(null);
      addNotification('success', 'Child added successfully');
    } catch (err) {
      addNotification('error', 'Failed to add child');
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
    <Container className="mt-4">
      <h2 className="mb-4">User Profile</h2>
      <Form onSubmit={handleSubmit}>
        <Row className="mb-3">
          <Col md={6}>
            <Form.Group controlId="formEmail">
              <Form.Label>Email</Form.Label>
              <Form.Control 
                type="email" 
                value={profile?.email || ''} 
                disabled 
              />
              <Form.Text className="text-muted">
                Email cannot be changed
              </Form.Text>
            </Form.Group>
          </Col>

          <Col md={6}>
            <Form.Group controlId="formPhone">
              <Form.Label>Phone</Form.Label>
              <Form.Control 
                type="tel" 
                placeholder="Enter phone number"
                value={profile?.phone || ''} 
                onChange={e => setProfile(prev => prev ? {...prev, phone: e.target.value} : null)}
              />
            </Form.Group>
          </Col>
        </Row>

        <Row className="mb-3">
          <Col md={6}>
            <Form.Group controlId="formPrimaryLanguage">
              <Form.Label>Primary Language</Form.Label>
              <Form.Select
                value={profile?.primaryLanguage || 'en'}
                onChange={e => setProfile(prev => prev ? {...prev, primaryLanguage: e.target.value} : null)}
              >
                {LANGUAGE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={6}>
            <Form.Group controlId="formSecondaryLanguage">
              <Form.Label>Secondary Language</Form.Label>
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
          <Col md={6}>
            <Form.Group controlId="formCity">
              <Form.Label>City</Form.Label>
              <Form.Control 
                type="text" 
                placeholder="Enter city"
                value={profile?.city || ''} 
                onChange={e => setProfile(prev => prev ? {...prev, city: e.target.value} : null)}
              />
            </Form.Group>
          </Col>
        </Row>

        <h3 className="mb-3">Children</h3>
        {profile?.kids && profile.kids.length > 0 ? (
          <>
            {profile.kids.map((kid, index) => (
              <Row key={kid.kidId || index} className="mb-3">
                <Col md={5}>
                  <Form.Group controlId={`formKidName${index}`}>
                    <Form.Label className="small">Name</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={kid.name}
                      onChange={e => {
                        const newKids = [...profile.kids];
                        newKids[index] = {...kid, name: e.target.value};
                        setProfile(prev => prev ? {...prev, kids: newKids} : null);
                      }}
                    />
                  </Form.Group>
                </Col>
                <Col md={5}>
                  <Form.Group controlId={`formKidSchool${index}`}>
                    <Form.Label className="small">School City</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={kid.schoolCity}
                      onChange={e => {
                        const newKids = [...profile.kids];
                        newKids[index] = {...kid, schoolCity: e.target.value};
                        setProfile(prev => prev ? {...prev, kids: newKids} : null);
                      }}
                    />
                  </Form.Group>
                </Col>
              </Row>
            ))}
          </>
        ) : (
          <Alert variant="info">No children added yet</Alert>
        )}

        {newKid && (
          <Row className="mb-3 mt-3 border-top pt-3">
            <Col md={5}>
              <Form.Group controlId="formNewKidName">
                <Form.Label>Name</Form.Label>
                <Form.Control 
                  type="text" 
                  placeholder="Enter child's name"
                  value={newKid.name}
                  onChange={e => setNewKid(prev => prev ? {...prev, name: e.target.value} : null)}
                />
              </Form.Group>
            </Col>
            <Col md={5}>
              <Form.Group controlId="formNewKidSchool">
                <Form.Label>School City</Form.Label>
                <Form.Control 
                  type="text" 
                  placeholder="Enter school city"
                  value={newKid.schoolCity}
                  onChange={e => setNewKid(prev => prev ? {...prev, schoolCity: e.target.value} : null)}
                />
              </Form.Group>
            </Col>
            <Col md={2} className="d-flex align-items-end">
              <Button 
                variant="success" 
                onClick={handleAddKid}
                disabled={saving}
                className="mb-3"
              >
                {saving ? 'Adding...' : 'Add Child'}
              </Button>
            </Col>
          </Row>
        )}

        <div className="mt-4 d-flex gap-2">
          <Button 
            variant="primary" 
            type="submit" 
            disabled={saving}
          >
            {saving ? 'Updating...' : 'Update Profile'}
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => setNewKid({name: '', schoolCity: ''})}
            disabled={!!newKid || saving}
          >
            Add Child
          </Button>
        </div>
      </Form>
    </Container>
  );
}