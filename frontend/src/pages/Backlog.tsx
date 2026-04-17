import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { scriptEngineApi } from '../services/api';
import ScriptEngine from './ScriptEngine';

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

const DEFAULT_COUNTS = { unreviewed: 0, starred: 0, created: 0, skipped: 0, total: 0,
  avg_rating_unreviewed: 0, high_unreviewed: 0, mid_unreviewed: 0, low_unreviewed: 0 };

type Tab = 'unreviewed' | 'starred' | 'created' | 'skipped';
type HumanStatus = 'created' | 'skipped' | 'starred' | null;
type SortKey = 'rating_desc' | 'rating_asc' | 'age_desc' | 'age_asc';
const SORT_LABELS: Record<SortKey, string> = {
  rating_desc: 'Rating ↓', rating_asc: 'Rating ↑', age_desc: 'Newest', age_asc: 'Oldest',
};

// Canonical angles from style-guide/editorial-standards.md. Older ideas may have
// free-form angles so we treat these as soft filters (select shows canonical +
// "Other").
const ANGLES = [
  'myth-bust',
  'hidden-cost',
  'timeline-absurd',
  'dev-intent',
  'mechanic-combo',
  'how-to-weird',
  'speedrun-trick',
  'community-wants',
  'other',
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ago = (d: string) => {
  if (!d) return '—';
  const x = !d.includes('Z') && !d.includes('+') && !d.includes('T') ? new Date(d + 'Z') : new Date(d);
  const m = Math.floor((Date.now() - x.getTime()) / 60000);
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
};
const ratingColor = (r: number | null) => r == null ? 'var(--text-muted)'
  : r >= 8 ? 'var(--green)' : r >= 6 ? 'var(--gold)' : 'var(--red)';

// ─── Responsive hook ──────────────────────────────────────────────────────────
function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px)');
    const h = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return narrow;
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
    ['j / ↓', 'Next brief (auto-preview on desktop)'],
    ['k / ↑', 'Previous brief'],
    ['Enter', 'Open full detail'],
    ['Esc', 'Close detail / clear selection'],
    ['c', 'Create Short (and advance)'],
    ['t', 'Star / save for later (and advance)'],
    ['s', 'Skip (and advance)'],
    ['u', 'Unmark (back to Unreviewed)'],
    ['Shift+click', 'Range-select rows for bulk action'],
    ['⌘/Ctrl+click', 'Toggle row in selection'],
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

// ─── Detail pane content ─────────────────────────────────────────────────────
// Reused between desktop split-pane preview and mobile full-screen detail.
function BriefDetail({
  brief, creating, onCreate, onStar, onSkip, onUnmark, onClose, showClose,
}: {
  brief: any;
  creating: boolean;
  onCreate: () => void;
  onStar: () => void;
  onSkip: () => void;
  onUnmark: () => void;
  onClose?: () => void;
  showClose?: boolean;
}) {
  const pts: string[] = typeof brief.content_points === 'string'
    ? JSON.parse(brief.content_points)
    : (brief.content_points || []);

  return (
    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
      {/* Action bar (sticky at top of pane) */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-base)',
        padding: '0 0 10px', marginBottom: 10, borderBottom: '1px solid var(--border-default)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {showClose && onClose && (
            <button onClick={onClose} style={{ fontSize: 10, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>&larr; Back</button>
          )}
          <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase',
            background: brief.verdict === 'rejected' ? 'color-mix(in srgb, var(--red) 15%, transparent)' : 'color-mix(in srgb, var(--green) 15%, transparent)',
            color: brief.verdict === 'rejected' ? 'var(--red)' : 'var(--green)',
          }}>{brief.verdict}</span>
          {brief.rating != null && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 4,
              background: `color-mix(in srgb, ${ratingColor(brief.rating)} 15%, transparent)`,
              color: ratingColor(brief.rating),
            }}>{brief.rating}/10</span>
          )}
          {brief.human_status && (
            <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase',
              background: 'color-mix(in srgb, var(--text-muted) 15%, transparent)', color: 'var(--text-secondary)',
            }}>{brief.human_status}</span>
          )}
          {brief.is_time_sensitive && (
            <span title="Time-sensitive" style={{ fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase',
              background: 'color-mix(in srgb, var(--gold) 18%, transparent)', color: 'var(--gold)',
            }}>⚡ Fresh</span>
          )}
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {SRC[brief.source]?.full || brief.source} · {ago(brief.created_at)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button disabled={creating || brief.human_status === 'created'} onClick={onCreate} style={{
            flex: '1 1 auto', minWidth: 130, padding: '8px 14px',
            background: brief.human_status === 'created' ? 'var(--bg-elevated)' : 'color-mix(in srgb, var(--green) 18%, transparent)',
            color: brief.human_status === 'created' ? 'var(--text-muted)' : 'var(--green)',
            border: `1px solid ${brief.human_status === 'created' ? 'var(--border-default)' : 'color-mix(in srgb, var(--green) 35%, transparent)'}`,
            borderRadius: 4, fontSize: 12, fontWeight: 700,
            cursor: (creating || brief.human_status === 'created') ? 'default' : 'pointer',
            opacity: creating ? 0.6 : 1, touchAction: 'manipulation',
          }}>{brief.human_status === 'created' ? '✓ Short Created' : creating ? 'Creating…' : 'Create Short (c)'}</button>
          {brief.human_status !== 'starred' && brief.human_status !== 'created' && (
            <button onClick={onStar} style={{
              padding: '8px 12px', background: 'color-mix(in srgb, var(--gold) 10%, transparent)', color: 'var(--gold)',
              border: '1px solid var(--gold-border)', borderRadius: 4,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
            }}>★ Star (t)</button>
          )}
          {brief.human_status !== 'skipped' && brief.human_status !== 'created' && (
            <button onClick={onSkip} style={{
              padding: '8px 14px', background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)',
              border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 4,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
            }}>Skip (s)</button>
          )}
          {brief.human_status && (
            <button onClick={onUnmark} style={{
              padding: '8px 14px', background: 'var(--bg-elevated)', color: 'var(--text-muted)',
              border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation',
            }}>Unmark (u)</button>
          )}
        </div>
      </div>

      {/* Idea card */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16, marginBottom: 10 }}>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 10px', lineHeight: 1.25 }}>
          {brief.title}
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, borderLeft: '2px solid var(--gold)', paddingLeft: 12 }}>
          {brief.hook}
        </p>
        {brief.angle && (
          <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Angle:</strong> {brief.angle}
          </div>
        )}
        {pts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Content points</div>
            {pts.map((pt, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 0', lineHeight: 1.5 }}>• {pt}</div>
            ))}
          </div>
        )}
        {(brief.why_surprising || brief.why_fits_km) && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {brief.why_surprising && (
              <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Why surprising</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{brief.why_surprising}</div>
              </div>
            )}
            {brief.why_fits_km && (
              <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Why fits KM</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{brief.why_fits_km}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary (always visible, no scroll needed to find it) */}
      {brief.summary && (
        <div style={{ padding: '12px 16px', background: 'color-mix(in srgb, var(--gold) 5%, var(--bg-base))', border: '1px solid var(--gold-border)', borderRadius: 6, marginBottom: 10, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {brief.summary}
        </div>
      )}

      {/* Full brief */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Full brief</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, wordBreak: 'break-word' }}>
          <ReactMarkdown components={{
            code: ({ className, children }) => className ? <CodeBlock className={className}>{children}</CodeBlock> : <InlineCode>{children}</InlineCode>,
            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>{children}</a>,
            h1: ({ children }) => <h1 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '14px 0 6px' }}>{children}</h1>,
            h2: ({ children }) => <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</h2>,
            h3: ({ children }) => <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', margin: '10px 0 4px' }}>{children}</h3>,
          }}>{brief.full_brief || ''}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

// ─── Top-level view switcher ──────────────────────────────────────────────────
type TopView = 'backlog' | 'pipeline';

// ─── Main component ───────────────────────────────────────────────────────────
export default function Backlog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const topView: TopView = (searchParams.get('view') as TopView) === 'pipeline' ? 'pipeline' : 'backlog';
  const setTopView = (v: TopView) => {
    const p = new URLSearchParams(searchParams);
    if (v === 'backlog') p.delete('view'); else p.set('view', v);
    setSearchParams(p, { replace: true });
  };
  const isNarrow = useIsNarrow();
  const { toasts, push, dismiss } = useToasts();

  const [briefs, setBriefs] = useState<any[]>([]);
  const [counts, setCounts] = useState(DEFAULT_COUNTS);
  const [selected, setSelected] = useState<any>(null); // full-screen detail (mobile)
  const [preview, setPreview] = useState<any>(null);   // right-pane preview (desktop)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<Tab>('unreviewed');
  const [source, setSource] = useState('');
  const [angle, setAngle] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<SortKey>('rating_desc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [focusIdx, setFocusIdx] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  // Multi-select for bulk actions. selected brief IDs + last-selected idx (anchor for shift-click).
  const [multiSelect, setMultiSelect] = useState<Set<number>>(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const previewDebounceRef = useRef<number | undefined>(undefined);

  // ── loaders ──
  const loadBriefs = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true); else setRefreshing(true);
      const data = await scriptEngineApi.getBriefs({
        human_status: tab,
        source: source || undefined,
        angle: angle || undefined,
        min_rating: minRating || undefined,
        q: debouncedSearch || undefined,
      });
      setBriefs(data);
    } catch {
      push({ kind: 'error', message: 'Failed to load briefs' });
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [tab, source, angle, minRating, debouncedSearch, push]);

  const loadCounts = useCallback(async () => {
    try { setCounts(await scriptEngineApi.getBriefCounts()); } catch { /* non-fatal */ }
  }, []);

  const loadFull = useCallback(async (id: number): Promise<any | null> => {
    try { return await scriptEngineApi.getBrief(id); }
    catch { push({ kind: 'error', message: 'Failed to load brief' }); return null; }
  }, [push]);

  useEffect(() => {
    loadBriefs(briefs.length === 0);
    loadCounts();
    // Clear any stale multi-selection when the filter changes
    setMultiSelect(new Set());
    setLastSelectedIdx(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, source, angle, minRating, debouncedSearch]);

  // Debounce the search input — send to server 250ms after last keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // ── derived ──
  // Server handles tab/source/angle/rating/q filtering now. Only sort locally.
  const filtered = useMemo(() => {
    const sorted = [...briefs];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'rating_desc': return (b.rating || 0) - (a.rating || 0);
        case 'rating_asc':  return (a.rating || 0) - (b.rating || 0);
        case 'age_desc':    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'age_asc':     return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
    });
    return sorted;
  }, [briefs, sort]);

  useEffect(() => { setFocusIdx(i => Math.min(i, Math.max(0, filtered.length - 1))); }, [filtered.length]);

  // ── desktop auto-preview on focus change (debounced) ──
  useEffect(() => {
    if (isNarrow) return; // mobile: don't auto-fetch; only tap loads detail
    const focused = filtered[focusIdx];
    if (!focused) { setPreview(null); return; }
    // Keep a "lite" preview up immediately using the already-loaded list row,
    // while the full brief fetches in the background.
    setPreview((prev: any) => (prev?.id === focused.id ? prev : { ...focused, full_brief: prev?.id === focused.id ? prev.full_brief : '' }));
    window.clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = window.setTimeout(async () => {
      const full = await loadFull(focused.id);
      if (full) setPreview((prev: any) => (prev && prev.id === full.id ? full : prev));
    }, 180);
    return () => window.clearTimeout(previewDebounceRef.current);
  }, [focusIdx, filtered, isNarrow, loadFull]);

  // ── actions ──
  const handleCreateShort = useCallback(async (id: number, advance = false) => {
    if (creating) return;
    setCreating(true);
    const currentIdx = filtered.findIndex(b => b.id === id);
    const removedFromList = tab === 'unreviewed' || tab === 'starred' || tab === 'skipped';
    try {
      await scriptEngineApi.createShortFromBrief(id);
      setBriefs(bs => removedFromList
        ? bs.filter(b => b.id !== id)
        : bs.map(b => b.id === id ? { ...b, human_status: 'created' } : b));
      loadCounts();
      push({
        kind: 'info',
        message: 'Short created.',
        actionLabel: 'View',
        onAction: () => navigate('/'),
      });
      if (advance && isNarrow) setSelected(null);
      else if (selected?.id === id) setSelected((s: any) => s ? { ...s, human_status: 'created' } : s);
      if (preview?.id === id) setPreview((p: any) => p ? { ...p, human_status: 'created' } : p);
      if (advance && !isNarrow) {
        if (removedFromList) {
          setFocusIdx(Math.min(currentIdx, Math.max(0, filtered.length - 2)));
        } else {
          setFocusIdx(Math.min(currentIdx + 1, Math.max(0, filtered.length - 1)));
        }
      }
    } catch {
      push({ kind: 'error', message: 'Failed to create Short' });
    } finally {
      setCreating(false);
    }
  }, [creating, filtered, tab, selected, preview, isNarrow, loadCounts, navigate, push]);

  const handleMark = useCallback(async (id: number, status: HumanStatus, advance = false) => {
    const existing = briefs.find(b => b.id === id) || (selected?.id === id ? selected : null) || (preview?.id === id ? preview : null);
    if (!existing) return;
    const prior: HumanStatus = existing.human_status || null;
    const currentIdx = filtered.findIndex(b => b.id === id);
    const next = advance ? (filtered[currentIdx + 1] || filtered[currentIdx - 1] || null) : null;

    try {
      await scriptEngineApi.markBrief(id, status);
      const staysInTab =
        (tab === 'unreviewed' && status === null) ||
        (tab === 'created' && status === 'created') ||
        (tab === 'skipped' && status === 'skipped') ||
        (tab === 'starred' && status === 'starred');
      if (staysInTab) setBriefs(bs => bs.map(b => b.id === id ? { ...b, human_status: status } : b));
      else setBriefs(bs => bs.filter(b => b.id !== id));
      loadCounts();

      const label = status === 'created' ? 'Created' : status === 'skipped' ? 'Skipped' : status === 'starred' ? 'Starred' : 'Unmarked';
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

      if (advance && next && isNarrow) setSelected(null);
      else if (selected?.id === id) setSelected((s: any) => s ? { ...s, human_status: status } : s);
      if (preview?.id === id) setPreview((p: any) => p ? { ...p, human_status: status } : p);
      // advance focus on desktop so the preview follows.
      // When the brief leaves the current tab (e.g. starring from Unreviewed),
      // the next item slides INTO currentIdx — stay there. When it stays in
      // the tab (starring a starred brief), move to currentIdx + 1.
      if (advance && !isNarrow) {
        if (staysInTab) {
          setFocusIdx(Math.min(currentIdx + 1, Math.max(0, filtered.length - 1)));
        } else {
          setFocusIdx(Math.min(currentIdx, Math.max(0, filtered.length - 2)));
        }
      }
    } catch {
      push({ kind: 'error', message: 'Failed to mark brief' });
    }
  }, [briefs, selected, preview, tab, filtered, isNarrow, loadCounts, loadBriefs, push]);

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
        if (e.key === 't') { e.preventDefault(); handleMark(selected.id, 'starred', true); return; }
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
        if (!b) return;
        // Desktop: Enter opens full-screen detail (replaces split-pane).
        // Mobile: Enter opens the detail page.
        loadFull(b.id).then(full => { if (full) setSelected(full); });
        return;
      }
      const focused = filtered[focusIdx];
      if (!focused) return;
      if (e.key === 'c') { e.preventDefault(); handleCreateShort(focused.id, true); }
      else if (e.key === 't') { e.preventDefault(); handleMark(focused.id, 'starred', true); }
      else if (e.key === 's') { e.preventDefault(); handleMark(focused.id, 'skipped', true); }
      else if (e.key === 'u') { e.preventDefault(); handleMark(focused.id, null, false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, filtered, focusIdx, showHelp, handleCreateShort, handleMark, loadFull]);

  // scroll focused row into view
  useEffect(() => {
    const f = filtered[focusIdx];
    if (!f) return;
    rowRefs.current[f.id]?.scrollIntoView({ block: 'nearest' });
  }, [focusIdx, filtered]);

  const handleRowTap = useCallback((b: any, i: number, ev?: React.MouseEvent) => {
    // Shift+click → range-select from lastSelectedIdx to i (no preview change).
    if (ev?.shiftKey && lastSelectedIdx !== null) {
      ev.preventDefault();
      const lo = Math.min(lastSelectedIdx, i);
      const hi = Math.max(lastSelectedIdx, i);
      setMultiSelect(prev => {
        const next = new Set(prev);
        for (let k = lo; k <= hi; k++) {
          const row = filtered[k];
          if (row) next.add(row.id);
        }
        return next;
      });
      return;
    }
    // Cmd/Ctrl+click → toggle single selection (no preview change).
    if (ev?.metaKey || ev?.ctrlKey) {
      ev.preventDefault();
      setMultiSelect(prev => {
        const next = new Set(prev);
        if (next.has(b.id)) next.delete(b.id); else next.add(b.id);
        return next;
      });
      setLastSelectedIdx(i);
      return;
    }
    // Plain click → preview + clear any multi-selection.
    setMultiSelect(new Set());
    setLastSelectedIdx(i);
    setFocusIdx(i);
    if (isNarrow) {
      loadFull(b.id).then(full => { if (full) setSelected(full); });
    }
    // Desktop: preview auto-updates via focusIdx effect
  }, [filtered, lastSelectedIdx, isNarrow, loadFull]);

  // Bulk apply — sequential to keep the Prefect-free backend simple; fine for <50 rows.
  const handleBulkMark = useCallback(async (status: HumanStatus) => {
    if (bulkBusy || multiSelect.size === 0) return;
    setBulkBusy(true);
    const ids = [...multiSelect];
    try {
      for (const id of ids) {
        try { await scriptEngineApi.markBrief(id, status); }
        catch (e) { /* keep going; surface at end */ }
      }
      const staysInTab =
        (tab === 'unreviewed' && status === null) ||
        (tab === 'created' && status === 'created') ||
        (tab === 'skipped' && status === 'skipped') ||
        (tab === 'starred' && status === 'starred');
      setBriefs(bs => staysInTab
        ? bs.map(b => multiSelect.has(b.id) ? { ...b, human_status: status } : b)
        : bs.filter(b => !multiSelect.has(b.id)));
      setMultiSelect(new Set());
      loadCounts();
      const label = status === 'starred' ? 'starred' : status === 'skipped' ? 'skipped' : status === null ? 'unmarked' : String(status);
      push({ kind: 'info', message: `${ids.length} briefs ${label}` });
    } finally {
      setBulkBusy(false);
    }
  }, [bulkBusy, multiSelect, tab, loadCounts, push]);

  // ── Top-level view switcher (rendered on both sub-views so the user can flip back) ──
  const TopViewSwitcher = () => (
    <div style={{ display: 'flex', gap: 2, marginBottom: 12, borderBottom: '1px solid var(--border-default)' }}>
      {([
        ['backlog', 'Backlog'],
        ['pipeline', 'Pipeline'],
      ] as [TopView, string][]).map(([v, label]) => (
        <button
          key={v}
          onClick={() => setTopView(v)}
          style={{
            padding: '8px 18px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: 'transparent', border: 'none',
            borderBottom: `2px solid ${topView === v ? 'var(--gold)' : 'transparent'}`,
            color: topView === v ? 'var(--gold)' : 'var(--text-muted)',
            marginBottom: -1, letterSpacing: '0.04em',
          }}
        >{label}</button>
      ))}
    </div>
  );

  // Pipeline sub-view: embed the existing ScriptEngine dashboard
  if (topView === 'pipeline') {
    return (
      <div style={{ width: '100%' }}>
        <TopViewSwitcher />
        <ScriptEngine />
      </div>
    );
  }

  // ── Render ──
  if (loading) return (
    <div style={{ width: '100%' }}>
      <TopViewSwitcher />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Loading...</div>
      </div>
    </div>
  );

  // Full-screen detail (mobile, or explicit Enter on desktop)
  if (selected) {
    return (
      <div style={{ width: '100%' }}>
        <TopViewSwitcher />
        <BriefDetail
          brief={selected}
          creating={creating}
          onCreate={() => handleCreateShort(selected.id, false)}
          onStar={() => handleMark(selected.id, 'starred', false)}
          onSkip={() => handleMark(selected.id, 'skipped', false)}
          onUnmark={() => handleMark(selected.id, null, false)}
          onClose={() => setSelected(null)}
          showClose
        />
        {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  // List view (with optional right-pane preview on desktop)
  const TabBtn = ({ t, label, count }: { t: Tab; label: string; count: number }) => (
    <button onClick={() => setTab(t)} style={{
      padding: isNarrow ? '8px 14px' : '6px 14px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer',
      border: '1px solid', letterSpacing: '0.03em', touchAction: 'manipulation',
      borderColor: tab === t ? 'var(--gold)' : 'var(--border-default)',
      background: tab === t ? 'color-mix(in srgb, var(--gold) 12%, var(--bg-elevated))' : 'var(--bg-elevated)',
      color: tab === t ? 'var(--gold)' : 'var(--text-secondary)',
    }}>{label} <span style={{ marginLeft: 6, opacity: 0.7 }}>({count})</span></button>
  );

  return (
    <div style={{ fontVariantNumeric: 'tabular-nums', width: '100%' }}>
      <TopViewSwitcher />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>Backlog</h1>
        {!isNarrow && (
          <button onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)" style={{
            width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1,
          }}>?</button>
        )}
        <div style={{ flex: 1 }} />
        {refreshing && <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>refreshing…</span>}
        <button onClick={() => navigate('/critic')} title="View retired critic archive" style={{
          fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer',
          fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Archive &rarr;</button>
      </div>

      {/* Tabs + distribution */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <TabBtn t="unreviewed" label="Unreviewed" count={counts.unreviewed} />
        <TabBtn t="starred" label="★ Starred" count={counts.starred} />
        <TabBtn t="created" label="Created" count={counts.created} />
        <TabBtn t="skipped" label="Skipped" count={counts.skipped} />
        {!isNarrow && tab === 'unreviewed' && counts.unreviewed > 0 && (
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
          placeholder={isNarrow ? 'Search' : 'Search title or summary (/)'}
          style={{
            flex: '1 1 200px', minWidth: 140, padding: isNarrow ? '8px 10px' : '5px 10px',
            fontSize: isNarrow ? 13 : 11, color: 'var(--text-primary)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 4,
          }}
        />
        <select value={source} onChange={e => setSource(e.target.value)} style={{
          padding: isNarrow ? '8px 8px' : '5px 8px', fontSize: isNarrow ? 12 : 10,
          color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)', borderRadius: 4,
        }}>
          <option value="">All sources</option>
          {SOURCE_KEYS.map(k => <option key={k} value={k}>{SRC[k].full}</option>)}
        </select>
        <select value={angle} onChange={e => setAngle(e.target.value)} style={{
          padding: isNarrow ? '8px 8px' : '5px 8px', fontSize: isNarrow ? 12 : 10,
          color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)', borderRadius: 4,
        }}>
          <option value="">All angles</option>
          {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={minRating} onChange={e => setMinRating(parseInt(e.target.value, 10))} style={{
          padding: isNarrow ? '8px 8px' : '5px 8px', fontSize: isNarrow ? 12 : 10,
          color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)', borderRadius: 4,
        }}>
          <option value={0}>Any rating</option>
          {[5, 6, 7, 8, 9].map(r => <option key={r} value={r}>≥ {r}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)} style={{
          padding: isNarrow ? '8px 8px' : '5px 8px', fontSize: isNarrow ? 12 : 10,
          color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)', borderRadius: 4,
        }}>
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
        </select>
      </div>

      {/* Split pane: list + preview (desktop) or list-only (mobile) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? '1fr' : 'minmax(360px, 1fr) minmax(420px, 1fr)',
        gap: isNarrow ? 0 : 14,
        alignItems: 'start',
      }}>
        {/* List */}
        <div style={{ minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {tab === 'unreviewed' ? 'No unreviewed briefs'
                : tab === 'starred' ? 'No starred briefs — press t on a brief to save for later'
                : tab === 'created' ? 'No shorts created yet'
                : 'No skipped briefs'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {filtered.map((b, i) => {
                const isFocused = i === focusIdx;
                return (
                  <div
                    key={b.id}
                    ref={el => (rowRefs.current[b.id] = el)}
                    onClick={(e) => handleRowTap(b, i, e)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: isNarrow ? '10px 10px' : '7px 10px', cursor: 'pointer',
                      borderRadius: 5,
                      background: isFocused ? 'color-mix(in srgb, var(--gold) 8%, var(--bg-elevated))' : 'var(--bg-elevated)',
                      border: `1px solid ${isFocused ? 'var(--gold-border)' : 'var(--border-subtle)'}`,
                      touchAction: 'manipulation',
                      minHeight: isNarrow ? 52 : 'auto',
                    }}
                  >
                    <span style={{
                      fontSize: isNarrow ? 11 : 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                      width: isNarrow ? 48 : 44, textAlign: 'center', flexShrink: 0,
                      background: b.rating != null ? `color-mix(in srgb, ${ratingColor(b.rating)} 18%, transparent)` : 'var(--bg-base)',
                      color: ratingColor(b.rating),
                    }}>{b.rating != null ? `${b.rating}/10` : '—'}</span>
                    <span style={{ fontSize: isNarrow ? 9 : 8, color: 'var(--gold)', fontWeight: 700, width: isNarrow ? 52 : 54, flexShrink: 0 }}>
                      {SRC[b.source]?.short || b.source}
                    </span>
                    <span style={{ fontSize: isNarrow ? 13 : 11, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                      {b.title}
                    </span>
                    {b.human_status === 'starred' && <span title="Starred — saved for later" style={{ fontSize: isNarrow ? 13 : 11, color: 'var(--gold)', flexShrink: 0 }}>★</span>}
                    {b.is_time_sensitive && <span title="Time-sensitive" style={{ fontSize: isNarrow ? 12 : 10, color: 'var(--gold)', flexShrink: 0 }}>⚡</span>}
                    {b.verdict === 'rejected' && (
                      <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)', textTransform: 'uppercase' }}>rejected</span>
                    )}
                    {/* Inline actions only shown on desktop — mobile users act from the detail page */}
                    {!isNarrow && (
                      <>
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
                        {b.human_status !== 'starred' && b.human_status !== 'created' && (
                          <button
                            onClick={e => { e.stopPropagation(); handleMark(b.id, 'starred', false); }}
                            title="Star — save for later"
                            style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 3,
                              border: '1px solid var(--border-default)', background: 'transparent',
                              color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, lineHeight: 1,
                            }}
                          >★</button>
                        )}
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
                        {(tab === 'starred' || tab === 'created' || tab === 'skipped') && (
                          <button
                            onClick={e => { e.stopPropagation(); handleMark(b.id, null, false); }}
                            style={{
                              fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 3,
                              border: '1px solid var(--border-default)', background: 'transparent',
                              color: 'var(--text-muted)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
                            }}
                          >Unmark</button>
                        )}
                      </>
                    )}
                    <span style={{ fontSize: isNarrow ? 10 : 8, color: 'var(--text-muted)', flexShrink: 0, width: isNarrow ? 36 : 32, textAlign: 'right' }}>{ago(b.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right-pane preview (desktop only) */}
        {!isNarrow && (
          <div style={{
            position: 'sticky', top: 10, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
            paddingLeft: 4,
          }}>
            {preview ? (
              <BriefDetail
                brief={preview}
                creating={creating}
                onCreate={() => handleCreateShort(preview.id, true)}
                onStar={() => handleMark(preview.id, 'starred', true)}
                onSkip={() => handleMark(preview.id, 'skipped', true)}
                onUnmark={() => handleMark(preview.id, null, false)}
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Focus a brief with j/k or click a row
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar — shown when 2+ rows are multi-selected */}
      {multiSelect.size >= 2 && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-elevated)', border: '1px solid var(--gold-border)',
          borderRadius: 8, padding: '10px 16px', zIndex: 90,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>
            {multiSelect.size} selected
          </span>
          <button disabled={bulkBusy} onClick={() => handleBulkMark('starred')} style={{
            padding: '6px 12px', background: 'color-mix(in srgb, var(--gold) 12%, transparent)', color: 'var(--gold)',
            border: '1px solid var(--gold-border)', borderRadius: 4, fontSize: 11, fontWeight: 700,
            cursor: bulkBusy ? 'wait' : 'pointer', opacity: bulkBusy ? 0.6 : 1,
          }}>★ Star {multiSelect.size}</button>
          <button disabled={bulkBusy} onClick={() => handleBulkMark('skipped')} style={{
            padding: '6px 12px', background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)',
            border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: 4,
            fontSize: 11, fontWeight: 700, cursor: bulkBusy ? 'wait' : 'pointer', opacity: bulkBusy ? 0.6 : 1,
          }}>Skip {multiSelect.size}</button>
          {(tab === 'starred' || tab === 'skipped' || tab === 'created') && (
            <button disabled={bulkBusy} onClick={() => handleBulkMark(null)} style={{
              padding: '6px 12px', background: 'var(--bg-base)', color: 'var(--text-muted)',
              border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 11, fontWeight: 700,
              cursor: bulkBusy ? 'wait' : 'pointer', opacity: bulkBusy ? 0.6 : 1,
            }}>Unmark {multiSelect.size}</button>
          )}
          <button onClick={() => setMultiSelect(new Set())} title="Clear selection" style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: '0 4px',
          }}>×</button>
        </div>
      )}

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
