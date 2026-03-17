import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { IconCamera } from '@tabler/icons-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function FlashbackReference() {
  const { user } = useAuth();
  const isClipper = user?.roles?.includes('clipper') || user?.role === 'clipper';
  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';
  const [content, setContent] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGuide = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/formula-guides/flashback`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          setContent(data.markdown.replace(/\{\{API_BASE\}\}/g, API_URL));
          setLastUpdated(data.lastUpdated);
        } else {
          setContent('# Flashback Reference Guide\n\nGuide content will be available here.');
        }
      } catch (error) {
        console.error('Failed to load flashback guide:', error);
        setContent('# Flashback Reference Guide\n\nGuide content will be available here.');
      } finally {
        setLoading(false);
      }
    };

    loadGuide();
  }, []);

  if (!isClipper && !isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Access Restricted</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>This reference guide is only available to clippers.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 4px', maxWidth: '860px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--col-clips-dim)', border: '1px solid var(--col-clips-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconCamera className="h-5 w-5" style={{ color: 'var(--col-clips)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1px' }}>Reference</p>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>Flashback Reference</h1>
          </div>
          {lastUpdated && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Updated {new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
          Loading guide…
        </div>
      ) : content ? (
        <div style={{ background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)', padding: '28px 32px', boxShadow: 'var(--card-shadow)' }}>
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
              {content}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
          Failed to load guide content
        </div>
      )}
    </div>
  );
}
