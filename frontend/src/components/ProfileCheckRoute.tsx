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

  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const isSampleClipper = userRoles.includes('sample_clipper');

  useEffect(() => {
    if (user && !loading) {
      if (isSampleClipper) {
        // Sample clippers don't have a "complete profile" — they're confined to /clipper-sample
        setChecking(false);
        return;
      }
      checkProfile();
    } else if (!user && !loading) {
      setChecking(false);
    }
  }, [user, loading, isSampleClipper]);

  const checkProfile = async () => {
    try {
      const response = await authApi.checkProfileComplete();
      setProfileComplete(response.complete);
    } catch (error: unknown) {
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

  // Sample clippers are locked to the /clipper-sample route
  if (isSampleClipper) {
    return <Navigate to="/clipper-sample" replace />;
  }

  if (requiredRole) {
    if (!userRoles.includes(requiredRole)) {
      return <Navigate to="/" replace />;
    }
  }

  if (profileComplete === false) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <>{children}</>;
}
