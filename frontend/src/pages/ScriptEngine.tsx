import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { scriptEngineApi } from '../services/api';

const S: Record<string, string> = { researched: 'var(--green)', approved: 'var(--blue)', rejected: 'var(--red)', duplicate: 'var(--text-muted)', new: 'var(--gold)', scripted: 'var(--col-script)', published: 'var(--col-uploaded)' };
const SRC: Record<string, string> = { code: 'CODE', youtube: 'YT', reddit: 'RDT', bugs: 'BUGS', mods: 'MODS', wiki: 'WIKI', minecraft: 'MC' };

const p = (d: string) => { if (!d) return null; const x = new Date(d); return !d.includes('Z') && !d.includes('+') && !d.includes('T') ? new Date(d + 'Z') : x; };
const dur = (s: number | null) => !s ? '—' : s < 60 ? `${s}s` : `${Math.round(s / 60)}m`;
const ago = (d: string) => { const x = p(d); if (!x) return '—'; const m = Math.floor((Date.now() - x.getTime()) / 60000); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m/60)}h` : `${Math.floor(m/1440)}d`; };
const ts = (d: string) => { const x = p(d); return x ? x.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'; };
const n = (v: number) => v?.toLocaleString() || '0';

// Mini sparkline SVG
function Spark({ data, color = 'var(--gold)', h = 20, w = 80 }: { data: number[]; color?: string; h?: number; w?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 2)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Tiny progress bar
function Bar({ value, max, color = 'var(--gold)' }: { value: number; max: number; color?: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: '3px', borderRadius: '2px', background: 'var(--border-default)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px' }} />
    </div>
  );
}

const PNL = ({ children, label, style }: { children: React.ReactNode; label?: string; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '10px 12px', ...style }}>
    {label && <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', lineHeight: 1 }}>{label}</div>}
    {children}
  </div>
);

const Metric = ({ value, label, color, sub }: { value: string | number; label: string; color?: string; sub?: string }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '20px', fontWeight: 800, color: color || 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    {sub && <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>{sub}</div>}
  </div>
);

export default function ScriptEngine() {
  const [data, setData] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<any>(null);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    try {
      const [status, runHistory] = await Promise.all([scriptEngineApi.getStatus(), scriptEngineApi.getRuns()]);
      setData(status);
      setRuns(runHistory);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  const loadIdea = async (id: number) => { try { setSelectedIdea(await scriptEngineApi.getIdea(id)); } catch (e) { console.error(e); } };

  // Compute sparkline data from run history
  const sparkData = useMemo(() => {
    if (!runs.length) return { ideas: [], duration: [], errors: [] };
    const sorted = [...runs].reverse();
    return {
      ideas: sorted.map(r => r.total_ideas || 0),
      duration: sorted.map(r => r.duration_sec || 0),
      errors: sorted.map(r => r.errors_count || 0),
    };
  }, [runs]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Connecting to pipeline...</div>
    </div>
  );
  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ padding: '20px', borderRadius: '6px', background: 'color-mix(in srgb, var(--red) 8%, var(--bg-elevated))', border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)', fontSize: '11px', color: 'var(--red)' }}>Pipeline unreachable</div>
    </div>
  );

  if (selectedIdea) return <IdeaDetail idea={selectedIdea} onBack={() => setSelectedIdea(null)} />;

  const run = data.runs?.[0];
  const totalIdeas = data.ideaStats?.reduce((s: number, i: any) => s + i.count, 0) || 0;
  const researchedCount = data.ideaStats?.find((s: any) => s.status === 'researched')?.count || 0;
  const rejectedCount = data.ideaStats?.find((s: any) => s.status === 'rejected')?.count || 0;
  const vs = data.videoStats || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontVariantNumeric: 'tabular-nums' }}>

      {/* ═══ STATUS BAR ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px', fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: run?.errors_count > 0 ? 'var(--red)' : 'var(--green)', boxShadow: `0 0 6px ${run?.errors_count > 0 ? 'var(--red)' : 'var(--green)'}` }} />
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>PIPELINE</span>
          <span style={{ color: run?.errors_count > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{run?.status === 'completed' ? 'HEALTHY' : run?.status || 'UNKNOWN'}</span>
        </div>
        <div style={{ width: '1px', height: '14px', background: 'var(--border-default)' }} />
        <span style={{ color: 'var(--text-muted)' }}>Last run <strong style={{ color: 'var(--text-primary)' }}>{ago(run?.started_at)}</strong></span>
        <span style={{ color: 'var(--text-muted)' }}>Duration <strong style={{ color: 'var(--text-primary)' }}>{dur(run?.duration_sec)}</strong></span>
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-muted)' }}>{totalIdeas} ideas</span>
        <span style={{ color: 'var(--text-muted)' }}>{data.briefStats?.total || 0} briefs</span>
        <span style={{ color: 'var(--text-muted)' }}>{n(vs.shorts)} videos</span>
      </div>

      {/* ═══ AGENT GRID + METRICS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '8px' }}>
        {/* Agent cards */}
        <PNL label={`Run #${run?.id || '—'} · ${ts(run?.started_at)} · ${run?.total_ideas || 0} ideas · ${run?.duplicates_removed || 0} dupes`}>
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

        {/* Key metrics column */}
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

      {/* ═══ STATS ROW: Sources + Data + Trends ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>

        {/* Ideas by source */}
        <PNL label="Ideas by Source">
          {data.ideaSources?.map((s: any) => {
            const max = data.ideaSources[0]?.count || 1;
            return (
              <div key={s.source} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--gold)', width: '32px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{SRC[s.source] || s.source}</span>
                <Bar value={s.count} max={max} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)', width: '24px', textAlign: 'right' }}>{s.count}</span>
              </div>
            );
          })}
        </PNL>

        {/* Data collection */}
        <PNL label="Data Collected">
          {[
            ['Videos', n(vs.shorts), `${vs.shorts ? Math.round((vs.captions/vs.shorts)*100) : 0}% capt`],
            ['In GCS', n(vs.in_gcs), `${vs.shorts ? Math.round((vs.in_gcs/vs.shorts)*100) : 0}%`],
            ['Bugs', n(data.dataCounts?.bugs), ''],
            ['Reddit', n(data.dataCounts?.reddit), ''],
            ['Mods', n(data.dataCounts?.mods), ''],
            ['Versions', n(data.dataCounts?.versions), ''],
            ['Wiki', n(data.dataCounts?.wiki), ''],
          ].map(([label, val, sub]) => (
            <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>{val}</span>
                {sub && <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginLeft: '4px' }}>{sub}</span>}
              </div>
            </div>
          ))}
        </PNL>

        {/* Sparkline trends */}
        <PNL label="Trends (last runs)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '50px' }}>Ideas</span>
              <Spark data={sparkData.ideas} color="var(--gold)" w={100} h={18} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)', width: '28px', textAlign: 'right' }}>{sparkData.ideas[sparkData.ideas.length - 1] || 0}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '50px' }}>Duration</span>
              <Spark data={sparkData.duration} color="var(--blue)" w={100} h={18} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)', width: '28px', textAlign: 'right' }}>{dur(sparkData.duration[sparkData.duration.length - 1] || 0)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '50px' }}>Errors</span>
              <Spark data={sparkData.errors} color="var(--red)" w={100} h={18} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: sparkData.errors[sparkData.errors.length - 1] > 0 ? 'var(--red)' : 'var(--text-primary)', width: '28px', textAlign: 'right' }}>{sparkData.errors[sparkData.errors.length - 1] || 0}</span>
            </div>
          </div>
        </PNL>
      </div>

      {/* ═══ BOTTOM: Run History + Ideas + Briefs ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '8px' }}>

        {/* Run history */}
        <PNL label="Run History" style={{ maxHeight: '340px', overflow: 'auto' }}>
          {runs.map((r: any) => (
            <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: r.errors_count > 0 ? 'var(--red)' : r.status === 'completed' ? 'var(--green)' : 'var(--status-active)' }} />
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
                    <span key={i} style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '3px', background: 'var(--bg-base)', color: s.status === 'completed' ? 'var(--text-muted)' : 'var(--red)', fontWeight: 600 }}>
                      {SRC[s.agent] || s.agent} {s.ideas_generated}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </PNL>

        {/* Recent ideas + briefs combined */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <PNL label={`Recent Ideas (${totalIdeas} total)`} style={{ flex: 1, maxHeight: '160px', overflow: 'auto' }}>
            {data.recentIdeas?.map((idea: any) => (
              <div key={idea.id} onClick={() => loadIdea(idea.id)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', cursor: 'pointer',
                borderBottom: '1px solid var(--border-subtle)',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '22px' }}>#{idea.id}</span>
                <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: `color-mix(in srgb, ${S[idea.status] || 'var(--text-muted)'} 15%, transparent)`, color: S[idea.status] || 'var(--text-muted)', textTransform: 'uppercase', width: '62px', textAlign: 'center' }}>{idea.status}</span>
                <span style={{ fontSize: '8px', color: 'var(--gold)', fontWeight: 700, width: '30px' }}>{SRC[idea.source] || idea.source}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idea.title}</span>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', flexShrink: 0 }}>{ago(idea.created_at)}</span>
              </div>
            ))}
          </PNL>

          <PNL label={`Research Briefs (${data.briefStats?.total || 0} total)`} style={{ flex: 1, maxHeight: '160px', overflow: 'auto' }}>
            {data.recentBriefs?.map((b: any) => (
              <div key={b.id} onClick={() => loadIdea(b.idea_id)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', cursor: 'pointer',
                borderBottom: '1px solid var(--border-subtle)',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{
                  fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase',
                  background: b.verdict === 'rejected' ? 'color-mix(in srgb, var(--red) 15%, transparent)' : 'color-mix(in srgb, var(--green) 15%, transparent)',
                  color: b.verdict === 'rejected' ? 'var(--red)' : 'var(--green)', width: '62px', textAlign: 'center',
                }}>{b.verdict}</span>
                <span style={{ fontSize: '8px', color: 'var(--gold)', fontWeight: 700, width: '30px' }}>{SRC[b.source] || b.source}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', flexShrink: 0 }}>{ago(b.created_at)}</span>
              </div>
            ))}
          </PNL>
        </div>
      </div>

      {/* ═══ PIPELINE STATUS BAR ═══ */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {data.ideaStats?.map((s: any) => {
          const pct = totalIdeas ? Math.round((s.count / totalIdeas) * 100) : 0;
          return (
            <div key={s.status} style={{
              flex: s.count, minWidth: '40px', padding: '4px 8px', borderRadius: '4px', textAlign: 'center',
              background: `color-mix(in srgb, ${S[s.status] || 'var(--text-muted)'} 10%, var(--bg-elevated))`,
              border: `1px solid color-mix(in srgb, ${S[s.status] || 'var(--text-muted)'} 20%, transparent)`,
            }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: S[s.status] || 'var(--text-muted)' }}>{s.count}</span>
              <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginLeft: '4px' }}>{s.status} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IdeaDetail({ idea, onBack }: { idea: any; onBack: () => void }) {
  return (
    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
      <button onClick={onBack} style={{ fontSize: '10px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>&larr; Dashboard</button>
      <PNL style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '8px', fontWeight: 700, padding: '2px 8px', borderRadius: '3px', textTransform: 'uppercase', background: `color-mix(in srgb, ${S[idea.idea.status] || 'var(--text-muted)'} 15%, transparent)`, color: S[idea.idea.status] || 'var(--text-muted)' }}>{idea.idea.status}</span>
          <span style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 600 }}>{idea.idea.source}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{idea.idea.confidence}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{ts(idea.idea.created_at)}</span>
        </div>
        <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 10px', lineHeight: 1.3 }}>{idea.idea.title}</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 16px', borderLeft: '2px solid var(--gold)', paddingLeft: '12px' }}>{idea.idea.hook}</p>

        {idea.idea.content_points && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Content Points</div>
            {(typeof idea.idea.content_points === 'string' ? JSON.parse(idea.idea.content_points) : idea.idea.content_points)?.map((pt: string, i: number) => (
              <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 0', lineHeight: 1.5 }}>{pt}</div>
            ))}
          </div>
        )}

        {idea.brief && (
          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Research Brief</span>
              <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', textTransform: 'uppercase', background: idea.brief.verdict === 'rejected' ? 'color-mix(in srgb, var(--red) 15%, transparent)' : 'color-mix(in srgb, var(--green) 15%, transparent)', color: idea.brief.verdict === 'rejected' ? 'var(--red)' : 'var(--green)' }}>{idea.brief.verdict}</span>
              <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{idea.brief.full_brief?.length?.toLocaleString()} chars</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '14px', padding: '10px 12px', background: 'color-mix(in srgb, var(--gold) 4%, var(--bg-base))', borderRadius: '4px', border: '1px solid var(--gold-border)' }}>{idea.brief.summary}</div>
            <div className="script-engine-md" style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.7, padding: '16px', background: 'var(--bg-base)', borderRadius: '4px', border: '1px solid var(--border-default)', maxHeight: '600px', overflow: 'auto' }}>
              <ReactMarkdown
                components={{
                  h1: ({children}) => <h1 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: '16px 0 8px', letterSpacing: '-0.02em' }}>{children}</h1>,
                  h2: ({children}) => <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</h2>,
                  h3: ({children}) => <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: '10px 0 4px' }}>{children}</h3>,
                  p: ({children}) => <p style={{ margin: '4px 0', lineHeight: 1.7 }}>{children}</p>,
                  li: ({children}) => <li style={{ margin: '2px 0', lineHeight: 1.6 }}>{children}</li>,
                  code: ({children, className}) => className ? (
                    <pre style={{ background: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: '4px', overflow: 'auto', fontSize: '10px', border: '1px solid var(--border-default)', margin: '6px 0' }}><code>{children}</code></pre>
                  ) : (
                    <code style={{ background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', color: 'var(--gold)' }}>{children}</code>
                  ),
                  table: ({children}) => <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', margin: '6px 0' }}>{children}</table>,
                  th: ({children}) => <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '9px', textTransform: 'uppercase' }}>{children}</th>,
                  td: ({children}) => <td style={{ padding: '3px 8px', borderBottom: '1px solid var(--border-subtle)' }}>{children}</td>,
                  strong: ({children}) => <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{children}</strong>,
                  a: ({children, href}) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>{children}</a>,
                  blockquote: ({children}) => <blockquote style={{ borderLeft: '2px solid var(--gold)', paddingLeft: '10px', margin: '6px 0', color: 'var(--text-muted)' }}>{children}</blockquote>,
                }}
              >{idea.brief.full_brief}</ReactMarkdown>
            </div>
          </div>
        )}
      </PNL>
    </div>
  );
}
