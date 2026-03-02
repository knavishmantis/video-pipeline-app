import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface Window {
    google: any;
  }
}

export default function Login() {
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadGoogleScript = () => {
      if (window.google) { initializeGoogleSignIn(); return; }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      script.onload = () => initializeGoogleSignIn();
    };

    const initializeGoogleSignIn = () => {
      if (!window.google || !import.meta.env.VITE_GOOGLE_CLIENT_ID) return;
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });
      setGoogleReady(true);
    };

    loadGoogleScript();
  }, []);

  const handleGoogleCallback = async (credentialResponse: any) => {
    setError('');
    try {
      if (!credentialResponse?.credential) { setError('No credential received from Google'); return; }
      await loginWithGoogle(credentialResponse.credential);
      navigate('/');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Google sign-in failed';
      setError(errorMsg);
    }
  };

  useEffect(() => {
    if (googleReady && window.google) {
      const buttonContainer = document.getElementById('google-signin-button');
      if (buttonContainer && buttonContainer.children.length === 0) {
        window.google.accounts.id.renderButton(buttonContainer, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          shape: 'pill',
        });
      }
    }
  }, [googleReady]);

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="mx-auto w-full max-w-sm"
        style={{
          background: 'var(--modal-bg)',
          borderRadius: '12px',
          padding: '36px',
          position: 'relative',
          border: '1px solid var(--modal-border)',
          boxShadow: 'var(--modal-shadow)',
        }}
      >
        {/* Top accent line — gold */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--gold) 40%, var(--gold) 60%, transparent)',
          borderRadius: '2px',
        }} />

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <img
            src="/knavishmantis-profilepic.jpg"
            alt="Logo"
            className="h-9 w-9 rounded-full object-cover"
            style={{ border: '2px solid var(--border-default)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          />
          <div>
            <h1 className="font-bold text-base leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Knavish <span style={{ color: 'var(--gold)' }}>Pipeline</span>
            </h1>
          </div>
        </div>

        <p className="text-xs mb-8 mt-2" style={{ color: 'var(--text-muted)', fontWeight: '500', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          Production management system
        </p>

        {/* Info box */}
        <div
          className="mb-6 p-3 rounded-lg"
          style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold-border)' }}
        >
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--gold)', fontWeight: '700' }}>New?</span>{' '}
            Check out the{' '}
            <Link to="/guide" className="underline font-semibold" style={{ color: 'var(--gold)' }}>
              User Guide
            </Link>{' '}
            after signing in.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-4 rounded-lg p-3 text-xs font-medium"
            style={{ background: 'rgba(180, 60, 60, 0.08)', border: '1px solid rgba(180, 60, 60, 0.22)', color: 'var(--text-primary)' }}
          >
            {error}
          </div>
        )}

        {/* Google Button */}
        <div className="my-6">
          <div id="google-signin-button" className="flex justify-center" />
        </div>

        {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <p className="mt-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Google OAuth not configured. Set VITE_GOOGLE_CLIENT_ID in .env
          </p>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border-default)', marginTop: '24px', paddingTop: '16px' }}>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
            Access restricted to team members
          </p>
        </div>
      </div>
    </div>
  );
}
