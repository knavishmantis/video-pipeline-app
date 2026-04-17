import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { scriptEngineApi } from '../services/api';

// ─── Markdown helpers ─────────────────────────────────────────────────────────
function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const match = /language-(\w+)/.exec(className || '');
  const code = String(children).replace(/\n$/, '');
  if (match) {
    return (
      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" customStyle={{
        margin: '10px 0', borderRadius: '8px', fontSize: '11px', lineHeight: 1.55,
        border: '1px solid var(--border-default)',
      }}>{code}</SyntaxHighlighter>
    );
  }
  return (
    <pre style={{
      background: '#282c34', padding: '14px 16px', borderRadius: '8px', overflow: 'auto',
      fontSize: '11px', fontFamily: 'ui-monospace, monospace', lineHeight: 1.55,
      border: '1px solid var(--border-default)', margin: '10px 0', color: '#abb2bf',
    }}><code style={{ fontFamily: 'inherit' }}>{children}</code></pre>
  );
}
function InlineCode({ children }: { children: React.ReactNode }) {
  return <code style={{
    background: 'var(--bg-base)', padding: '2px 6px', borderRadius: '4px',
    fontSize: '11px', color: 'var(--gold)',
    fontFamily: 'ui-monospace, monospace', border: '1px solid var(--border-subtle)',
  }}>{children}</code>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SRC: Record<string, { short: string; full: string }> = {
  code:            { short: 'CODE',   full: 'Code' },
  youtube:         { short: 'YT',     full: 'YouTube' },
  reddit:          { short: 'RDT',    full: 'Reddit' },
  bugs:            { short: 'BUGS',   full: 'Bugs' },
  mods:            { short: 'MODS',   full: 'Mods' },
  wiki:            { short: 'WIKI',   full: 'Wiki' },
  minecraft:       { short: 'MC',     full: 'Minecraft' },
  km_comments:     { short: 'KMC',    full: 'KM Comments' },
  mojang_twitter:  { short: 'MOJANG', full: 'Mojang Twitter' },
  feedback_mc:     { short: 'FDBK',   full: 'Feedback Site' },
  speedrun:        { short: 'SRC',    full: 'Speedrun' },
  yarn_fabric:     { short: 'YARN',   full: 'Yarn/Fabric' },
};
const SOURCE_KEYS = Object.keys(SRC);

const DEFAULT_COUNTS = { unreviewed: 0, created: 0, skipped: 0, total: 0,
  avg_rating_unreviewed: 0, high_unreviewed: 0, mid_unreviewed: 0, low_unreviewed: 0 };

type Tab = 'unreviewed' | 'created' | 'skipped';
type SortKey = 'rating_desc' | 'rating_asc' | 'age_desc' | 'age_asc';
const SORT_LABELS: Record<SortKey, string> = {
  rating_desc: 'Rating ↓', rating_asc: 'Rating ↑', age_desc: 'Newest', age_asc: 'Oldest',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ago = (d: string) => {
  if (!d) return '—';
  const x = !d.includes('Z') && !d.includes('+') && !d.includes('T') ? new Date(d + 'Z') : new Date(d);
  const m = Math.floor((Date.now() - x.getTime()) / 60000);
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
};
const ratingColor = (r: number | null) => r == null ? 'var(--text-muted)'
  : r >= 8 ? 'var(--green)' : r >= 6 ? 'var(--gold)' : 'var(--red)';

// ─── Mobile hook ──────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const h = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return mobile;
}

// ─── Toasts ───────────────────────────────────────────────────────────────────
type Toast = { id: number; kind: 'info' | 'error'; message: string; actionLabel?: string; onAction?: () => void };
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const push = useCallback((t: Omit<Toast, 'id'>, ms = 5000) => {
    const id = idRef.current++;
    setToasts(ts => [...ts, { ...t, id }]);
    if (ms > 0) setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), ms);
    return id;
  }, []);
  const dismiss = useCallback((id: number) => setToasts(ts => ts.filter(x => x.id !== id)), []);
  return { toasts, push, dismiss };
}
function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 100, maxWidth: 340 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.kind === 'error' ? 'color-mix(in srgb, var(--red) 12%, var(--bg-elevated))' : 'var(--bg-elevated)',
          border: `1px solid ${t.kind === 'error' ? 'var(--red)' : 'var(--border-default)'}`,
          borderRadius: 8, padding: '11px 14px', boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 12, fontSize: 12,
          color: t.kind === 'error' ? 'var(--red)' : 'var(--text-primary)',
        }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
          {t.actionLabel && t.onAction && (
            <button onClick={() => { t.onAction?.(); onDismiss(t.id); }} style={{
              background: 'none', border: 'none', color: 'var(--gold)', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 6px',
            }}>{t.actionLabel}</button>
          )}
          <button onClick={() => onDismiss(t.id)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: '0 2px',
          }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Help overlay ─────────────────────────────────────────────────────────────
function HelpOverlay({ onClose }: { onClose: () => void }) {
  const items: [string, string][] = [
    ['j / ↓', 'Next brief'],
    ['k / ↑', 'Previous brief'],
    ['Enter', 'Open focused brief'],
    ['Esc', 'Close / back'],
    ['c', 'Create Short (and advance)'],
    ['s', 'Skip (and advance)'],
    ['u', 'Unmark (back to Unreviewed)'],
    ['/', 'Focus search'],
    ['?', 'Toggle this help'],
  ];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 12,
        padding: '26px 30px', minWidth: 340, maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, margin: '0 0 18px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Keyboard shortcuts</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 18px', fontSize: 12 }}>
          {items.map(([key, desc]) => (
            <Fragment key={key}>
              <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 4, padding: '3px 9px', fontSize: 10, fontWeight: 700, color: 'var(--gold)', fontFamily: 'ui-monospace, monospace', textAlign: 'center' }}>{key}</kbd>
              <span style={{ color: 'var(--text-secondary)', alignSelf: 'center' }}>{desc}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Backlog() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toasts, push, dismiss } = useToasts();

  const [briefs, setBriefs] = useState<any[]>([]);
  const [counts, setCounts] = useState(DEFAULT_COUNTS);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<Tab>('unreviewed');
  const [source, setSource] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<SortKey>('rating_desc');
  const [search, setSearch] = useState('');
  const [focusIdx, setFocusIdx] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // ── loaders ──
  const loadBriefs = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true); else setRefreshing(true);
      const data = await scriptEngineApi.getBriefs({
        human_status: tab,
        source: source || undefined,
        min_rating: minRating || undefined,
      });
      setBriefs(data);
    } catch {
      push({ kind: 'error', message: 'Failed to load briefs' });
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [tab, source, minRating, push]);

  const loadCounts = useCallback(async () => {
    try { setCounts(await scriptEngineApi.getBriefCounts()); } catch { /* non-fatal */ }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    try { setSelected(await scriptEngineApi.getBrief(id)); }
    catch { push({ kind: 'error', message: 'Failed to load brief' }); }
  }, [push]);

  useEffect(() => {
    loadBriefs(briefs.length === 0);
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, source, minRating]);

  // ── derived ──
  const filtered = useMemo(() => {
    let r = briefs;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(b => (b.title || '').toLowerCase().includes(q) || (b.summary || '').toLowerCase().includes(q));
    }
    const sorted = [...r];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'rating_desc': return (b.rating || 0) - (a.rating || 0);
        case 'rating_asc':  return (a.rating || 0) - (b.rating || 0);
        case 'age_desc':    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'age_asc':     return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
    });
    return sorted;
  }, [briefs, search, sort]);

  useEffect(() => { setFocusIdx(i => Math.min(i, Math.max(0, filtered.length - 1))); }, [filtered.length]);

  // ── actions ──
  const handleCreateShort = useCallback(async (id: number, advance = false) => {
    if (creating) return;
    setCreating(true);
    const currentIdx = filtered.findIndex(b => b.id === id);
    const next = advance ? (filtered[currentIdx + 1] || filtered[currentIdx - 1] || null) : null;
    try {
      await scriptEngineApi.createShortFromBrief(id);
      setBriefs(bs => tab === 'unreviewed' ? bs.filter(b => b.id !== id) : bs.map(b => b.id === id ? { ...b, human_status: 'created' } : b));
      loadCounts();
      push({
        kind: 'info',
        message: 'Short created.',
        actionLabel: 'View',
        onAction: () => navigate('/'),
      });
      if (next) setSelected(null);
      else if (selected?.id === id) setSelected((s: any) => s ? { ...s, human_status: 'created' } : s);
      if (advance && next) loadDetail(next.id);
    } catch {
      push({ kind: 'error', message: 'Failed to create Short' });
    } finally {
      setCreating(false);
    }
  }, [creating, filtered, tab, selected, loadCounts, loadDetail, navigate, push]);

  const handleMark = useCallback(async (id: number, status: 'created' | 'skipped' | null, advance = false) => {
    const existing = briefs.find(b => b.id === id) || (selected?.id === id ? selected : null);
    if (!existing) return;
    const prior: 'created' | 'skipped' | null = existing.human_status || null;
    const currentIdx = filtered.findIndex(b => b.id === id);
    const next = advance ? (filtered[currentIdx + 1] || filtered[currentIdx - 1] || null) : null;

    try {
      await scriptEngineApi.markBrief(id, status);
      const staysInTab =
        (tab === 'unreviewed' && status === null) ||
        (tab === 'created' && status === 'created') ||
        (tab === 'skipped' && status === 'skipped');
      if (staysInTab) setBriefs(bs => bs.map(b => b.id === id ? { ...b, human_status: status } : b));
      else setBriefs(bs => bs.filter(b => b.id !== id));
      loadCounts();

      const label = status === 'created' ? 'Created' : status === 'skipped' ? 'Skipped' : 'Unmarked';
      push({
        kind: 'info',
        message: `Marked as ${label}.`,
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            await scriptEngineApi.markBrief(id, prior);
            loadBriefs();
            loadCounts();
          } catch { push({ kind: 'error', message: 'Undo failed' }); }
        },
      });

      if (advance && next) loadDetail(next.id);
      else if (selected?.id === id) setSelected((s: any) => s ? { ...s, human_status: status } : s);
    } catch {
      push({ kind: 'error', message: 'Failed to mark brief' });
    }
  }, [briefs, selected, tab, filtered, loadCounts, loadBriefs, loadDetail, push]);

  // ── keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (showHelp && e.key === 'Escape') { setShowHelp(false); return; }
      if (e.key === '?') { e.preventDefault(); setShowHelp(s => !s); return; }
      if (selected) {
        if (e.key === 'Escape') { setSelected(null); return; }
        if (inInput) return;
        if (e.key === 'c') { e.preventDefault(); handleCreateShort(selected.id, true); return; }
        if (e.key === 's') { e.preventDefault(); handleMark(selected.id, 'skipped', true); return; }
        if (e.key === 'u') { e.preventDefault(); handleMark(selected.id, null, false); return; }
        return;
      }
      if (inInput && e.key !== 'Escape') return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(filtered.length - 1, i + 1)); return; }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx(i => Math.max(0, i - 1)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const b = filtered[focusIdx];
        if (b) loadDetail(b.id);
        return;
      }
      const focused = filtered[focusIdx];
      if (!focused) return;
      if (e.key === 'c') { e.preventDefault(); handleCreateShort(focused.id, true); }
      else if (e.key === 's') { e.preventDefault(); handleMark(focused.id, 'skipped', true); }
      else if (e.key === 'u') { e.preventDefault(); handleMark(focused.id, null, false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, filtered, focusIdx, showHelp, handleCreateShort, handleMark, loadDetail]);

  // scroll focused row into view
  useEffect(() => {
    const f = filtered[focusIdx];
    if (!f) return;
    rowRefs.current[f.id]?.scrollIntoView({ block: 'nearest' });
  }, [focusIdx, filtered]);

  // ── Render ──
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Loading...</div>
  </div>;

  // Detail view
  if (selected) {
    const pts: string[] = typeof selected.content_points === 'string'
      ? JSON.parse(selected.content_points)
      : (selected.content_points || []);
    return (
      <div style={{ fontVariantNumeric: 'tabular-nums', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setSelected(null)} style={{ fontSize: 10, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>&larr; Back</button>
          <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase',
            background: selected.verdict === 'rejected' ? 'color-mix(in srgb, var(--red) 15%, transparent)' : 'color-mix(in srgb, var(--green) 15%, transparent)',
            color: selected.verdict === 'rejected' ? 'var(--red)' : 'var(--green)',
          }}>{selected.verdict}</span>
          {selected.rating != null && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 4,
              background: `color-mix(in srgb, ${ratingColor(selected.rating)} 15%, transparent)`,
              color: ratingColor(selected.rating),
            }}>{selected.rating}/10</span>
          )}
          {selected.human_status && (
            <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase',
              background: 'color-mix(in srgb, var(--text-muted) 15%, transparent)', color: 'var(--text-secondary)',
            }}>{selected.human_status}</span>
          )}
          {selected.is_time_sensitive && (
            <span title="Time-sensitive — fast-tracked" style={{ fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase',
              background: 'color-mix(in srgb, var(--gold) 18%, transparent)', color: 'var(--gold)',
            }}>⚡ Fresh</span>
          )}
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {SRC[selected.source]?.full || selected.source} · {ago(selected.created_at)}
          </span>
          <div style={{ flex: 1 }} />
          <button disabled={creating} onClick={() => handleCreateShort(selected.id, false)} style={{
            padding: '5px 14px', background: 'color-mix(in srgb, var(--green) 18%, transparent)', color: 'var(--green)',
            border: '1px solid color-mix(in srgb, var(--green) 35%, transparent)', borderRadius: 4,
            fontSize: 11, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1,
          }}>{creating ? 'Creating…' : 'Create Short (c)'}</button>
          <button onClick={() => handleMark(selected.id, 'skipped', false)} style={{
            padding: '5px 14px', background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)',
            border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 4,
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>Skip (s)</button>
          {selected.human_status && (
            <button onClick={() => handleMark(selected.id, null, false)} style={{
              padding: '5px 12px', background: 'var(--bg-elevated)', color: 'var(--text-muted)',
              border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>Unmark (u)</button>
          )}
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 20, marginBottom: 10 }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 10px', lineHeight: 1.25 }}>
            {selected.title}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, borderLeft: '2px solid var(--gold)', paddingLeft: 12 }}>
            {selected.hook}
          </p>
          {selected.angle && (
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Angle:</strong> {selected.angle}
            </div>
          )}
          {pts.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Content points</div>
              {pts.map((pt, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 0', lineHeight: 1.5 }}>• {pt}</div>
              ))}
            </div>
          )}
          {(selected.why_surprising || selected.why_fits_km) && (
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
              {selected.why_surprising && (
                <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Why surprising</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selected.why_surprising}</div>
                </div>
              )}
              {selected.why_fits_km && (
                <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Why fits KM</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selected.why_fits_km}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {selected.summary && (
          <div style={{ padding: '12px 16px', background: 'color-mix(in srgb, var(--gold) 5%, var(--bg-base))', border: '1px solid var(--gold-border)', borderRadius: 6, marginBottom: 10, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {selected.summary}
          </div>
        )}

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Full brief</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <ReactMarkdown components={{
              code: ({ className, children }) => className ? <CodeBlock className={className}>{children}</CodeBlock> : <InlineCode>{children}</InlineCode>,
              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>{children}</a>,
              h1: ({ children }) => <h1 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '16px 0 8px' }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '10px 0 4px' }}>{children}</h3>,
            }}>{selected.full_brief || ''}</ReactMarkdown>
          </div>
        </div>

        {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  // List view
  const TabBtn = ({ t, label, count }: { t: Tab; label: string; count: number }) => (
    <button onClick={() => setTab(t)} style={{
      padding: '6px 14px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer',
      border: '1px solid', letterSpacing: '0.03em',
      borderColor: tab === t ? 'var(--gold)' : 'var(--border-default)',
      background: tab === t ? 'color-mix(in srgb, var(--gold) 12%, var(--bg-elevated))' : 'var(--bg-elevated)',
      color: tab === t ? 'var(--gold)' : 'var(--text-secondary)',
    }}>{label} <span style={{ marginLeft: 6, opacity: 0.7 }}>({count})</span></button>
  );

  return (
    <div style={{ fontVariantNumeric: 'tabular-nums', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>Backlog</h1>
        <button onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)" style={{
          width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--border-default)',
          background: 'var(--bg-elevated)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1,
        }}>?</button>
        <div style={{ flex: 1 }} />
        {refreshing && <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>refreshing…</span>}
        <button onClick={() => navigate('/critic')} title="View retired critic archive" style={{
          fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer',
          fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Archive &rarr;</button>
      </div>

      {/* Tabs + score distribution */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <TabBtn t="unreviewed" label="Unreviewed" count={counts.unreviewed} />
        <TabBtn t="created" label="Created" count={counts.created} />
        <TabBtn t="skipped" label="Skipped" count={counts.skipped} />
        {tab === 'unreviewed' && counts.unreviewed > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12, fontSize: 10, color: 'var(--text-muted)' }}>
            <span>avg <strong style={{ color: 'var(--text-secondary)' }}>{counts.avg_rating_unreviewed || '—'}/10</strong></span>
            <span style={{ color: 'var(--green)' }}>{counts.high_unreviewed} ≥8</span>
            <span style={{ color: 'var(--gold)' }}>{counts.mid_unreviewed} 6–7</span>
            <span style={{ color: 'var(--red)' }}>{counts.low_unreviewed} ≤5</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); (e.target as HTMLInputElement).blur(); } }}
          placeholder="Search title or summary (/)"
          style={{
            flex: '1 1 240px', minWidth: 200, padding: '5px 10px', fontSize: 11, color: 'var(--text-primary)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 4,
          }}
        />
        <select value={source} onChange={e => setSource(e.target.value)} style={{
          padding: '5px 8px', fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)', borderRadius: 4,
        }}>
          <option value="">All sources</option>
          {SOURCE_KEYS.map(k => <option key={k} value={k}>{SRC[k].full}</option>)}
        </select>
        <select value={minRating} onChange={e => setMinRating(parseInt(e.target.value, 10))} style={{
          padding: '5px 8px', fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)', borderRadius: 4,
        }}>
          <option value={0}>Any rating</option>
          {[5, 6, 7, 8, 9].map(r => <option key={r} value={r}>≥ {r}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)} style={{
          padding: '5px 8px', fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)', borderRadius: 4,
        }}>
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
        </select>
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {tab === 'unreviewed' ? 'No unreviewed briefs' : tab === 'created' ? 'No shorts created yet' : 'No skipped briefs'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {filtered.map((b, i) => {
            const isFocused = i === focusIdx;
            return (
              <div
                key={b.id}
                ref={el => (rowRefs.current[b.id] = el)}
                onClick={() => { setFocusIdx(i); loadDetail(b.id); }}
                onMouseEnter={() => setFocusIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer',
                  borderRadius: 5, background: isFocused ? 'color-mix(in srgb, var(--gold) 8%, var(--bg-elevated))' : 'var(--bg-elevated)',
                  border: `1px solid ${isFocused ? 'var(--gold-border)' : 'var(--border-subtle)'}`,
                }}
              >
                <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 28, flexShrink: 0 }}>#{b.id}</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, width: 44, textAlign: 'center', flexShrink: 0,
                  background: b.rating != null ? `color-mix(in srgb, ${ratingColor(b.rating)} 18%, transparent)` : 'var(--bg-base)',
                  color: ratingColor(b.rating),
                }}>{b.rating != null ? `${b.rating}/10` : '—'}</span>
                <span style={{ fontSize: 8, color: 'var(--gold)', fontWeight: 700, width: 54, flexShrink: 0 }}>
                  {SRC[b.source]?.short || b.source}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.title}
                </span>
                {b.is_time_sensitive && <span title="Time-sensitive" style={{ fontSize: 10, color: 'var(--gold)', flexShrink: 0 }}>⚡</span>}
                {b.verdict === 'rejected' && (
                  <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)', textTransform: 'uppercase' }}>rejected</span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); handleCreateShort(b.id, false); }}
                  disabled={creating || b.human_status === 'created'}
                  style={{
                    fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 3,
                    border: '1px solid var(--gold-border)',
                    background: b.human_status === 'created' ? 'var(--bg-base)' : 'transparent',
                    color: b.human_status === 'created' ? 'var(--text-muted)' : 'var(--gold)',
                    cursor: (creating || b.human_status === 'created') ? 'default' : 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
                  }}
                >{b.human_status === 'created' ? 'Created' : 'Create'}</button>
                {tab !== 'skipped' && b.human_status !== 'created' && (
                  <button
                    onClick={e => { e.stopPropagation(); handleMark(b.id, 'skipped', false); }}
                    style={{
                      fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 3,
                      border: '1px solid var(--border-default)', background: 'transparent',
                      color: 'var(--text-muted)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
                    }}
                  >Skip</button>
                )}
                {(tab === 'created' || tab === 'skipped') && (
                  <button
                    onClick={e => { e.stopPropagation(); handleMark(b.id, null, false); }}
                    style={{
                      fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 3,
                      border: '1px solid var(--border-default)', background: 'transparent',
                      color: 'var(--text-muted)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
                    }}
                  >Unmark</button>
                )}
                <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0, width: 32, textAlign: 'right' }}>{ago(b.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
