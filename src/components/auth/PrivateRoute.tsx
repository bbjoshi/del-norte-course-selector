import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  // For testing purposes, bypass authentication check
  // TEMPORARY: Remove this for production
  const bypassAuth = true;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  // Allow access even without authentication for testing
  return bypassAuth || currentUser ? <>{children}</> : <Navigate to="/login" />;
};

export default PrivateRoute;
