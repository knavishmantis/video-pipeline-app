import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { IconEdit } from '@tabler/icons-react';

export default function EditingReference() {
  const { user } = useAuth();
  const isEditor = user?.roles?.includes('editor') || user?.role === 'editor';
  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGuide = async () => {
      try {
        const response = await fetch('/editing-formula.md');
        if (response.ok) {
          const text = await response.text();
          setContent(text);
        } else {
          setContent('# Editing Reference Guide\n\nGuide content will be available here.');
        }
      } catch (error) {
        console.error('Failed to load editing guide:', error);
        setContent('# Editing Reference Guide\n\nGuide content will be available here.');
      } finally {
        setLoading(false);
      }
    };

    loadGuide();
  }, []);

  if (!isEditor && !isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Access Restricted</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>This reference guide is only available to editors.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 4px', maxWidth: '860px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--col-editing-dim)', border: '1px solid var(--col-editing-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconEdit className="h-5 w-5" style={{ color: 'var(--col-editing)' }} />
          </div>
          <div>
            <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1px' }}>Reference</p>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>Editing Reference</h1>
          </div>
        </div>

        <div style={{ padding: '12px 16px', background: 'var(--col-editing-dim)', border: '1px solid var(--col-editing-border)', borderRadius: '8px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.55', margin: 0 }}>
            <span style={{ color: 'var(--col-editing)', fontWeight: '700' }}>⚠️ Primary Reference</span>{' '}
            This is your primary reference document for video editing and formatting.
            Refer to this guide regularly when editing videos to ensure consistency and quality.
          </p>
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
