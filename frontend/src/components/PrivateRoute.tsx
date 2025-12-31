import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../../../shared/types';

interface PrivateRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

export default function PrivateRoute({ children, requiredRole }: PrivateRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
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

  return <>{children}</>;
}

