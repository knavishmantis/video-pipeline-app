import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return null;
  }

  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';

  return (
    <nav style={{
      background: '#FFFFFF',
      borderBottom: '1px solid #E2E8F0',
      padding: '0 24px',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <Link 
          to="/" 
          style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1E293B',
            textDecoration: 'none',
          }}
        >
          Knavish Video Pipeline
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {isAdmin && (
            <>
              <Link
                to="/users"
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#64748B',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#1E293B'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#64748B'}
              >
                Users
              </Link>
              <Link
                to="/payments"
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#64748B',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#1E293B'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#64748B'}
              >
                Payments
              </Link>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{
          fontSize: '14px',
          color: '#64748B',
        }}>
          {user?.name}
        </span>
        <button
          onClick={logout}
          style={{
            padding: '8px 16px',
            background: '#EF4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#DC2626'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#EF4444'}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

