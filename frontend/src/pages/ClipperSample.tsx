import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { IconBook, IconMovie, IconUpload, IconCircleCheck, IconLogout, IconClock, IconBrandDiscord } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { samplesApi, formulaGuidesApi, SampleDetail } from '../services/api';
import { SampleSceneCard } from '../components/SampleSceneCard';

declare global {
  interface Window {
    google: any;
  }
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ClipperSample() {
  const { user, loading, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const isSampleClipper = userRoles.includes('sample_clipper');

  // Any real (non-sample) user who lands here goes straight to the main app
  useEffect(() => {
    if (!loading && user && !isSampleClipper) {
      navigate('/', { replace: true });
    }
  }, [loading, user, isSampleClipper, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-base)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <SignInGate />;
  }

  if (!isSampleClipper) {
    return null; // useEffect will redirect
  }

  // First-time flow: collect their Discord handle before showing the sample
  if (!user.discord_username) {
    return <DiscordGate onSaved={refreshUser} onLogout={logout} />;
  }

  return <SamplePanel user={user} onLogout={logout} />;
}

// ────────────────────────────────────────────────────────────────────────────────
// Sign-in gate (unauthed state)
// ────────────────────────────────────────────────────────────────────────────────
function SignInGate() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCallback = async (credentialResponse: any) => {
    setError('');
    try {
      if (!credentialResponse?.credential) { setError('No credential received from Google'); return; }
      await loginWithGoogle(credentialResponse.credential);
      // The component will re-render with the user in context
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Sign-in failed';
      setError(errorMsg);
    }
  };

  useEffect(() => {
    if (googleReady && window.google) {
      const container = document.getElementById('sample-google-button');
      if (container && container.children.length === 0) {
        window.google.accounts.id.renderButton(container, {
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
        className="mx-auto w-full max-w-md"
        style={{
          background: 'var(--modal-bg)',
          borderRadius: '14px',
          padding: '40px',
          position: 'relative',
          border: '1px solid var(--modal-border)',
          boxShadow: 'var(--modal-shadow)',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--gold) 40%, var(--gold) 60%, transparent)',
          borderRadius: '2px',
        }} />

        <div className="flex items-center gap-3 mb-4">
          <img
            src="/knavishmantis-profilepic.png"
            alt="Logo"
            className="h-10 w-10 rounded-full object-cover"
            style={{ border: '2px solid var(--border-default)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          />
          <div>
            <h1 className="font-bold text-base leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Knavish <span style={{ color: 'var(--gold)' }}>Clipper Sample</span>
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: '500', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Sample assignment access
            </p>
          </div>
        </div>

        <div
          className="mb-6 p-4 rounded-lg"
          style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold-border)' }}
        >
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--gold)', fontWeight: '700' }}>Welcome.</span>{' '}
            You've been invited to apply as a clipper for KnavishMantis. Sign in with the{' '}
            <strong>Google account matching the email this invite was sent to</strong>.
          </p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-lg p-3 text-xs font-medium"
            style={{ background: 'rgba(180, 60, 60, 0.08)', border: '1px solid rgba(180, 60, 60, 0.22)', color: 'var(--text-primary)' }}
          >
            {error}
          </div>
        )}

        <div className="my-4">
          <div id="sample-google-button" className="flex justify-center" />
        </div>

        <div style={{ borderTop: '1px solid var(--border-default)', marginTop: '28px', paddingTop: '16px' }}>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
            Sign-in is restricted to invited prospects only
          </p>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Discord gate — first-time prompt to collect Discord username
// ────────────────────────────────────────────────────────────────────────────────
function DiscordGate({ onSaved, onLogout }: { onSaved: () => void; onLogout: () => void }) {
  const [discord, setDiscord] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = discord.trim();
    if (!trimmed) {
      setError('Please enter your Discord username');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await samplesApi.saveMyDiscord(trimmed);
      await onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="mx-auto w-full max-w-md"
        style={{
          background: 'var(--modal-bg)',
          borderRadius: '14px',
          padding: '40px',
          position: 'relative',
          border: '1px solid var(--modal-border)',
          boxShadow: 'var(--modal-shadow)',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--gold) 40%, var(--gold) 60%, transparent)',
          borderRadius: '2px',
        }} />

        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          background: 'var(--gold-dim)',
          border: '1px solid var(--gold-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <IconBrandDiscord size={22} style={{ color: 'var(--gold)' }} />
        </div>

        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          One quick thing
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '18px' }}>
          What's your Discord username? We use it to reach out if we decide to bring you on — or later, if
          a clipping spot opens up.
        </p>

        <label style={{
          display: 'block',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '6px',
        }}>
          Discord username
        </label>
        <input
          type="text"
          value={discord}
          onChange={(e) => setDiscord(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          placeholder="e.g. knavish"
          autoFocus
          style={{
            width: '100%',
            padding: '11px 14px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            outline: 'none',
            fontFamily: 'inherit',
            marginBottom: '8px',
          }}
        />

        {error && (
          <div
            className="mb-2 rounded-lg p-3 text-xs font-medium"
            style={{
              background: 'rgba(180, 60, 60, 0.08)',
              border: '1px solid rgba(180, 60, 60, 0.22)',
              color: 'var(--text-primary)',
              marginTop: '10px',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: '18px',
            width: '100%',
            padding: '12px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#fff',
            background: 'var(--gold)',
            border: 'none',
            borderRadius: '8px',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Continue to sample'}
        </button>

        <div style={{ borderTop: '1px solid var(--border-default)', marginTop: '24px', paddingTop: '14px', textAlign: 'center' }}>
          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Sample panel (authed state)
// ────────────────────────────────────────────────────────────────────────────────
function SamplePanel({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [sample, setSample] = useState<SampleDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assignment' | 'guide'>('assignment');

  useEffect(() => {
    loadSample();
  }, []);

  const loadSample = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await samplesApi.getMine();
      setSample(data);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to load sample';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading your assignment…</div>
      </div>
    );
  }

  if (loadError || !sample) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{
          maxWidth: '440px',
          background: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
          boxShadow: 'var(--modal-shadow)',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
            No active sample assignment
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '20px' }}>
            {loadError || 'Your sample assignment could not be loaded. It may have expired — contact the admin if you believe this is an error.'}
          </p>
          <button
            onClick={onLogout}
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const isSubmitted = !!sample.submitted_at;
  const expiresAt = new Date(sample.expires_at);
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* ── Top bar ── */}
      <div style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <img src="/knavishmantis-profilepic.png" alt="Logo" style={{ height: '32px', width: '32px', borderRadius: '50%', border: '2px solid var(--border-default)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Sample Assignment
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {sample.prospect_name} · {sample.prospect_email}
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          borderRadius: '6px',
          background: isSubmitted ? 'var(--col-ready-dim, rgba(80,180,120,0.1))' : 'var(--gold-dim)',
          border: `1px solid ${isSubmitted ? 'var(--col-ready-border, rgba(80,180,120,0.3))' : 'var(--gold-border)'}`,
          fontSize: '11px',
          fontWeight: 600,
          color: isSubmitted ? 'var(--col-ready, rgb(60,140,90))' : 'var(--gold)',
        }}>
          {isSubmitted ? (
            <><IconCircleCheck size={14} /> Submitted</>
          ) : (
            <><IconClock size={14} /> {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left</>
          )}
        </div>
        <button
          onClick={onLogout}
          title="Sign out"
          style={{
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <IconLogout size={14} /> Sign out
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        padding: '0 24px',
        borderBottom: '1px solid var(--border-default)',
        background: 'var(--bg-surface)',
        display: 'flex',
        gap: '4px',
      }}>
        {[
          { id: 'assignment' as const, label: 'Assignment', icon: <IconMovie size={14} /> },
          { id: 'guide' as const, label: 'Flashback Guide', icon: <IconBook size={14} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--gold)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--gold)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '-1px',
              transition: 'color 0.15s ease',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '32px 24px', maxWidth: '860px', margin: '0 auto' }}>
        {activeTab === 'assignment' ? (
          <AssignmentTab sample={sample} onSubmitted={loadSample} />
        ) : (
          <GuideTab />
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Assignment tab
// ────────────────────────────────────────────────────────────────────────────────
function AssignmentTab({ sample, onSubmitted }: { sample: SampleDetail; onSubmitted: () => void }) {
  const isSubmitted = !!sample.submitted_at;
  const scenes = sample.scenes || [];

  return (
    <div>
      {/* Welcome intro */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '12px',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: 'var(--card-shadow)',
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', letterSpacing: '-0.02em' }}>
          Welcome, {sample.prospect_name.split(' ')[0]}!
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '12px' }}>
          These scenes are taken directly from a past short — the real short had{' '}
          <strong>37 scenes in total</strong>, so this is a good indication of what an average clip
          set will be like. The short has already been uploaded and the clips you create here will{' '}
          <strong>not be used at all</strong> — this is only a sample to confirm you're able to
          create the clips.
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '12px' }}>
          The <strong>Flashback Guide</strong> tab is an extensive guide on how to set up your game,
          mods, and shader, and covers the techniques for recording clips which you must follow
          when creating your own.
        </p>
        <div style={{
          padding: '12px 14px',
          background: 'rgba(180, 60, 60, 0.06)',
          border: '1px solid rgba(180, 60, 60, 0.22)',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
          marginBottom: '12px',
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>Please do not share the Flashback Guide with anyone.</strong>{' '}
          It includes custom mods and assets created specifically for the channel.
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '12px' }}>
          Going through the setup and completing the sample should only take about{' '}
          <strong>45 minutes to an hour</strong>. Even if you're not chosen immediately after
          completing the sample, your Discord will be saved and we may reach out in the future
          when we're looking to add clippers again.
        </p>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-primary)',
          marginTop: '16px',
          marginBottom: 0,
          fontStyle: 'italic',
          fontWeight: 600,
          letterSpacing: '-0.01em',
        }}>
          — Knavish
        </p>
      </div>

      {/* Scene list */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', letterSpacing: '-0.01em' }}>
          Scenes ({scenes.length})
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {scenes.map((scene: any, idx: number) => (
            <SampleSceneCard key={scene.id} scene={scene} index={idx + 1} />
          ))}
        </div>
      </div>

      {/* Submission zone */}
      {isSubmitted ? (
        <SubmittedState sample={sample} />
      ) : (
        <SubmissionZone onSubmitted={onSubmitted} />
      )}
    </div>
  );
}

// ── Submission zone ────────────────────────────────────────────────────────────
function SubmissionZone({ onSubmitted }: { onSubmitted: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (f: File) => {
    setError(null);
    if (!f.name.toLowerCase().endsWith('.zip')) {
      setError('Please upload a .zip file containing your clips');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const { upload_url, bucket_path } = await samplesApi.getMyUploadUrl(file.name, file.size, file.type || 'application/zip');

      await axios.put(upload_url, file, {
        headers: { 'Content-Type': file.type || 'application/zip' },
        timeout: 0,
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      await samplesApi.confirmMySubmission(bucket_path, file.name, file.size);
      onSubmitted();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: '12px',
      padding: '28px',
      boxShadow: 'var(--card-shadow)',
    }}>
      <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
        Submit your clips
      </h2>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: '1.6' }}>
        Zip all your clips into a single file, then upload here.
      </p>

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          if (uploading) return;
          const dropped = e.dataTransfer.files[0];
          if (dropped) handleFileSelect(dropped);
        }}
        style={{
          border: '2px dashed var(--border-default)',
          borderRadius: '10px',
          padding: '36px 20px',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          background: 'var(--bg-base)',
          transition: 'border-color 0.15s ease, background 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!uploading) {
            e.currentTarget.style.borderColor = 'var(--gold)';
            e.currentTarget.style.background = 'var(--gold-dim)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-default)';
          e.currentTarget.style.background = 'var(--bg-base)';
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f);
          }}
        />
        <IconUpload size={28} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          {file ? file.name : 'Drop your clips.zip here or click to browse'}
        </div>
        {file && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {(file.size / (1024 * 1024)).toFixed(1)} MB
          </div>
        )}
      </div>

      {uploading && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Uploading… {progress}%</div>
          <div style={{ height: '6px', background: 'var(--bg-base)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'var(--gold)',
              transition: 'width 0.2s ease',
            }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '12px',
          padding: '10px 12px',
          background: 'rgba(180, 60, 60, 0.08)',
          border: '1px solid rgba(180, 60, 60, 0.22)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--text-primary)',
        }}>
          {error}
        </div>
      )}

      {file && !uploading && (
        <button
          onClick={handleUpload}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '12px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--text-on-gold, #fff)',
            background: 'var(--gold)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          Submit sample
        </button>
      )}
    </div>
  );
}

// ── Submitted state ────────────────────────────────────────────────────────────
function SubmittedState({ sample }: { sample: SampleDetail }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--col-ready-border, rgba(80,180,120,0.3))',
      borderRadius: '12px',
      padding: '32px 28px',
      textAlign: 'center',
      boxShadow: 'var(--card-shadow)',
    }}>
      <IconCircleCheck size={40} style={{ color: 'var(--col-ready, rgb(80,160,100))', marginBottom: '12px' }} />
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Sample submitted
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '4px' }}>
        Thanks — we've received your clips. We'll review and get back to you soon.
      </p>
      {sample.submission_file_name && (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {sample.submission_file_name} · {sample.submission_file_size ? (sample.submission_file_size / (1024 * 1024)).toFixed(1) + ' MB' : ''}
        </p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Guide tab (reuses flashback-formula endpoint)
// ────────────────────────────────────────────────────────────────────────────────
function GuideTab() {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await formulaGuidesApi.getFlashback();
        setContent(data.markdown.replace(/\{\{API_BASE\}\}/g, API_URL));
      } catch {
        setContent('# Flashback Guide\n\nFailed to load guide. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
        Loading guide…
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: '12px',
      border: '1px solid var(--border-default)',
      padding: '28px 32px',
      boxShadow: 'var(--card-shadow)',
    }}>
      <div className="prose-theme">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            img: ({ node, ...props }: any) => (
              <img
                {...props}
                style={{ borderRadius: '8px', boxShadow: 'var(--shadow-md)', margin: '16px 0', maxWidth: '100%', height: 'auto' }}
                loading="lazy"
                alt={props.alt || 'Image'}
              />
            ),
            a: ({ node, ...props }: any) => (
              <a
                {...props}
                style={{ color: 'var(--gold)', textDecoration: 'underline' }}
                target="_blank"
                rel="noopener noreferrer"
              />
            ),
          }}
        >
          {content || ''}
        </ReactMarkdown>
      </div>
    </div>
  );
}
