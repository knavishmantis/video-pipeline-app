import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import { UserRole } from '../../../shared/types';

interface ProfileCheckRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

export default function ProfileCheckRoute({ children, requiredRole }: ProfileCheckRouteProps) {
  const { user, loading } = useAuth();
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (user && !loading) {
      checkProfile();
    } else if (!user && !loading) {
      // No user, stop checking
      setChecking(false);
    }
  }, [user, loading]);

  const checkProfile = async () => {
    try {
      const response = await authApi.checkProfileComplete();
      setProfileComplete(response.complete);
    } catch (error: unknown) {
      // If 403, profile is incomplete
      if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'status' in error.response && error.response.status === 403) {
        setProfileComplete(false);
      } else {
        console.error('Failed to check profile:', error);
        setProfileComplete(false);
      }
    } finally {
      setChecking(false);
    }
  };

  if (loading || checking) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    const userRoles = user.roles || (user.role ? [user.role] : []);
    if (!userRoles.includes(requiredRole)) {
      return <Navigate to="/" replace />;
    }
  }

  if (profileComplete === false) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <>{children}</>;
}

