import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { scriptEngineApi } from '../services/api';

const SRC: Record<string, string> = { code: 'CODE', youtube: 'YT', reddit: 'RDT', bugs: 'BUGS', mods: 'MODS', wiki: 'WIKI', minecraft: 'MC' };
const DIMS = ['hook', 'pivot', 'pacing', 'density', 'voice', 'ending', 'accuracy', 'competitive'] as const;

const ago = (d: string) => {
  if (!d) return '—';
  const x = !d.includes('Z') && !d.includes('+') && !d.includes('T') ? new Date(d + 'Z') : new Date(d);
  const m = Math.floor((Date.now() - x.getTime()) / 60000);
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
};

const scoreColor = (s: number) => s >= 8 ? 'var(--green)' : s >= 6 ? 'var(--gold)' : 'var(--red)';
const decisionColor = (d: string) => d === 'approved' ? 'var(--green)' : d === 'needs_review' ? 'var(--gold)' : 'var(--red)';

const PNL = ({ children, label, style }: { children: React.ReactNode; label?: string; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '10px 12px', ...style }}>
    {label && <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', lineHeight: 1 }}>{label}</div>}
    {children}
  </div>
);

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '72px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</span>
      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--bg-base)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score * 10}%`, background: scoreColor(score), borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '11px', fontWeight: 800, color: scoreColor(score), width: '20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{score}</span>
    </div>
  );
}

export default function CriticReview() {
  const [critiques, setCritiques] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => { loadCritiques(); }, []);

  const loadCritiques = async (decision?: string) => {
    try {
      setLoading(true);
      const data = await scriptEngineApi.getCritiques(decision || undefined);
      setCritiques(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadDetail = async (id: number) => {
    try {
      const data = await scriptEngineApi.getCritique(id);
      setSelected(data);
    } catch (e) { console.error(e); }
  };

  const handleApprove = async (id: number) => {
    try {
      await scriptEngineApi.approveCritique(id);
      setSelected((prev: any) => prev ? { ...prev, script_status: 'approved', idea_status: 'approved' } : prev);
      setCritiques(prev => prev.map(c => c.id === id ? { ...c, script_status: 'approved', idea_status: 'approved' } : c));
    } catch (e) { console.error(e); }
  };

  const handleReject = async (id: number) => {
    try {
      await scriptEngineApi.rejectCritique(id);
      setSelected((prev: any) => prev ? { ...prev, script_status: 'rejected', idea_status: 'rejected' } : prev);
      setCritiques(prev => prev.map(c => c.id === id ? { ...c, script_status: 'rejected', idea_status: 'rejected' } : c));
    } catch (e) { console.error(e); }
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Loading...</div></div>;

  // ── Detail view ──
  if (selected) {
    const s = selected;
    const dims = DIMS.map(d => ({ label: d, score: s[`score_${d}`] || 0 }));

    return (
      <div style={{ fontVariantNumeric: 'tabular-nums', maxWidth: '960px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <button onClick={() => setSelected(null)} style={{ fontSize: '10px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>&larr; Back</button>
          <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase' }}>{SRC[s.source] || s.source}</span>
          <span style={{ fontSize: '8px', fontWeight: 700, padding: '2px 8px', borderRadius: '3px', textTransform: 'uppercase',
            background: `color-mix(in srgb, ${decisionColor(s.decision)} 15%, transparent)`,
            color: decisionColor(s.decision)
          }}>{s.decision}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>draft #{s.draft_number} · {s.word_count}w · {s.model_used}</span>
          <div style={{ flex: 1 }} />
          {s.script_status !== 'approved' && (
            <button onClick={() => handleApprove(s.id)} style={{ padding: '5px 16px', background: 'color-mix(in srgb, var(--green) 15%, transparent)', color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Approve</button>
          )}
          {s.script_status !== 'rejected' && (
            <button onClick={() => handleReject(s.id)} style={{ padding: '5px 16px', background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Reject</button>
          )}
          {s.script_status === 'approved' && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--green)', padding: '5px 16px', background: 'color-mix(in srgb, var(--green) 10%, transparent)', borderRadius: '4px' }}>APPROVED</span>
          )}
          {s.script_status === 'rejected' && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--red)', padding: '5px 16px', background: 'color-mix(in srgb, var(--red) 10%, transparent)', borderRadius: '4px' }}>REJECTED</span>
          )}
        </div>

        {/* Title */}
        <PNL style={{ padding: '16px 20px', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1.3 }}>{s.title}</h2>
          {s.hook && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, borderLeft: '2px solid var(--gold)', paddingLeft: '10px' }}>{s.hook}</p>}
        </PNL>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '8px', marginBottom: '8px' }}>
          {/* Scores panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <PNL label="Scores">
              <div style={{ textAlign: 'center', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '36px', fontWeight: 900, color: scoreColor(s.score_overall || 0), letterSpacing: '-0.04em', lineHeight: 1 }}>{s.score_overall}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>Overall</div>
              </div>
              {dims.map(d => <ScoreBar key={d.label} label={d.label} score={d.score} />)}
            </PNL>

            {/* Draft history */}
            {s.draft_history && s.draft_history.length > 1 && (
              <PNL label="Draft History">
                {s.draft_history.map((h: any) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', borderBottom: '1px solid var(--border-subtle)', cursor: h.id !== s.id ? 'pointer' : 'default', opacity: h.id === s.id ? 1 : 0.7 }}
                    onClick={() => h.id !== s.id && loadDetail(h.id)}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '36px' }}>#{h.draft_number}</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: scoreColor(h.score_overall), width: '20px' }}>{h.score_overall}</span>
                    <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase',
                      background: `color-mix(in srgb, ${decisionColor(h.decision)} 15%, transparent)`,
                      color: decisionColor(h.decision)
                    }}>{h.decision}</span>
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{ago(h.created_at)}</span>
                  </div>
                ))}
              </PNL>
            )}
          </div>

          {/* Script text */}
          <PNL label="Script">
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.9, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
              {s.script_text}
            </div>
          </PNL>
        </div>

        {/* Critique */}
        <PNL label="Critic Commentary" style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{s.critique}</div>
        </PNL>

        {/* Rewrite guidance */}
        {s.rewrite_guidance && (
          <PNL label="Rewrite Guidance" style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{s.rewrite_guidance}</div>
          </PNL>
        )}

        {/* Critic's own script */}
        {s.critic_script && (
          <PNL label="Critic's Script" style={{ marginBottom: '8px', borderColor: 'color-mix(in srgb, var(--green) 30%, var(--border-default))' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.9, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{s.critic_script}</div>
          </PNL>
        )}

        {/* Full research brief */}
        {s.full_brief && (
          <PNL label="Research Brief" style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.7, padding: '8px', background: 'var(--bg-base)', borderRadius: '4px', border: '1px solid var(--border-default)' }}>
              <ReactMarkdown components={{
                h1: ({children}) => <h1 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: '14px 0 6px', letterSpacing: '-0.02em' }}>{children}</h1>,
                h2: ({children}) => <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</h2>,
                h3: ({children}) => <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 3px' }}>{children}</h3>,
                p: ({children}) => <p style={{ margin: '3px 0', lineHeight: 1.7 }}>{children}</p>,
                li: ({children}) => <li style={{ margin: '2px 0', lineHeight: 1.6 }}>{children}</li>,
                strong: ({children}) => <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{children}</strong>,
                a: ({children, href}) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>{children}</a>,
                blockquote: ({children}) => <blockquote style={{ borderLeft: '2px solid var(--gold)', paddingLeft: '10px', margin: '6px 0', color: 'var(--text-muted)' }}>{children}</blockquote>,
                code: ({children, className}) => className ? <pre style={{ background: 'var(--bg-elevated)', padding: '6px 8px', borderRadius: '4px', overflow: 'auto', fontSize: '10px', border: '1px solid var(--border-default)', margin: '4px 0' }}><code>{children}</code></pre> : <code style={{ background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', color: 'var(--gold)' }}>{children}</code>,
              }}>{s.full_brief}</ReactMarkdown>
            </div>
          </PNL>
        )}
      </div>
    );
  }

  // ── List view ──
  const counts = {
    all: critiques.length,
    approved: critiques.filter(c => c.script_status === 'approved').length,
    needs_review: critiques.filter(c => c.decision === 'needs_review' && c.script_status !== 'approved' && c.script_status !== 'rejected').length,
    rewrite: critiques.filter(c => c.decision === 'rewrite').length,
  };

  const filtered = filter
    ? filter === 'needs_review'
      ? critiques.filter(c => c.decision === 'needs_review' && c.script_status !== 'approved' && c.script_status !== 'rejected')
      : filter === 'approved'
        ? critiques.filter(c => c.script_status === 'approved')
        : critiques.filter(c => c.decision === filter)
    : critiques;

  return (
    <div style={{ fontVariantNumeric: 'tabular-nums', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>Critic Review</h1>
        <div style={{ flex: 1 }} />
        {(['', 'needs_review', 'approved', 'rewrite'] as const).map(f => {
          const label = f === '' ? 'All' : f === 'needs_review' ? 'Needs Review' : f === 'approved' ? 'Approved' : 'Rewrites';
          const count = f === '' ? counts.all : f === 'needs_review' ? counts.needs_review : f === 'approved' ? counts.approved : counts.rewrite;
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '4px 12px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              border: active ? '1px solid var(--gold-border)' : '1px solid var(--border-default)',
              background: active ? 'color-mix(in srgb, var(--gold) 10%, var(--bg-elevated))' : 'var(--bg-elevated)',
              color: active ? 'var(--gold)' : 'var(--text-muted)',
            }}>{label} <span style={{ opacity: 0.6 }}>{count}</span></button>
          );
        })}
      </div>

      {/* Table */}
      <PNL style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
          <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '32px', textAlign: 'center' }}>Score</span>
          <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '30px' }}>Src</span>
          <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', flex: 1 }}>Title</span>
          <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '140px' }}>Dimensions</span>
          <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '70px', textAlign: 'center' }}>Decision</span>
          <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '24px' }}>D#</span>
          <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', width: '34px' }}>Age</span>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>No critiques yet. Run the critic agent first.</div>
        )}

        {filtered.map((c: any) => {
          const isActionable = c.decision === 'needs_review' && c.script_status !== 'approved' && c.script_status !== 'rejected';
          return (
            <div key={c.id} onClick={() => loadDetail(c.id)} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
              borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
              background: isActionable ? 'color-mix(in srgb, var(--gold) 3%, transparent)' : 'transparent',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isActionable ? 'color-mix(in srgb, var(--gold) 3%, transparent)' : 'transparent'; }}>
              {/* Overall score */}
              <div style={{ width: '32px', textAlign: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 900, color: scoreColor(c.score_overall), letterSpacing: '-0.03em' }}>{c.score_overall}</span>
              </div>
              {/* Source */}
              <span style={{ fontSize: '8px', color: 'var(--gold)', fontWeight: 700, width: '30px' }}>{SRC[c.source] || c.source}</span>
              {/* Title + hook */}
              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                {c.hook && <div style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>{c.hook}</div>}
              </div>
              {/* Mini dimension bars */}
              <div style={{ width: '140px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {DIMS.map(d => {
                  const v = c[`score_${d}`] || 0;
                  return (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <div style={{ width: '100%', height: '3px', borderRadius: '1.5px', background: 'var(--bg-base)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${v * 10}%`, background: scoreColor(v), borderRadius: '1.5px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Decision */}
              <span style={{
                fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', textTransform: 'uppercase',
                width: '70px', textAlign: 'center',
                background: c.script_status === 'approved' ? 'color-mix(in srgb, var(--green) 15%, transparent)' : c.script_status === 'rejected' ? 'color-mix(in srgb, var(--red) 15%, transparent)' : `color-mix(in srgb, ${decisionColor(c.decision)} 15%, transparent)`,
                color: c.script_status === 'approved' ? 'var(--green)' : c.script_status === 'rejected' ? 'var(--red)' : decisionColor(c.decision),
              }}>{c.script_status === 'approved' ? 'approved' : c.script_status === 'rejected' ? 'rejected' : c.decision}</span>
              {/* Draft # */}
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '24px', textAlign: 'center' }}>#{c.draft_number}</span>
              {/* Age */}
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '34px' }}>{ago(c.created_at)}</span>
            </div>
          );
        })}
      </PNL>
    </div>
  );
}
