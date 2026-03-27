import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { scriptEngineApi } from '../services/api';

const S: Record<string, string> = { researched: 'var(--green)', approved: 'var(--blue)', rejected: 'var(--red)', duplicate: 'var(--text-muted)', new: 'var(--gold)', scripted: 'var(--col-script)', published: 'var(--col-uploaded)', needs_review: 'var(--gold)', rewrite_pending: 'var(--red)' };
const SRC: Record<string, string> = { code: 'CODE', youtube: 'YT', reddit: 'RDT', bugs: 'BUGS', mods: 'MODS', wiki: 'WIKI', minecraft: 'MC' };

const p = (d: string) => { if (!d) return null; const x = new Date(d); return !d.includes('Z') && !d.includes('+') && !d.includes('T') ? new Date(d + 'Z') : x; };
const dur = (s: number | null) => !s ? '—' : s < 60 ? `${s}s` : `${Math.round(s / 60)}m`;
const ago = (d: string) => { const x = p(d); if (!x) return '—'; const m = Math.floor((Date.now() - x.getTime()) / 60000); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m/60)}h` : `${Math.floor(m/1440)}d`; };
const ts = (d: string) => { const x = p(d); return x ? x.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'; };
const n = (v: number) => v?.toLocaleString() || '0';

function Spark({ data, color = 'var(--gold)', h = 20, w = 80 }: { data: number[]; color?: string; h?: number; w?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 2)}`).join(' ');
  return <svg width={w} height={h} style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Bar({ value, max, color = 'var(--gold)' }: { value: number; max: number; color?: string }) {
  return <div style={{ height: '3px', borderRadius: '2px', background: 'var(--border-default)', overflow: 'hidden', flex: 1 }}><div style={{ height: '100%', width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: color, borderRadius: '2px' }} /></div>;
}

const PNL = ({ children, label, style }: { children: React.ReactNode; label?: string; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '10px 12px', ...style }}>
    {label && <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', lineHeight: 1 }}>{label}</div>}
    {children}
  </div>
);

const Metric = ({ value, label, color }: { value: string | number; label: string; color?: string }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '20px', fontWeight: 800, color: color || 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
  </div>
);

const MdRenderer = ({ content }: { content: string }) => (
  <div className="script-engine-md" style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.7, padding: '16px', background: 'var(--bg-base)', borderRadius: '4px', border: '1px solid var(--border-default)' }}>
    <ReactMarkdown components={{
      h1: ({children}) => <h1 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: '16px 0 8px', letterSpacing: '-0.02em' }}>{children}</h1>,
      h2: ({children}) => <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</h2>,
      h3: ({children}) => <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: '10px 0 4px' }}>{children}</h3>,
      p: ({children}) => <p style={{ margin: '4px 0', lineHeight: 1.7 }}>{children}</p>,
      li: ({children}) => <li style={{ margin: '2px 0', lineHeight: 1.6 }}>{children}</li>,
      code: ({children, className}) => className ? <pre style={{ background: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: '4px', overflow: 'auto', fontSize: '10px', border: '1px solid var(--border-default)', margin: '6px 0' }}><code>{children}</code></pre> : <code style={{ background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', color: 'var(--gold)' }}>{children}</code>,
      table: ({children}) => <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', margin: '6px 0' }}>{children}</table>,
      th: ({children}) => <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '9px', textTransform: 'uppercase' }}>{children}</th>,
      td: ({children}) => <td style={{ padding: '3px 8px', borderBottom: '1px solid var(--border-subtle)' }}>{children}</td>,
      strong: ({children}) => <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{children}</strong>,
      a: ({children, href}) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>{children}</a>,
      blockquote: ({children}) => <blockquote style={{ borderLeft: '2px solid var(--gold)', paddingLeft: '10px', margin: '6px 0', color: 'var(--text-muted)' }}>{children}</blockquote>,
    }}>{content}</ReactMarkdown>
  </div>
);

export default function ScriptEngine() {
  const [data, setData] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<any>(null);
  const [allIdeas, setAllIdeas] = useState<any[] | null>(null);
  const [allBriefs, setAllBriefs] = useState<any[] | null>(null);
  const [allScripts, setAllScripts] = useState<any[] | null>(null);
  const [selectedScript, setSelectedScript] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'dashboard' | 'ideas' | 'briefs' | 'scripts'>('dashboard');

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    try {
      const [status, runHistory] = await Promise.all([scriptEngineApi.getStatus(), scriptEngineApi.getRuns()]);
      setData(status); setRuns(runHistory);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  const loadIdea = async (id: number) => { try { setSelectedIdea(await scriptEngineApi.getIdea(id)); } catch (e) { console.error(e); } };
  const loadAllIdeas = async (status?: string) => { try { setAllIdeas(await scriptEngineApi.getIdeas(status)); } catch (e) { console.error(e); } };
  const loadAllBriefs = async () => { try { setAllBriefs(await scriptEngineApi.getBriefs()); } catch (e) { console.error(e); } };
  const loadAllScripts = async () => { try { setAllScripts(await scriptEngineApi.getScripts()); } catch (e) { console.error(e); } };
  const loadScript = async (id: number) => { try { setSelectedScript(await scriptEngineApi.getScript(id)); } catch (e) { console.error(e); } };
  const updateScriptStatus = async (id: number, status: string) => {
    try {
      await scriptEngineApi.updateScriptStatus(id, status);
      setSelectedScript((prev: any) => prev ? { ...prev, status } : prev);
      setAllScripts(prev => prev ? prev.map((s: any) => s.id === id ? { ...s, status } : s) : prev);
    } catch (e) { console.error(e); }
  };

  const sparkData = useMemo(() => {
    if (!runs.length) return { ideas: [], duration: [], errors: [] };
    const sorted = [...runs].reverse();
    return { ideas: sorted.map(r => r.total_ideas || 0), duration: sorted.map(r => r.duration_sec || 0), errors: sorted.map(r => r.errors_count || 0) };
  }, [runs]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Connecting...</div></div>;
  if (!data) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div style={{ padding: '20px', borderRadius: '6px', background: 'color-mix(in srgb, var(--red) 8%, var(--bg-elevated))', border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)', fontSize: '11px', color: 'var(--red)' }}>Pipeline unreachable</div></div>;

  // Idea detail view
  if (selectedIdea) return (
    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
      <button onClick={() => setSelectedIdea(null)} style={{ fontSize: '10px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>&larr; Back</button>
      <PNL style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '8px', fontWeight: 700, padding: '2px 8px', borderRadius: '3px', textTransform: 'uppercase', background: `color-mix(in srgb, ${S[selectedIdea.idea.status] || 'var(--text-muted)'} 15%, transparent)`, color: S[selectedIdea.idea.status] || 'var(--text-muted)' }}>{selectedIdea.idea.status}</span>
          <span style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 600 }}>{selectedIdea.idea.source}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{selectedIdea.idea.confidence}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{ts(selectedIdea.idea.created_at)}</span>
        </div>
        <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 10px', lineHeight: 1.3 }}>{selectedIdea.idea.title}</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 16px', borderLeft: '2px solid var(--gold)', paddingLeft: '12px' }}>{selectedIdea.idea.hook}</p>
        {selectedIdea.idea.content_points && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Content Points</div>
            {(typeof selectedIdea.idea.content_points === 'string' ? JSON.parse(selectedIdea.idea.content_points) : selectedIdea.idea.content_points)?.map((pt: string, i: number) => (
              <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 0', lineHeight: 1.5 }}>{pt}</div>
            ))}
          </div>
        )}
        {selectedIdea.brief && (
          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Research Brief</span>
              <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', textTransform: 'uppercase', background: selectedIdea.brief.verdict === 'rejected' ? 'color-mix(in srgb, var(--red) 15%, transparent)' : 'color-mix(in srgb, var(--green) 15%, transparent)', color: selectedIdea.brief.verdict === 'rejected' ? 'var(--red)' : 'var(--green)' }}>{selectedIdea.brief.verdict}</span>
              <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{selectedIdea.brief.full_brief?.length?.toLocaleString()} chars</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '14px', padding: '10px 12px', background: 'color-mix(in srgb, var(--gold) 4%, var(--bg-base))', borderRadius: '4px', border: '1px solid var(--gold-border)' }}>{selectedIdea.brief.summary}</div>
            <MdRenderer content={selectedIdea.brief.full_brief} />
          </div>
        )}
      </PNL>
    </div>
  );

  // All ideas view
  if (viewMode === 'ideas') return (
    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <button onClick={() => { setViewMode('dashboard'); setAllIdeas(null); }} style={{ fontSize: '10px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>&larr; Dashboard</button>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>All Ideas</span>
        <div style={{ flex: 1 }} />
        {['', 'researched', 'rejected', 'new', 'duplicate'].map(f => (
          <button key={f} onClick={() => loadAllIdeas(f || undefined)} style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{f || 'All'}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {(allIdeas || data.recentIdeas)?.map((idea: any) => (
          <div key={idea.id} onClick={() => loadIdea(idea.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', cursor: 'pointer', borderRadius: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '22px' }}>#{idea.id}</span>
            <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: `color-mix(in srgb, ${S[idea.status] || 'var(--text-muted)'} 15%, transparent)`, color: S[idea.status] || 'var(--text-muted)', textTransform: 'uppercase', width: '62px', textAlign: 'center' }}>{idea.status}</span>
            <span style={{ fontSize: '8px', color: 'var(--gold)', fontWeight: 700, width: '30px' }}>{SRC[idea.source] || idea.source}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idea.title}</span>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', flexShrink: 0 }}>{ago(idea.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Script detail view
  if (selectedScript) return (
    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <button onClick={() => setSelectedScript(null)} style={{ fontSize: '10px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>&larr; Scripts</button>
        <span style={{ fontSize: '8px', fontWeight: 700, padding: '2px 8px', borderRadius: '3px', textTransform: 'uppercase', background: selectedScript.status === 'approved' ? 'color-mix(in srgb, var(--green) 15%, transparent)' : selectedScript.status === 'rejected' ? 'color-mix(in srgb, var(--red) 15%, transparent)' : 'color-mix(in srgb, var(--gold) 15%, transparent)', color: selectedScript.status === 'approved' ? 'var(--green)' : selectedScript.status === 'rejected' ? 'var(--red)' : 'var(--gold)' }}>{selectedScript.status}</span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>draft {selectedScript.draft_number} · {selectedScript.word_count}w · {selectedScript.model_used}</span>
        <div style={{ flex: 1 }} />
        {selectedScript.status !== 'approved' && (
          <button onClick={() => updateScriptStatus(selectedScript.id, 'approved')} style={{ padding: '4px 12px', background: 'color-mix(in srgb, var(--green) 15%, transparent)', color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>Approve</button>
        )}
        {selectedScript.status !== 'rejected' && (
          <button onClick={() => updateScriptStatus(selectedScript.id, 'rejected')} style={{ padding: '4px 12px', background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>Reject</button>
        )}
      </div>
      <PNL style={{ padding: '20px', marginBottom: '8px' }}>
        <div style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{SRC[selectedScript.source] || selectedScript.source}</div>
        <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 8px', lineHeight: 1.3 }}>{selectedScript.title}</h2>
        {selectedScript.hook && (
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0', borderLeft: '2px solid var(--gold)', paddingLeft: '10px' }}>{selectedScript.hook}</p>
        )}
      </PNL>
      <PNL label="Script">
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', padding: '4px 0' }}>
          {selectedScript.script_text}
        </div>
      </PNL>
    </div>
  );

  // All scripts view
  if (viewMode === 'scripts') return (
    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <button onClick={() => { setViewMode('dashboard'); setAllScripts(null); }} style={{ fontSize: '10px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>&larr; Dashboard</button>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Scripts ({allScripts?.length ?? '…'})</span>
        <div style={{ flex: 1 }} />
        {['draft', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => loadAllScripts()} style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{f}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {(allScripts || []).map((s: any) => (
          <div key={s.id} onClick={() => loadScript(s.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '22px' }}>#{s.id}</span>
            <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase', width: '72px', textAlign: 'center', background: s.status === 'approved' ? 'color-mix(in srgb, var(--green) 15%, transparent)' : s.status === 'rejected' ? 'color-mix(in srgb, var(--red) 15%, transparent)' : s.status === 'needs_review' ? 'color-mix(in srgb, var(--red) 10%, transparent)' : 'color-mix(in srgb, var(--gold) 15%, transparent)', color: s.status === 'approved' ? 'var(--green)' : s.status === 'rejected' ? 'var(--red)' : s.status === 'needs_review' ? 'var(--red)' : 'var(--gold)' }}>{s.status}</span>
            <span style={{ fontSize: '8px', color: 'var(--gold)', fontWeight: 700, width: '30px' }}>{SRC[s.source] || s.source}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', flexShrink: 0 }}>{s.word_count}w</span>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '6px' }}>{ago(s.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // All briefs view
  if (viewMode === 'briefs') return (
    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <button onClick={() => { setViewMode('dashboard'); setAllBriefs(null); }} style={{ fontSize: '10px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>&larr; Dashboard</button>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>All Research Briefs ({allBriefs?.length || data.briefStats?.total || 0})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {(allBriefs || data.recentBriefs)?.map((b: any) => (
          <div key={b.id} onClick={() => loadIdea(b.idea_id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', cursor: 'pointer', borderRadius: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
            <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase', background: b.verdict === 'rejected' ? 'color-mix(in srgb, var(--red) 15%, transparent)' : 'color-mix(in srgb, var(--green) 15%, transparent)', color: b.verdict === 'rejected' ? 'var(--red)' : 'var(--green)', width: '62px', textAlign: 'center' }}>{b.verdict}</span>
            <span style={{ fontSize: '8px', color: 'var(--gold)', fontWeight: 700, width: '30px' }}>{SRC[b.source] || b.source}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', flexShrink: 0 }}>{ago(b.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const run = data.runs?.[0];
  const totalIdeas = data.ideaStats?.reduce((s: number, i: any) => s + i.count, 0) || 0;
  const researchedCount = data.ideaStats?.find((s: any) => s.status === 'researched')?.count || 0;
  const rejectedCount = data.ideaStats?.find((s: any) => s.status === 'rejected')?.count || 0;
  const vs = data.videoStats || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontVariantNumeric: 'tabular-nums' }}>

      {/* ═══ PIPELINE FLOW — Stage Overview ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 20px 1fr 20px 1fr 20px 1fr', alignItems: 'center', gap: '0' }}>
        {[
          { stage: '1', label: 'IDEA', desc: '7 sources → ideas', count: totalIdeas, color: 'var(--gold)' },
          null,
          { stage: '2', label: 'RESEARCH', desc: 'validate + evidence', count: data.briefStats?.total || 0, color: 'var(--green)' },
          null,
          { stage: '3', label: 'WRITE', desc: 'fine-tuned model', count: data.scriptStats?.total || 0, color: 'var(--col-script)' },
          null,
          { stage: '4', label: 'CRITIC', desc: 'score + rewrite', count: data.critiqueStats?.total || 0, color: 'var(--col-editing)' },
        ].map((item, i) => item ? (
          <PNL key={i} style={{ padding: '8px 12px', textAlign: 'center', borderColor: `color-mix(in srgb, ${item.color} 30%, var(--border-default))` }}>
            <div style={{ fontSize: '8px', fontWeight: 800, color: item.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Stage {item.stage}</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0' }}>{item.label}</div>
            <div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{item.desc}</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: item.color, marginTop: '4px' }}>{item.count}</div>
          </PNL>
        ) : (
          <div key={i} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>→</div>
        ))}
      </div>

      {/* ═══ EXTERNAL LINKS ═══ */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {[
          { label: 'GitHub', url: 'https://github.com/knavishmantis/script-engine', icon: '⟨/⟩' },
          { label: 'Vertex AI Tuning', url: 'https://console.cloud.google.com/vertex-ai/generative/language/locations/us-central1/tuning?project=knavishmantis', icon: '◆' },
          { label: 'GCS Bucket', url: 'https://console.cloud.google.com/storage/browser/knavishmantis-script-engine?project=knavishmantis', icon: '▣' },
          { label: 'Cloud SQL', url: 'https://console.cloud.google.com/sql/instances/video-pipeline-shared/databases?project=knavishmantis', icon: '⛁' },
          { label: 'GCP Billing', url: 'https://console.cloud.google.com/billing?project=knavishmantis', icon: '$' },
        ].map(link => (
          <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" style={{
            fontSize: '9px', padding: '4px 10px', borderRadius: '4px', textDecoration: 'none',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            <span>{link.icon}</span> {link.label}
          </a>
        ))}
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px', fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: run?.errors_count > 0 ? 'var(--red)' : 'var(--green)', boxShadow: `0 0 6px ${run?.errors_count > 0 ? 'var(--red)' : 'var(--green)'}` }} />
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>PIPELINE</span>
          <span style={{ color: run?.errors_count > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{run?.status === 'completed' ? 'HEALTHY' : run?.status || '—'}</span>
        </div>
        <div style={{ width: '1px', height: '14px', background: 'var(--border-default)' }} />
        <span style={{ color: 'var(--text-muted)' }}>Last run <strong style={{ color: 'var(--text-primary)' }}>{ago(run?.started_at)}</strong></span>
        <span style={{ color: 'var(--text-muted)' }}>Duration <strong style={{ color: 'var(--text-primary)' }}>{dur(run?.duration_sec)}</strong></span>
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-muted)' }}>{totalIdeas} ideas</span>
        <span style={{ color: 'var(--text-muted)' }}>{data.briefStats?.total || 0} briefs</span>
        <span style={{ color: 'var(--text-muted)' }}>{data.scriptStats?.total || 0} scripts</span>
        <span style={{ color: 'var(--text-muted)' }}>{n(vs.shorts)} videos</span>
      </div>

      {/* ═══ AGENT GRID + METRICS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '8px' }}>
        <PNL label={`Run #${run?.id || '—'} · ${ts(run?.started_at)} · ${run?.total_ideas || 0} ideas`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {data.latestSteps?.map((s: any) => {
              const ok = s.status === 'completed';
              return (
                <div key={s.agent} style={{ borderRadius: '4px', padding: '8px 4px', textAlign: 'center', background: 'var(--bg-base)', border: `1px solid ${ok ? 'var(--border-subtle)' : 'color-mix(in srgb, var(--red) 40%, var(--border-default))'}` }}>
                  <div style={{ fontSize: '8px', fontWeight: 800, color: ok ? 'var(--gold)' : 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{s.agent}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{s.ideas_generated}</div>
                  <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '3px' }}>{s.items_processed} · {dur(s.duration_sec)}</div>
                </div>
              );
            })}
          </div>
        </PNL>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <PNL style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flex: 1 }}>
            <Metric value={researchedCount} label="Researched" color="var(--green)" />
            <div style={{ width: '1px', height: '28px', background: 'var(--border-default)' }} />
            <Metric value={rejectedCount} label="Rejected" color="var(--red)" />
          </PNL>
          <PNL style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flex: 1 }}>
            <Metric value={data.briefStats?.validated || 0} label="Validated" color="var(--green)" />
            <div style={{ width: '1px', height: '28px', background: 'var(--border-default)' }} />
            <Metric value={data.briefStats?.total || 0} label="Briefs" />
          </PNL>
        </div>
      </div>

      {/* ═══ STATS ROW ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <PNL label="Ideas by Source">
          {data.ideaSources?.map((s: any) => (
            <div key={s.source} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--gold)', width: '32px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{SRC[s.source] || s.source}</span>
              <Bar value={s.count} max={data.ideaSources[0]?.count || 1} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)', width: '24px', textAlign: 'right' }}>{s.count}</span>
            </div>
          ))}
        </PNL>
        <PNL label="Data Collected">
          {[['Videos', n(vs.shorts), `${vs.shorts ? Math.round((vs.captions/vs.shorts)*100) : 0}%`], ['In GCS', n(vs.in_gcs), ''], ['Bugs', n(data.dataCounts?.bugs), ''], ['Reddit', n(data.dataCounts?.reddit), ''], ['Mods', n(data.dataCounts?.mods), ''], ['Versions', n(data.dataCounts?.versions), ''], ['Wiki', n(data.dataCounts?.wiki), '']].map(([l, v, s]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{l}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>{v}{s && <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginLeft: '4px' }}>{s}</span>}</span>
            </div>
          ))}
        </PNL>
        <PNL label="Trends (last runs)">
          {[['Ideas', sparkData.ideas, 'var(--gold)'], ['Duration', sparkData.duration, 'var(--blue)'], ['Errors', sparkData.errors, 'var(--red)']].map(([label, data, color]) => (
            <div key={label as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '50px' }}>{label as string}</span>
              <Spark data={data as number[]} color={color as string} w={100} h={18} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)', width: '28px', textAlign: 'right' }}>{label === 'Duration' ? dur((data as number[])[(data as number[]).length - 1] || 0) : (data as number[])[(data as number[]).length - 1] || 0}</span>
            </div>
          ))}
        </PNL>
      </div>

      {/* ═══ BOTTOM ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '8px' }}>
        <PNL label="Run History" style={{ maxHeight: '340px', overflow: 'auto' }}>
          {runs.map((r: any) => (
            <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: r.errors_count > 0 ? 'var(--red)' : 'var(--green)' }} />
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>#{r.id}</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{ts(r.started_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '9px' }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{r.total_ideas}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{dur(r.duration_sec)}</span>
                </div>
              </div>
              {r.steps?.[0]?.agent && (
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                  {r.steps.filter((s: any) => s.agent).map((s: any, i: number) => (
                    <span key={i} style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '3px', background: 'var(--bg-base)', color: s.status === 'completed' ? 'var(--text-muted)' : 'var(--red)', fontWeight: 600 }}>{SRC[s.agent] || s.agent} {s.ideas_generated}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </PNL>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <PNL style={{ flex: 1, maxHeight: '160px', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent Ideas</span>
              <button onClick={() => { setViewMode('ideas'); loadAllIdeas(); }} style={{ fontSize: '8px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>View all {totalIdeas} →</button>
            </div>
            {data.recentIdeas?.map((idea: any) => (
              <div key={idea.id} onClick={() => loadIdea(idea.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '22px' }}>#{idea.id}</span>
                <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: `color-mix(in srgb, ${S[idea.status] || 'var(--text-muted)'} 15%, transparent)`, color: S[idea.status] || 'var(--text-muted)', textTransform: 'uppercase', width: '62px', textAlign: 'center' }}>{idea.status}</span>
                <span style={{ fontSize: '8px', color: 'var(--gold)', fontWeight: 700, width: '30px' }}>{SRC[idea.source] || idea.source}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idea.title}</span>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', flexShrink: 0 }}>{ago(idea.created_at)}</span>
              </div>
            ))}
          </PNL>

          <PNL style={{ flex: 1, maxHeight: '160px', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Scripts</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '8px', color: 'var(--green)' }}>{data.scriptStats?.approved || 0} approved</span>
                <button onClick={() => { setViewMode('scripts'); loadAllScripts(); }} style={{ fontSize: '8px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>View all {data.scriptStats?.total || 0} →</button>
              </div>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total written</span><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{data.scriptStats?.total || 0}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Draft</span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>{data.scriptStats?.draft || 0}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Approved</span><span style={{ color: 'var(--green)', fontWeight: 700 }}>{data.scriptStats?.approved || 0}</span></div>
              {(data.scriptStats?.needs_review || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Needs Review</span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>{data.scriptStats.needs_review}</span></div>}
              {(data.critiqueStats?.total || 0) > 0 && <>
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Critiques run</span><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{data.critiqueStats.total}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Avg score</span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>{data.critiqueStats.avg_score}/10</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Rewrites</span><span style={{ color: 'var(--red)', fontWeight: 700 }}>{data.critiqueStats.rewrites}</span></div>
              </>}
            </div>
          </PNL>

          <PNL style={{ flex: 1, maxHeight: '160px', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Research Briefs</span>
              <button onClick={() => { setViewMode('briefs'); loadAllBriefs(); }} style={{ fontSize: '8px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>View all {data.briefStats?.total || 0} →</button>
            </div>
            {data.recentBriefs?.map((b: any) => (
              <div key={b.id} onClick={() => loadIdea(b.idea_id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase', background: b.verdict === 'rejected' ? 'color-mix(in srgb, var(--red) 15%, transparent)' : 'color-mix(in srgb, var(--green) 15%, transparent)', color: b.verdict === 'rejected' ? 'var(--red)' : 'var(--green)', width: '62px', textAlign: 'center' }}>{b.verdict}</span>
                <span style={{ fontSize: '8px', color: 'var(--gold)', fontWeight: 700, width: '30px' }}>{SRC[b.source] || b.source}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', flexShrink: 0 }}>{ago(b.created_at)}</span>
              </div>
            ))}
          </PNL>
        </div>
      </div>

      {/* ═══ PIPELINE STATUS BAR ═══ */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {data.ideaStats?.map((s: any) => (
          <div key={s.status} style={{
            flex: Math.max(s.count, 3), padding: '4px 6px', borderRadius: '4px', textAlign: 'center', overflow: 'hidden',
            background: `color-mix(in srgb, ${S[s.status] || 'var(--text-muted)'} 10%, var(--bg-elevated))`,
            border: `1px solid color-mix(in srgb, ${S[s.status] || 'var(--text-muted)'} 20%, transparent)`,
          }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: S[s.status] || 'var(--text-muted)' }}>{s.count} </span>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
