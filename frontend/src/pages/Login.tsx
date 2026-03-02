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
          theme: 'filled_black',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          shape: 'rectangular',
        });
      }
    }
  }, [googleReady]);

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: '#0E0E12', backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
    >
      {/* Ambient glow behind card */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '480px',
        height: '480px',
        background: 'radial-gradient(ellipse, rgba(245,166,35,0.06) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div
        className="mx-auto w-full max-w-sm animate-fade-up"
        style={{
          background: '#16161C',
          border: '1px solid #2E2E3C',
          borderRadius: '8px',
          padding: '36px',
          position: 'relative',
          boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
        }}
      >
        {/* Top accent line */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #F5A623 40%, #F5A623 60%, transparent)',
          borderRadius: '8px 8px 0 0',
        }} />

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <img
            src="/knavishmantis-profilepic.jpg"
            alt="Logo"
            className="h-8 w-8 rounded-full object-cover"
            style={{ border: '1px solid #2E2E3C' }}
          />
          <div>
            <h1 className="font-display font-bold text-base leading-tight" style={{ color: '#EEEEF5' }}>
              Knavish <span style={{ color: '#F5A623' }}>Pipeline</span>
            </h1>
          </div>
        </div>

        <p className="font-mono text-xs mb-8 mt-2" style={{ color: '#4A4A60', letterSpacing: '0.04em' }}>
          PRODUCTION MANAGEMENT SYSTEM
        </p>

        {/* Info box */}
        <div
          className="mb-6 p-3 rounded"
          style={{ background: 'rgba(245, 166, 35, 0.07)', border: '1px solid rgba(245, 166, 35, 0.2)' }}
        >
          <p className="font-mono text-xs leading-relaxed" style={{ color: '#8888A8' }}>
            <span style={{ color: '#F5A623' }}>NEW?</span>{' '}
            Check out the{' '}
            <Link to="/guide" className="underline transition-colors" style={{ color: '#F5A623' }}>
              User Guide
            </Link>{' '}
            after signing in.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-4 rounded p-3 font-mono text-xs"
            style={{ background: 'rgba(255, 94, 94, 0.08)', border: '1px solid rgba(255, 94, 94, 0.25)', color: '#FF5E5E' }}
          >
            {error}
          </div>
        )}

        {/* Google Button */}
        <div className="my-6">
          <div id="google-signin-button" className="flex justify-center" />
        </div>

        {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <p className="mt-4 font-mono text-xs text-center" style={{ color: '#4A4A60' }}>
            Google OAuth not configured. Set VITE_GOOGLE_CLIENT_ID in .env
          </p>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #22222C', marginTop: '24px', paddingTop: '16px' }}>
          <p className="font-mono text-xs text-center" style={{ color: '#4A4A60', letterSpacing: '0.02em' }}>
            Access restricted to team members
          </p>
        </div>
      </div>
    </div>
  );
}
