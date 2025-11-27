import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { StatusIndicator } from '@cloudscape-design/components';
import { useAuth } from '../common/auth-provider';

export function ProtectedRoute() {
  const { authenticated, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <StatusIndicator type="loading">Checking authentication...</StatusIndicator>
      </div>
    );
  }

  // Redirect to login if not authenticated
  // Save the location they were trying to access
  if (!authenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // User is authenticated, render the protected routes
  return <Outlet />;
}

