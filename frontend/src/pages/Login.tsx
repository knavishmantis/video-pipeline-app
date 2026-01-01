import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { IconHelp } from '@tabler/icons-react';

declare global {
  interface Window {
    google: any; // Google OAuth SDK types
  }
}

const _BottomGradient = () => {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
};

export default function Login() {
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Load Google Identity Services
    const loadGoogleScript = () => {
      if (window.google) {
        initializeGoogleSignIn();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      
      script.onload = () => {
        initializeGoogleSignIn();
      };
    };

    const initializeGoogleSignIn = () => {
      if (!window.google || !import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        return;
      }

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
      if (!credentialResponse || !credentialResponse.credential) {
        setError('No credential received from Google');
        return;
      }
      await loginWithGoogle(credentialResponse.credential);
      navigate('/');
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Google sign-in failed';
      setError(errorMsg);
    }
  };

  const _handleGoogleSignIn = () => {
    if (!googleReady || !window.google) {
      setError('Google Sign-In not ready. Please refresh the page.');
      return;
    }

    // Trigger Google One Tap or popup
    window.google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: use popup
        window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: 'email profile',
          callback: (_response: any) => {
            // This won't work for OAuth2, we need to use the ID token flow
            // So we'll render the button instead
            const buttonContainer = document.getElementById('google-signin-button');
            if (buttonContainer && buttonContainer.children.length === 0) {
              window.google.accounts.id.renderButton(buttonContainer, {
                theme: 'outline',
                size: 'large',
                width: '100%',
                text: 'signin_with',
              });
            }
          },
        });
      }
    });
  };

  useEffect(() => {
    // Render Google button when ready
    if (googleReady && window.google) {
      const buttonContainer = document.getElementById('google-signin-button');
      if (buttonContainer && buttonContainer.children.length === 0) {
        window.google.accounts.id.renderButton(buttonContainer, {
          theme: 'filled_blue',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          shape: 'rectangular',
        });
      }
    }
  }, [googleReady]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4 dark:bg-neutral-900">
      <div className="shadow-input mx-auto w-full max-w-md rounded-none bg-white p-4 md:rounded-2xl md:p-8 dark:bg-black shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <img
            src="/knavishmantis-profilepic.jpg"
            alt="Logo"
            className="h-8 w-8 rounded-full object-cover"
          />
          <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">
            Knavish Video Pipeline
          </h2>
        </div>
        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          Sign in to continue
        </p>

        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <IconHelp className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>New to the app?</strong> Check out the{' '}
                <Link to="/guide" className="underline font-medium hover:text-blue-900 dark:hover:text-blue-200">
                  User Guide
                </Link>{' '}
                after signing in to learn how to use the platform.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="my-8">
          <div id="google-signin-button" className="flex justify-center"></div>
        </div>

        {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400 text-center">
            Note: Google OAuth not configured. Set VITE_GOOGLE_CLIENT_ID in .env
          </p>
        )}
      </div>
    </div>
  );
}
