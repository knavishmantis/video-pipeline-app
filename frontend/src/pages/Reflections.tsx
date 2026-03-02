import { useState, useEffect } from 'react';
import { Short } from '../../../shared/types';
import { shortsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../hooks/useAlert';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function ReflectionCard({
  short,
  overdue,
  selected,
  onClick,
}: {
  short: Short;
  overdue?: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderRadius: '8px',
        border: `1px solid ${overdue ? '#e05a4e44' : selected ? 'var(--gold-border)' : 'var(--border-default)'}`,
        background: selected ? 'var(--gold-dim)' : 'var(--bg-surface)',
        cursor: 'pointer',
        borderLeft: overdue ? '3px solid #e05a4e' : selected ? '3px solid var(--gold)' : '3px solid var(--border-default)',
        transition: 'background 0.15s, border-color 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: selected ? 'var(--gold)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {short.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '1px 6px',
            borderRadius: '4px',
            background: short.status === 'uploaded' ? 'var(--gold-dim)' : 'var(--bg-elevated)',
            color: short.status === 'uploaded' ? 'var(--gold)' : 'var(--text-muted)',
            border: `1px solid ${short.status === 'uploaded' ? 'var(--gold-border)' : 'var(--border-default)'}`,
          }}>
            {short.status}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {new Date(short.created_at).toLocaleDateString()}
          </span>
          {overdue && (
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#e05a4e', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Overdue
            </span>
          )}
        </div>
      </div>
      {short.reflection_rating != null && (
        <div style={{
          flexShrink: 0,
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          background: 'var(--gold-dim)',
          border: '1px solid var(--gold-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: '700',
          color: 'var(--gold)',
        }}>
          {short.reflection_rating}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  shorts,
  overdue,
  selectedId,
  onSelect,
}: {
  title: string;
  shorts: Short[];
  overdue?: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (shorts.length === 0) return null;
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: overdue ? '#e05a4e' : 'var(--text-muted)',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 2px',
      }}>
        {title}
        <span style={{
          fontSize: '9px',
          fontWeight: '700',
          padding: '1px 6px',
          borderRadius: '10px',
          background: overdue ? '#e05a4e22' : 'var(--bg-elevated)',
          color: overdue ? '#e05a4e' : 'var(--text-muted)',
          border: `1px solid ${overdue ? '#e05a4e44' : 'var(--border-default)'}`,
        }}>
          {shorts.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {shorts.map(s => (
          <ReflectionCard
            key={s.id}
            short={s}
            overdue={overdue}
            selected={selectedId === s.id}
            onClick={() => onSelect(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default function Reflections() {
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useAlert();

  const [shorts, setShorts] = useState<Short[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ rating: '', what_worked: '', what_didnt: '', would_do_differently: '' });
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.roles?.includes('admin') || (user as any)?.role === 'admin';

  useEffect(() => {
    shortsApi.getAll().then(data => {
      setShorts(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const s = shorts.find(x => x.id === selectedId);
    if (!s) return;
    setForm({
      rating: s.reflection_rating?.toString() || '',
      what_worked: s.reflection_what_worked || '',
      what_didnt: s.reflection_what_didnt || '',
      would_do_differently: s.reflection_would_do_differently || '',
    });
  }, [selectedId]);

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const updated = await shortsApi.update(selectedId, {
        reflection_what_worked: form.what_worked || null,
        reflection_what_didnt: form.what_didnt || null,
        reflection_would_do_differently: form.would_do_differently || null,
        reflection_rating: form.rating ? parseInt(form.rating, 10) : null,
      });
      setShorts(prev => prev.map(s => s.id === selectedId ? updated : s));
      showAlert('Reflection saved', { type: 'success' });
    } catch {
      showAlert('Failed to save reflection', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const relevant = shorts.filter(s => s.status === 'completed' || s.status === 'uploaded');
  const now = Date.now();

  const overdue = isAdmin
    ? relevant.filter(s => !s.reflection_at && (now - new Date(s.created_at).getTime()) > SEVEN_DAYS_MS)
    : [];
  const pending = relevant.filter(s => !s.reflection_at && !overdue.includes(s));
  const completed = relevant.filter(s => !!s.reflection_at);

  const selectedShort = shorts.find(s => s.id === selectedId) || null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      <AlertComponent />

      {/* ── Left column: card list ── */}
      <div style={{
        width: '300px',
        flexShrink: 0,
        borderRight: '1px solid var(--border-default)',
        overflowY: 'auto',
        padding: '24px 16px',
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Reflections
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.5' }}>
            Post-production reviews.
          </p>
        </div>

        {loading ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading…</div>
        ) : relevant.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No completed or uploaded shorts yet.</div>
        ) : (
          <>
            <Section title="Overdue" shorts={overdue} overdue selectedId={selectedId} onSelect={setSelectedId} />
            <Section title="Pending Reflection" shorts={pending} selectedId={selectedId} onSelect={setSelectedId} />
            <Section title="Completed" shorts={completed} selectedId={selectedId} onSelect={setSelectedId} />
          </>
        )}
      </div>

      {/* ── Right panel: form or empty state ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {!selectedShort ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            color: 'var(--text-muted)',
          }}>
            ← Select a short to fill in its reflection
          </div>
        ) : (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, lineHeight: '1.3' }}>
                  {selectedShort.title}
                </h2>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  flexShrink: 0,
                  background: selectedShort.status === 'uploaded' ? 'var(--gold-dim)' : 'var(--bg-elevated)',
                  color: selectedShort.status === 'uploaded' ? 'var(--gold)' : 'var(--text-muted)',
                  border: `1px solid ${selectedShort.status === 'uploaded' ? 'var(--gold-border)' : 'var(--border-default)'}`,
                }}>
                  {selectedShort.status}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Created {new Date(selectedShort.created_at).toLocaleDateString()}
              </div>
            </div>

            {/* Rating */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Rating (1–10)
              </div>
              <input
                type="number"
                min={1}
                max={10}
                value={form.rating}
                onChange={(e) => setForm(f => ({ ...f, rating: e.target.value }))}
                style={{ width: '80px', padding: '7px 10px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '7px', color: 'var(--text-primary)', fontSize: '13px' }}
              />
            </div>

            {/* Textareas */}
            {([
              { key: 'what_worked', label: 'What Worked' },
              { key: 'what_didnt', label: "What Didn't Work" },
              { key: 'would_do_differently', label: 'Would Do Differently' },
            ] as const).map(({ key, label }) => (
              <div key={key} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {label}
                </div>
                <textarea
                  rows={6}
                  value={form[key]}
                  onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '7px', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', lineHeight: '1.5' }}
                />
              </div>
            ))}

            {/* Save row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '9px 20px', background: 'var(--gold)', color: 'var(--bg-base)', border: 'none', borderRadius: '7px', fontWeight: '700', fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving…' : selectedShort.reflection_at ? 'Update Reflection' : 'Save Reflection'}
              </button>
              {selectedShort.reflection_at && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Saved {new Date(selectedShort.reflection_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
