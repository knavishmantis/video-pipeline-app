import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { scriptEngineApi } from '../services/api';

// Shared code block renderer for ReactMarkdown
function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const match = /language-(\w+)/.exec(className || '');
  const codeStr = String(children).replace(/\n$/, '');
  if (match) {
    return (
      <SyntaxHighlighter
        style={oneDark}
        language={match[1]}
        PreTag="div"
        customStyle={{
          margin: '10px 0',
          borderRadius: '8px',
          fontSize: '11px',
          lineHeight: 1.55,
          border: '1px solid var(--border-default)',
        }}
      >
        {codeStr}
      </SyntaxHighlighter>
    );
  }
  // Fenced block without a language tag
  return (
    <pre style={{
      background: '#282c34',
      padding: '14px 16px',
      borderRadius: '8px',
      overflow: 'auto',
      fontSize: '11px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      lineHeight: 1.55,
      border: '1px solid var(--border-default)',
      margin: '10px 0',
      color: '#abb2bf',
    }}>
      <code style={{ fontFamily: 'inherit' }}>{children}</code>
    </pre>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      background: 'var(--bg-base)',
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '11px',
      color: 'var(--gold)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      border: '1px solid var(--border-subtle)',
    }}>
      {children}
    </code>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SRC: Record<string, { short: string; full: string }> = {
  code:      { short: 'CODE', full: 'Code' },
  youtube:   { short: 'YT',   full: 'YouTube' },
  reddit:    { short: 'RDT',  full: 'Reddit' },
  bugs:      { short: 'BUGS', full: 'Bugs' },
  mods:      { short: 'MODS', full: 'Mods' },
  wiki:      { short: 'WIKI', full: 'Wiki' },
  minecraft: { short: 'MC',   full: 'Minecraft' },
};
const SOURCE_KEYS = Object.keys(SRC);
const DIMS = ['hook', 'pivot', 'pacing', 'density', 'voice', 'ending', 'accuracy', 'competitive'] as const;
const DEFAULT_COUNTS = { unmarked: 0, used: 0, not_used: 0, total: 0, avg_score_unmarked: 0, high_unmarked: 0, mid_unmarked: 0, low_unmarked: 0 };
type SortKey = 'score_desc' | 'score_asc' | 'age_desc' | 'age_asc' | 'words_desc' | 'words_asc';
const SORT_LABELS: Record<SortKey, string> = {
  score_desc: 'Score ↓',
  score_asc:  'Score ↑',
  age_desc:   'Newest',
  age_asc:    'Oldest',
  words_desc: 'Words ↓',
  words_asc:  'Words ↑',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ago = (d: string) => {
  if (!d) return '—';
  const x = !d.includes('Z') && !d.includes('+') && !d.includes('T') ? new Date(d + 'Z') : new Date(d);
  const m = Math.floor((Date.now() - x.getTime()) / 60000);
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
};
const scoreColor = (s: number) => s >= 8 ? 'var(--green)' : s >= 6 ? 'var(--gold)' : 'var(--red)';
const decisionColor = (d: string) => d === 'approved' ? 'var(--green)' : d === 'needs_review' ? 'var(--gold)' : 'var(--red)';

// ─── UI atoms ─────────────────────────────────────────────────────────────────
const PNL = ({ children, label, style }: { children: React.ReactNode; label?: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '14px 16px', ...style }}>
    {label && <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', lineHeight: 1 }}>{label}</div>}
    {children}
  </div>
);

function ScoreChip({ label, score }: { label: string; score: number }) {
  return (
    <div title={`${label}: ${score}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 9px', background: 'var(--bg-base)', border: `1px solid color-mix(in srgb, ${scoreColor(score)} 30%, var(--border-default))`, borderRadius: '5px' }}>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 800, color: scoreColor(score), fontVariantNumeric: 'tabular-nums' }}>{score}</span>
    </div>
  );
}

// ─── Toasts ───────────────────────────────────────────────────────────────────
type Toast = { id: number; kind: 'info' | 'error'; message: string; actionLabel?: string; onAction?: () => void };
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const push = useCallback((toast: Omit<Toast, 'id'>, ms: number = 5000) => {
    const id = idRef.current++;
    setToasts(t => [...t, { ...toast, id }]);
    if (ms > 0) setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ms);
    return id;
  }, []);
  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);
  return { toasts, push, dismiss };
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 100, maxWidth: '340px' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.kind === 'error' ? 'color-mix(in srgb, var(--red) 12%, var(--bg-elevated))' : 'var(--bg-elevated)',
          border: `1px solid ${t.kind === 'error' ? 'var(--red)' : 'var(--border-default)'}`,
          borderRadius: '8px',
          padding: '11px 14px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
          color: t.kind === 'error' ? 'var(--red)' : 'var(--text-primary)',
          animation: 'criticToastIn 0.18s ease-out',
        }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
          {t.actionLabel && t.onAction && (
            <button onClick={() => { t.onAction?.(); onDismiss(t.id); }} style={{
              background: 'none', border: 'none', color: 'var(--gold)', fontSize: '11px', fontWeight: 700,
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 6px',
            }}>{t.actionLabel}</button>
          )}
          <button onClick={() => onDismiss(t.id)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '16px',
            cursor: 'pointer', padding: '0 2px', lineHeight: 1,
          }}>×</button>
        </div>
      ))}
      <style>{`@keyframes criticToastIn { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

// ─── Help overlay ─────────────────────────────────────────────────────────────
function HelpOverlay({ onClose }: { onClose: () => void }) {
  const items: [string, string][] = [
    ['j / ↓', 'Next critique'],
    ['k / ↑', 'Previous critique'],
    ['Enter', 'Open focused critique'],
    ['Esc', 'Close / back'],
    ['a', 'Approve'],
    ['r', 'Reject'],
    ['u', 'Mark used'],
    ['n', 'Mark not used'],
    ['Shift+u', 'Mark used and advance'],
    ['Shift+n', 'Mark not used and advance'],
    ['/', 'Focus search'],
    ['?', 'Toggle this help'],
  ];
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px',
        padding: '26px 30px', minWidth: '340px', maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: 800, margin: '0 0 18px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Keyboard Shortcuts</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 18px', fontSize: '12px' }}>
          {items.map(([key, desc]) => (
            <Fragment key={key}>
              <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '4px', padding: '3px 9px', fontSize: '10px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'ui-monospace, monospace', textAlign: 'center' }}>{key}</kbd>
              <span style={{ color: 'var(--text-secondary)', alignSelf: 'center' }}>{desc}</span>
            </Fragment>
          ))}
        </div>
        <div style={{ marginTop: '18px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.04em' }}>press ? or Esc to close</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CriticReview() {
  const navigate = useNavigate();
  // state
  const [critiques, setCritiques] = useState<any[]>([]);
  const [counts, setCounts] = useState(DEFAULT_COUNTS);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingShort, setCreatingShort] = useState(false);
  const [humanTab, setHumanTab] = useState<'unmarked' | 'used' | 'not_used'>('unmarked');
  const [decision, setDecision] = useState<'' | 'needs_review' | 'approved' | 'rewrite'>('');
  const [source, setSource] = useState<string>('');
  const [minScore, setMinScore] = useState<number>(0);
  const [sort, setSort] = useState<SortKey>('score_desc');
  const [search, setSearch] = useState('');
  const [focusIdx, setFocusIdx] = useState(0);
  const [briefOpen, setBriefOpen] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showAxesHelp, setShowAxesHelp] = useState(false);
  const isMobile = useIsMobile();
  const { toasts, push, dismiss } = useToasts();
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // ── loaders ──
  const loadCritiques = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true); else setRefreshing(true);
      const data = await scriptEngineApi.getCritiques(undefined, humanTab);
      setCritiques(data);
    } catch {
      push({ kind: 'error', message: 'Failed to load critiques' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [humanTab, push]);

  const loadCounts = useCallback(async () => {
    try {
      const data = await scriptEngineApi.getCritiqueCounts();
      setCounts(data);
    } catch {
      // non-fatal — keep previous counts
    }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const data = await scriptEngineApi.getCritique(id);
      setSelected(data);
    } catch {
      push({ kind: 'error', message: 'Failed to load critique' });
    }
  }, [push]);

  // initial + on humanTab change
  useEffect(() => {
    loadCritiques(critiques.length === 0);
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [humanTab]);

  // ── derived: filter + sort ──
  const filtered = useMemo(() => {
    let r = critiques;
    // Belt-and-suspenders: ensure tab filtering even if local state lags behind
    if (humanTab === 'unmarked') r = r.filter(c => !c.human_status);
    else if (humanTab === 'used') r = r.filter(c => c.human_status === 'used');
    else if (humanTab === 'not_used') r = r.filter(c => c.human_status === 'not_used');
    if (decision) {
      if (decision === 'approved') r = r.filter(c => c.script_status === 'approved');
      else if (decision === 'needs_review') r = r.filter(c => c.decision === 'needs_review' && c.script_status !== 'approved' && c.script_status !== 'rejected');
      else r = r.filter(c => c.decision === decision);
    }
    if (source) r = r.filter(c => c.source === source);
    if (minScore > 0) r = r.filter(c => (c.score_overall || 0) >= minScore);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(c =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.hook || '').toLowerCase().includes(q) ||
        (c.script_text || '').toLowerCase().includes(q)
      );
    }
    const sorted = [...r];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'score_desc': return (b.score_overall || 0) - (a.score_overall || 0);
        case 'score_asc':  return (a.score_overall || 0) - (b.score_overall || 0);
        case 'age_desc':   return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'age_asc':    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'words_desc': return (b.word_count || 0) - (a.word_count || 0);
        case 'words_asc':  return (a.word_count || 0) - (b.word_count || 0);
        default: return 0;
      }
    });
    return sorted;
  }, [critiques, decision, source, minScore, search, sort]);

  // reset/clamp focus when filter or list changes
  useEffect(() => { setFocusIdx(0); }, [decision, source, minScore, search, sort, humanTab]);
  useEffect(() => {
    if (focusIdx >= filtered.length) setFocusIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length, focusIdx]);
  // scroll focused row into view
  useEffect(() => {
    const c = filtered[focusIdx];
    if (!c) return;
    const el = rowRefs.current[c.id];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusIdx, filtered]);

  // ── actions ──
  const handleApprove = useCallback(async (id: number) => {
    try {
      await scriptEngineApi.approveCritique(id);
      setSelected((prev: any) => prev?.id === id ? { ...prev, script_status: 'approved', idea_status: 'approved' } : prev);
      setCritiques(prev => prev.map(c => c.id === id ? { ...c, script_status: 'approved', idea_status: 'approved' } : c));
      push({ kind: 'info', message: 'Approved' }, 2000);
    } catch {
      push({ kind: 'error', message: 'Failed to approve' });
    }
  }, [push]);

  const handleReject = useCallback(async (id: number) => {
    try {
      await scriptEngineApi.rejectCritique(id);
      setSelected((prev: any) => prev?.id === id ? { ...prev, script_status: 'rejected', idea_status: 'rejected' } : prev);
      setCritiques(prev => prev.map(c => c.id === id ? { ...c, script_status: 'rejected', idea_status: 'rejected' } : c));
      push({ kind: 'info', message: 'Rejected' }, 2000);
    } catch {
      push({ kind: 'error', message: 'Failed to reject' });
    }
  }, [push]);

  const handleMark = useCallback(async (id: number, status: 'used' | 'not_used' | null, advance = false) => {
    const existing = critiques.find(c => c.id === id) || (selected?.id === id ? selected : null);
    if (!existing) return;
    const priorStatus: 'used' | 'not_used' | null = existing.human_status || null;

    // figure out next critique BEFORE mutating the list
    const currentIdx = filtered.findIndex(c => c.id === id);
    const nextCritique = filtered[currentIdx + 1] || filtered[currentIdx - 1] || null;

    try {
      await scriptEngineApi.markCritique(id, status);
      // local update: if the new status matches current tab, keep it; else remove
      const staysInTab = humanTab === status || (humanTab === 'unmarked' && status === null);
      if (staysInTab) {
        setCritiques(cs => cs.map(c => c.id === id ? { ...c, human_status: status } : c));
      } else {
        setCritiques(cs => cs.filter(c => c.id !== id));
      }
      loadCounts(); // refresh counts in background

      // toast with undo
      const label = status === 'used' ? 'Used' : status === 'not_used' ? 'Not Used' : 'unmarked';
      push({
        kind: 'info',
        message: `Marked as ${label}.`,
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            await scriptEngineApi.markCritique(id, priorStatus);
            loadCritiques();
            loadCounts();
          } catch {
            push({ kind: 'error', message: 'Undo failed' });
          }
        },
      });

      // advance if requested
      if (advance) {
        if (selected?.id === id) {
          if (nextCritique) loadDetail(nextCritique.id);
          else setSelected(null);
        }
      }
    } catch {
      push({ kind: 'error', message: 'Failed to mark critique' });
    }
  }, [critiques, selected, filtered, humanTab, push, loadCounts, loadCritiques, loadDetail]);

  const handleCreateShort = useCallback(async (critiqueId: number) => {
    setCreatingShort(true);
    try {
      const newShort = await scriptEngineApi.createShortFromCritique(critiqueId);
      push({
        kind: 'info',
        message: `Short "${newShort.title}" created`,
        actionLabel: 'Open',
        onAction: () => navigate(`/shorts/${newShort.id}`),
      });
    } catch (err: any) {
      push({ kind: 'error', message: err.response?.data?.error || 'Failed to create short' });
    } finally {
      setCreatingShort(false);
    }
  }, [push, navigate]);

  // ── keyboard ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;

      // help toggle (works everywhere except inside inputs)
      if (e.key === '?' && !inInput) { e.preventDefault(); setShowHelp(s => !s); return; }

      if (e.key === 'Escape') {
        if (showHelp) { setShowHelp(false); return; }
        if (showAxesHelp) { setShowAxesHelp(false); return; }
        if (inInput) { target.blur(); return; }
        if (selected) { setSelected(null); return; }
        return;
      }
      if (inInput) return;

      // focus search with /
      if (e.key === '/' && !selected) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // detail view
      if (selected) {
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          const idx = filtered.findIndex(c => c.id === selected.id);
          const next = filtered[idx + 1];
          if (next) loadDetail(next.id);
          return;
        }
        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          const idx = filtered.findIndex(c => c.id === selected.id);
          const prev = filtered[idx - 1];
          if (prev) loadDetail(prev.id);
          return;
        }
        if (e.key === 'a') { e.preventDefault(); handleApprove(selected.id); return; }
        if (e.key === 'r') { e.preventDefault(); handleReject(selected.id); return; }
        if (e.key === 'u') { e.preventDefault(); handleMark(selected.id, 'used', false); return; }
        if (e.key === 'n') { e.preventDefault(); handleMark(selected.id, 'not_used', false); return; }
        if (e.key === 'U') { e.preventDefault(); handleMark(selected.id, 'used', true); return; }
        if (e.key === 'N') { e.preventDefault(); handleMark(selected.id, 'not_used', true); return; }
        return;
      }

      // list view
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx(i => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        const c = filtered[focusIdx];
        if (c) { e.preventDefault(); loadDetail(c.id); }
      } else {
        const c = filtered[focusIdx];
        if (!c) return;
        if (e.key === 'a')      { e.preventDefault(); handleApprove(c.id); }
        else if (e.key === 'r') { e.preventDefault(); handleReject(c.id); }
        else if (e.key === 'u') { e.preventDefault(); handleMark(c.id, 'used', false); }
        else if (e.key === 'n') { e.preventDefault(); handleMark(c.id, 'not_used', false); }
        else if (e.key === 'U') { e.preventDefault(); handleMark(c.id, 'used', true); }
        else if (e.key === 'N') { e.preventDefault(); handleMark(c.id, 'not_used', true); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, filtered, focusIdx, showHelp, showAxesHelp, handleApprove, handleReject, handleMark, loadDetail]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Loading...</div></div>;

  // ── Detail view ──
  if (selected) {
    const s = selected;
    const dims = DIMS.map(d => ({ label: d, score: s[`score_${d}`] || 0 }));
    const idx = filtered.findIndex(c => c.id === s.id);
    const hasPrev = idx > 0;
    const hasNext = idx >= 0 && idx < filtered.length - 1;

    return (
      <div style={{ fontVariantNumeric: 'tabular-nums', width: '100%' }}>
        {/* Top action bar */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {/* Row 1: nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setSelected(null)} style={{ fontSize: '11px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>← Back</button>
              <button disabled={!hasPrev} onClick={() => hasPrev && loadDetail(filtered[idx - 1].id)} style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 700, background: 'var(--bg-elevated)', color: hasPrev ? 'var(--text-primary)' : 'var(--text-muted)', border: '1px solid var(--border-default)', borderRadius: '4px', cursor: hasPrev ? 'pointer' : 'not-allowed', opacity: hasPrev ? 1 : 0.4 }}>↑</button>
              <button disabled={!hasNext} onClick={() => hasNext && loadDetail(filtered[idx + 1].id)} style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 700, background: 'var(--bg-elevated)', color: hasNext ? 'var(--text-primary)' : 'var(--text-muted)', border: '1px solid var(--border-default)', borderRadius: '4px', cursor: hasNext ? 'pointer' : 'not-allowed', opacity: hasNext ? 1 : 0.4 }}>↓</button>
              {idx >= 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}/{filtered.length}</span>}
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase' }}>{SRC[s.source]?.short || s.source}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '3px', textTransform: 'uppercase', background: `color-mix(in srgb, ${decisionColor(s.decision)} 15%, transparent)`, color: decisionColor(s.decision) }}>{s.decision?.replace('_', ' ')}</span>
            </div>
            {/* Row 2: actions */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {s.script_status !== 'approved' && <button onClick={() => handleApprove(s.id)} style={{ flex: 1, padding: '8px', background: 'color-mix(in srgb, var(--green) 15%, transparent)', color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)', borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Approve</button>}
              {s.script_status !== 'rejected' && <button onClick={() => handleReject(s.id)} style={{ flex: 1, padding: '8px', background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Reject</button>}
              {s.script_status === 'approved' && <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: 'var(--green)', padding: '8px', background: 'color-mix(in srgb, var(--green) 10%, transparent)', borderRadius: '4px', textAlign: 'center' }}>APPROVED</span>}
              {s.script_status === 'rejected' && <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: 'var(--red)', padding: '8px', background: 'color-mix(in srgb, var(--red) 10%, transparent)', borderRadius: '4px', textAlign: 'center' }}>REJECTED</span>}
              {s.human_status !== 'used' && <button onClick={() => handleMark(s.id, 'used')} style={{ flex: 1, padding: '8px', background: 'color-mix(in srgb, var(--green) 10%, transparent)', color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Used</button>}
              {s.human_status !== 'not_used' && <button onClick={() => handleMark(s.id, 'not_used')} style={{ flex: 1, padding: '8px', background: 'color-mix(in srgb, var(--red) 8%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)', borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Skip</button>}
              {s.human_status && <button onClick={() => handleMark(s.id, null)} style={{ padding: '8px 10px', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>✕</button>}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <button onClick={() => setSelected(null)} style={{ fontSize: '11px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>← Back</button>
            <div style={{ display: 'flex', gap: '3px' }}>
              <button disabled={!hasPrev} onClick={() => hasPrev && loadDetail(filtered[idx - 1].id)} title="Previous (k)" style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 700, background: 'var(--bg-elevated)', color: hasPrev ? 'var(--text-primary)' : 'var(--text-muted)', border: '1px solid var(--border-default)', borderRadius: '4px', cursor: hasPrev ? 'pointer' : 'not-allowed', opacity: hasPrev ? 1 : 0.4 }}>↑</button>
              <button disabled={!hasNext} onClick={() => hasNext && loadDetail(filtered[idx + 1].id)} title="Next (j)" style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 700, background: 'var(--bg-elevated)', color: hasNext ? 'var(--text-primary)' : 'var(--text-muted)', border: '1px solid var(--border-default)', borderRadius: '4px', cursor: hasNext ? 'pointer' : 'not-allowed', opacity: hasNext ? 1 : 0.4 }}>↓</button>
            </div>
            {idx >= 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1} of {filtered.length}</span>}
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase' }}>{SRC[s.source]?.short || s.source}</span>
            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '3px', textTransform: 'uppercase',
              background: `color-mix(in srgb, ${decisionColor(s.decision)} 15%, transparent)`,
              color: decisionColor(s.decision),
            }}>{s.decision}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>draft #{s.draft_number} · {s.word_count}w · {s.model_used}</span>
            <div style={{ flex: 1 }} />
            {s.script_status !== 'approved' && <button onClick={() => handleApprove(s.id)} title="Approve (a)" style={{ padding: '6px 16px', background: 'color-mix(in srgb, var(--green) 15%, transparent)', color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Approve</button>}
            {s.script_status !== 'rejected' && <button onClick={() => handleReject(s.id)} title="Reject (r)" style={{ padding: '6px 16px', background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Reject</button>}
            {s.script_status === 'approved' && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--green)', padding: '5px 14px', background: 'color-mix(in srgb, var(--green) 10%, transparent)', borderRadius: '4px' }}>APPROVED</span>}
            {s.script_status === 'rejected' && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--red)', padding: '5px 14px', background: 'color-mix(in srgb, var(--red) 10%, transparent)', borderRadius: '4px' }}>REJECTED</span>}
            <button onClick={() => handleCreateShort(s.id)} disabled={creatingShort} title="Create a short in the pipeline from this critique" style={{ padding: '6px 14px', background: 'color-mix(in srgb, var(--gold) 12%, transparent)', color: 'var(--gold)', border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: creatingShort ? 'default' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: creatingShort ? 0.5 : 1 }}>{creatingShort ? 'Creating…' : '+ Short'}</button>
            <div style={{ width: '1px', height: '20px', background: 'var(--border-default)', margin: '0 4px' }} />
            {s.human_status !== 'used' && <button onClick={() => handleMark(s.id, 'used')} title="Mark used (u)" style={{ padding: '6px 14px', background: 'color-mix(in srgb, var(--green) 10%, transparent)', color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mark Used</button>}
            {s.human_status !== 'not_used' && <button onClick={() => handleMark(s.id, 'not_used')} title="Mark not used (n)" style={{ padding: '6px 14px', background: 'color-mix(in srgb, var(--red) 8%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Not Used</button>}
            {s.human_status && <button onClick={() => handleMark(s.id, null)} style={{ padding: '6px 10px', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>Unmark</button>}
          </div>
        )}

        {/* Score strip */}
        <PNL style={{ padding: '14px 18px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', paddingRight: '16px', borderRight: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '36px', fontWeight: 900, color: scoreColor(s.score_overall || 0), letterSpacing: '-0.04em', lineHeight: 1 }}>{s.score_overall}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>overall</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {dims.map(d => <ScoreChip key={d.label} label={d.label} score={d.score} />)}
            </div>
          </div>
        </PNL>

        {/* Main grid: script (left) + rail (right) */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px', gap: '12px' }}>
          {/* Script column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
            {/* Title + hook */}
            <PNL style={{ padding: '20px 24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 10px', lineHeight: 1.25 }}>{s.title}</h2>
              {s.hook && <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0, borderLeft: '3px solid var(--gold)', paddingLeft: '14px', fontStyle: 'italic' }}>{s.hook}</p>}
            </PNL>

            {/* Script text */}
            <PNL label="Script" style={{ position: 'relative', padding: '14px 22px 20px' }}>
              <button
                onClick={() => { navigator.clipboard.writeText(s.script_text || ''); push({ kind: 'info', message: 'Script copied to clipboard' }, 2000); }}
                style={{ position: 'absolute', top: '12px', right: '14px', padding: '4px 10px', fontSize: '10px', fontWeight: 700, background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: '4px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
              >Copy</button>
              <div style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.85, whiteSpace: 'pre-wrap', fontFamily: 'inherit', paddingRight: '70px' }}>
                {s.script_text}
              </div>
            </PNL>

            {/* Critic's rewritten script */}
            {s.critic_script && (
              <PNL label="Critic's Script" style={{ borderColor: 'color-mix(in srgb, var(--green) 30%, var(--border-default))', padding: '14px 22px 20px' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{s.critic_script}</div>
              </PNL>
            )}

            {/* Research Brief — embedded in main column for readability */}
            {s.full_brief && (
              <PNL label="Research Brief" style={{ padding: '18px 24px 22px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <ReactMarkdown components={{
                    h1: ({children}) => <h1 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '16px 0 6px' }}>{children}</h1>,
                    h2: ({children}) => <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '14px 0 5px' }}>{children}</h2>,
                    h3: ({children}) => <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '10px 0 4px' }}>{children}</h3>,
                    p: ({children}) => <p style={{ margin: '5px 0', lineHeight: 1.8 }}>{children}</p>,
                    li: ({children}) => <li style={{ margin: '3px 0', lineHeight: 1.7 }}>{children}</li>,
                    strong: ({children}) => <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{children}</strong>,
                    a: ({children, href}) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>{children}</a>,
                    blockquote: ({children}) => <blockquote style={{ borderLeft: '2px solid var(--gold)', paddingLeft: '14px', margin: '8px 0', color: 'var(--text-muted)' }}>{children}</blockquote>,
                    code: ({children, className}) => className || (typeof children === 'string' && children.includes('\n')) ? <CodeBlock className={className}>{children}</CodeBlock> : <InlineCode>{children}</InlineCode>,
                  }}>{s.full_brief}</ReactMarkdown>
                </div>
              </PNL>
            )}
          </div>

          {/* Right rail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
            <PNL label="Critic Commentary">
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{s.critique}</div>
            </PNL>

            {s.rewrite_guidance && (
              <PNL label="Rewrite Guidance">
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{s.rewrite_guidance}</div>
              </PNL>
            )}

            {s.draft_history && s.draft_history.length > 1 && (
              <PNL label="Draft History">
                {s.draft_history.map((h: any) => (
                  <div key={h.id} onClick={() => h.id !== s.id && loadDetail(h.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0',
                    borderBottom: '1px solid var(--border-subtle)', cursor: h.id !== s.id ? 'pointer' : 'default',
                    opacity: h.id === s.id ? 1 : 0.75,
                  }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '34px', fontWeight: 600 }}>#{h.draft_number}</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: scoreColor(h.score_overall), width: '22px' }}>{h.score_overall}</span>
                    <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase',
                      background: `color-mix(in srgb, ${decisionColor(h.decision)} 15%, transparent)`,
                      color: decisionColor(h.decision),
                    }}>{h.decision}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{ago(h.created_at)}</span>
                  </div>
                ))}
              </PNL>
            )}

          </div>
        </div>

        {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </div>
    );
  }

  // ── List view ──
  const tabDefs: Array<{ key: 'unmarked' | 'used' | 'not_used'; label: string; color: string; count: number }> = [
    { key: 'unmarked', label: 'New',      color: 'var(--text-primary)', count: counts.unmarked },
    { key: 'used',     label: 'Used',     color: 'var(--green)',        count: counts.used },
    { key: 'not_used', label: 'Not Used', color: 'var(--red)',          count: counts.not_used },
  ];
  const distTotal = counts.low_unmarked + counts.mid_unmarked + counts.high_unmarked;

  const focusedCritique = filtered[focusIdx] || null;

  return (
    <div style={{ fontVariantNumeric: 'tabular-nums', width: '100%' }}>
      {/* Header: title + tabs + help */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0, marginRight: '4px' }}>Critic Review</h1>
        <button onClick={() => setShowAxesHelp(s => !s)} title="What do Approve and Mark Used mean?" style={{
          width: '18px', height: '18px', borderRadius: '50%', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1,
        }}>?</button>
        {tabDefs.map(tab => {
          const active = humanTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setHumanTab(tab.key)} style={{
              padding: '5px 13px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              border: active ? `1px solid ${tab.color}` : '1px solid var(--border-default)',
              background: active ? `color-mix(in srgb, ${tab.color} 12%, var(--bg-elevated))` : 'var(--bg-elevated)',
              color: active ? tab.color : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '7px',
            }}>
              {tab.label}
              <span style={{
                fontSize: '10px', fontWeight: 700,
                padding: '1px 6px', borderRadius: '8px',
                background: active ? 'color-mix(in srgb, var(--bg-base) 60%, transparent)' : 'var(--bg-base)',
                color: active ? tab.color : 'var(--text-muted)',
                minWidth: '18px', textAlign: 'center',
              }}>{tab.count}</span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)" style={{
          padding: '5px 11px', fontSize: '10px', fontWeight: 700, background: 'var(--bg-elevated)', color: 'var(--text-muted)',
          border: '1px solid var(--border-default)', borderRadius: '4px', cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>? Shortcuts</button>
      </div>

      {showAxesHelp && (
        <PNL style={{ marginBottom: '12px', borderColor: 'var(--gold-border)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <div style={{ marginBottom: '6px' }}><strong style={{ color: 'var(--gold)' }}>Approve / Reject</strong> updates the script and idea status in the pipeline. Use this to override the AI critic's decision.</div>
            <div><strong style={{ color: 'var(--gold)' }}>Mark Used / Not Used</strong> tracks whether you actually used the script. It doesn't affect the pipeline — it's just outcome tracking for the critic's recommendations.</div>
          </div>
        </PNL>
      )}

      {/* Stats strip (unmarked tab only) */}
      {humanTab === 'unmarked' && distTotal > 0 && (
        <PNL style={{ marginBottom: '10px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{counts.unmarked}</span>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>in queue</span>
            </div>
            {counts.avg_score_unmarked > 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '22px', fontWeight: 900, color: scoreColor(counts.avg_score_unmarked), letterSpacing: '-0.03em' }}>{counts.avg_score_unmarked}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>avg score</span>
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Distribution</span>
              <div style={{ flex: 1, height: '10px', display: 'flex', borderRadius: '5px', overflow: 'hidden', background: 'var(--bg-base)', minWidth: '140px', maxWidth: '380px' }}>
                <div title={`${counts.high_unmarked} scored 8+`} style={{ width: `${(counts.high_unmarked / distTotal) * 100}%`, background: 'var(--green)' }} />
                <div title={`${counts.mid_unmarked} scored 6-7`} style={{ width: `${(counts.mid_unmarked / distTotal) * 100}%`, background: 'var(--gold)' }} />
                <div title={`${counts.low_unmarked} scored <6`} style={{ width: `${(counts.low_unmarked / distTotal) * 100}%`, background: 'var(--red)' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '10px', fontWeight: 700 }}>
                <span style={{ color: 'var(--green)' }}>{counts.high_unmarked} high</span>
                <span style={{ color: 'var(--gold)' }}>{counts.mid_unmarked} mid</span>
                <span style={{ color: 'var(--red)' }}>{counts.low_unmarked} low</span>
              </div>
            </div>
          </div>
        </PNL>
      )}

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? '4px' : 0 }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, hook, script…"
            style={{
              padding: '6px 26px 6px 28px', fontSize: '11px', width: isMobile ? '180px' : '260px',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border-default)', borderRadius: '4px', outline: 'none',
              fontFamily: 'inherit',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold-border)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
          />
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-muted)', pointerEvents: 'none' }}>⌕</span>
          {search ? (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
          ) : (
            <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace', background: 'var(--bg-base)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border-subtle)' }}>/</span>
          )}
        </div>

        {/* Decision chips */}
        <div style={{ display: 'flex', gap: '3px', padding: '0 6px', borderLeft: '1px solid var(--border-default)', marginLeft: '4px' }}>
          {(['', 'needs_review', 'approved', 'rewrite'] as const).map(f => {
            const label = f === '' ? 'All' : f === 'needs_review' ? 'Needs Review' : f === 'approved' ? 'Approved' : 'Rewrites';
            const active = decision === f;
            return (
              <button key={f || 'all'} onClick={() => setDecision(f)} style={{
                padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                border: active ? '1px solid var(--gold-border)' : '1px solid var(--border-default)',
                background: active ? 'color-mix(in srgb, var(--gold) 10%, var(--bg-elevated))' : 'var(--bg-elevated)',
                color: active ? 'var(--gold)' : 'var(--text-muted)',
              }}>{label}</button>
            );
          })}
        </div>

        {/* Source chips */}
        <div style={{ display: 'flex', gap: '3px', padding: '0 6px', borderLeft: '1px solid var(--border-default)' }}>
          <button onClick={() => setSource('')} style={{
            padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
            border: source === '' ? '1px solid var(--gold-border)' : '1px solid var(--border-default)',
            background: source === '' ? 'color-mix(in srgb, var(--gold) 10%, var(--bg-elevated))' : 'var(--bg-elevated)',
            color: source === '' ? 'var(--gold)' : 'var(--text-muted)',
          }}>Any</button>
          {SOURCE_KEYS.map(k => {
            const active = source === k;
            return (
              <button key={k} onClick={() => setSource(k)} title={SRC[k].full} style={{
                padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                border: active ? '1px solid var(--gold-border)' : '1px solid var(--border-default)',
                background: active ? 'color-mix(in srgb, var(--gold) 10%, var(--bg-elevated))' : 'var(--bg-elevated)',
                color: active ? 'var(--gold)' : 'var(--text-muted)',
              }}>{SRC[k].short}</button>
            );
          })}
        </div>

        {/* Score min chips */}
        <div style={{ display: 'flex', gap: '3px', padding: '0 6px', borderLeft: '1px solid var(--border-default)', alignItems: 'center' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '2px' }}>min</span>
          {[0, 6, 7, 8, 9].map(n => {
            const active = minScore === n;
            return (
              <button key={n} onClick={() => setMinScore(n)} style={{
                padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                border: active ? '1px solid var(--gold-border)' : '1px solid var(--border-default)',
                background: active ? 'color-mix(in srgb, var(--gold) 10%, var(--bg-elevated))' : 'var(--bg-elevated)',
                color: active ? 'var(--gold)' : 'var(--text-muted)',
                minWidth: '28px',
              }}>{n === 0 ? 'All' : `${n}+`}</button>
            );
          })}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          style={{
            padding: '6px 8px', fontSize: '10px', fontWeight: 700,
            background: 'var(--bg-elevated)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', borderRadius: '4px',
            cursor: 'pointer', marginLeft: '4px', fontFamily: 'inherit',
          }}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
            <option key={k} value={k}>{SORT_LABELS[k]}</option>
          ))}
        </select>

        {refreshing && <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>refreshing…</span>}
      </div>

      {/* Table + Brief preview */}
      <div style={{ display: 'grid', gridTemplateColumns: !isMobile && focusedCritique?.full_brief && briefOpen ? '1fr 700px' : '1fr', gap: '12px', alignItems: 'start' }}>
      <PNL style={{ padding: 0, overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '36px', textAlign: 'center', letterSpacing: '0.06em' }}>Score</span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '38px', letterSpacing: '0.06em' }}>Src</span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', flex: 1, letterSpacing: '0.06em' }}>Title · Hook</span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '96px', textAlign: 'center', letterSpacing: '0.06em' }}>Decision</span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '40px', textAlign: 'center', letterSpacing: '0.06em' }}>Draft</span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '46px', letterSpacing: '0.06em' }}>Age</span>
            <span style={{ width: '144px' }} />
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
              {critiques.length === 0 ? 'No critiques yet' : 'No results match your filters'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {critiques.length === 0 ? 'Run the critic agent to generate some.' : 'Try clearing search or relaxing filters.'}
            </div>
          </div>
        )}

        {filtered.map((c: any, idx: number) => {
          const focused = idx === focusIdx;
          const isActionable = c.decision === 'needs_review' && c.script_status !== 'approved' && c.script_status !== 'rejected';
          const displayDecision = c.script_status === 'approved' ? 'approved' : c.script_status === 'rejected' ? 'rejected' : c.decision?.replace('_', ' ');
          const decisionCol = c.script_status === 'approved' ? 'var(--green)' : c.script_status === 'rejected' ? 'var(--red)' : decisionColor(c.decision);

          if (isMobile) {
            return (
              <div
                key={c.id}
                ref={el => { rowRefs.current[c.id] = el; }}
                onClick={() => { setFocusIdx(idx); loadDetail(c.id); }}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                  background: focused ? 'color-mix(in srgb, var(--gold) 8%, transparent)' : isActionable ? 'color-mix(in srgb, var(--gold) 3%, transparent)' : 'transparent',
                  borderLeft: focused ? '3px solid var(--gold)' : '3px solid transparent',
                  paddingLeft: focused ? '11px' : '14px',
                  transition: 'background 0.08s, border-left-color 0.08s',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '26px', fontWeight: 900, color: scoreColor(c.score_overall), letterSpacing: '-0.04em', lineHeight: 1, minWidth: '30px', paddingTop: '2px' }}>{c.score_overall}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px', lineHeight: 1.3, letterSpacing: '-0.01em' }}>{c.title}</div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '3px', textTransform: 'uppercase', background: `color-mix(in srgb, ${decisionCol} 15%, transparent)`, color: decisionCol }}>{displayDecision}</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)' }}>{SRC[c.source]?.short || c.source}</span>
                      {c.draft_number > 1 && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)' }}>#{c.draft_number}</span>}
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{ago(c.created_at)}</span>
                    </div>
                    {c.hook && <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.hook}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingLeft: '42px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleMark(c.id, 'used')} style={{ flex: 1, padding: '7px', background: 'color-mix(in srgb, var(--green) 10%, transparent)', color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Used</button>
                  <button onClick={() => handleMark(c.id, 'not_used')} style={{ flex: 1, padding: '7px', background: 'color-mix(in srgb, var(--red) 8%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Skip</button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={c.id}
              ref={el => { rowRefs.current[c.id] = el; }}
              onClick={() => { setFocusIdx(idx); loadDetail(c.id); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px',
                borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                background: focused ? 'color-mix(in srgb, var(--gold) 8%, transparent)' : isActionable ? 'color-mix(in srgb, var(--gold) 3%, transparent)' : 'transparent',
                borderLeft: focused ? '3px solid var(--gold)' : '3px solid transparent',
                paddingLeft: focused ? '11px' : '14px',
                transition: 'background 0.08s, border-left-color 0.08s, padding-left 0.08s',
              }}
            >
              <div style={{ width: '36px', textAlign: 'center' }}>
                <span style={{ fontSize: '19px', fontWeight: 900, color: scoreColor(c.score_overall), letterSpacing: '-0.03em' }}>{c.score_overall}</span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 700, width: '38px', letterSpacing: '0.02em' }}>{SRC[c.source]?.short || c.source}</span>
              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px', letterSpacing: '-0.01em' }}>{c.title}</div>
                {c.hook && <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>{c.hook}</div>}
              </div>
              <span style={{
                fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '3px', textTransform: 'uppercase',
                width: '96px', textAlign: 'center', letterSpacing: '0.03em',
                background: `color-mix(in srgb, ${decisionCol} 15%, transparent)`,
                color: decisionCol,
              }}>{displayDecision}</span>
              <span style={{
                fontSize: '11px', fontWeight: 700, width: '40px', textAlign: 'center',
                color: c.draft_number > 1 ? 'var(--gold)' : 'var(--text-muted)',
              }}>#{c.draft_number}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '46px', fontWeight: 600 }}>{ago(c.created_at)}</span>
              <div style={{ display: 'flex', gap: '4px', width: '144px', justifyContent: 'flex-end', opacity: focused ? 1 : 0.45, transition: 'opacity 0.1s' }} onClick={e => e.stopPropagation()}>
                <button onClick={() => handleMark(c.id, 'used')} title="Mark used (u)" style={{ padding: '4px 10px', background: 'color-mix(in srgb, var(--green) 10%, transparent)', color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: '3px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Used</button>
                <button onClick={() => handleMark(c.id, 'not_used')} title="Mark not used (n)" style={{ padding: '4px 10px', background: 'color-mix(in srgb, var(--red) 8%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)', borderRadius: '3px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Skip</button>
              </div>
            </div>
          );
        })}
      </PNL>

      {/* Research brief preview panel — toggle button or collapsed pill (desktop only) */}
      {!isMobile && focusedCritique?.full_brief && (
        briefOpen ? (
          <PNL
            label={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>Research Brief</span>
                <button
                  onClick={() => setBriefOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1, padding: '0 0 0 8px', display: 'flex', alignItems: 'center' }}
                  title="Collapse research brief"
                >✕</button>
              </div>
            }
            style={{ position: 'sticky', top: '12px', maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.75 }}>
              <ReactMarkdown components={{
                h1: ({children}) => <h1 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: '14px 0 5px' }}>{children}</h1>,
                h2: ({children}) => <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 4px' }}>{children}</h2>,
                h3: ({children}) => <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 3px' }}>{children}</h3>,
                p: ({children}) => <p style={{ margin: '4px 0', lineHeight: 1.75 }}>{children}</p>,
                li: ({children}) => <li style={{ margin: '2px 0', lineHeight: 1.65 }}>{children}</li>,
                strong: ({children}) => <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{children}</strong>,
                a: ({children, href}) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>{children}</a>,
                blockquote: ({children}) => <blockquote style={{ borderLeft: '2px solid var(--gold)', paddingLeft: '12px', margin: '6px 0', color: 'var(--text-muted)' }}>{children}</blockquote>,
                code: ({children, className}) => className || (typeof children === 'string' && children.includes('\n')) ? <CodeBlock className={className}>{children}</CodeBlock> : <InlineCode>{children}</InlineCode>,
              }}>{focusedCritique.full_brief}</ReactMarkdown>
            </div>
          </PNL>
        ) : (
          <button
            onClick={() => setBriefOpen(true)}
            style={{
              position: 'sticky', top: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', color: 'var(--text-muted)',
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              textAlign: 'left', width: '100%',
            }}
            title="Expand research brief"
          >
            Research Brief ›
          </button>
        )
      )}
      </div>

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
