import { useState, useEffect } from 'react';
import { scriptEngineApi } from '../services/api';

const STATUS_COLORS: Record<string, string> = {
  researched: 'var(--green)',
  approved: 'var(--blue)',
  rejected: 'var(--red)',
  duplicate: 'var(--text-muted)',
  new: 'var(--gold)',
  scripted: 'var(--col-script)',
  published: 'var(--col-uploaded)',
};

const SOURCE_LABELS: Record<string, string> = {
  code: 'Source Code',
  youtube: 'YouTube',
  reddit: 'Reddit',
  bugs: 'Bug Tracker',
  mods: 'Modrinth',
  wiki: 'Wiki',
  minecraft: 'Changelogs',
};

// Parse DB timestamp as UTC (PostgreSQL returns without timezone suffix)
const parseUTC = (date: string) => {
  if (!date) return null;
  const d = new Date(date);
  // If the string doesn't have timezone info, treat as UTC
  if (!date.includes('Z') && !date.includes('+') && !date.includes('T')) {
    return new Date(date + 'Z');
  }
  return d;
};

export default function ScriptEngine() {
  const [data, setData] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<any>(null);
  const [tab, setTab] = useState<'overview' | 'ideas' | 'research' | 'runs'>('overview');
  const [ideaFilter, setIdeaFilter] = useState<string>('');
  const [allIdeas, setAllIdeas] = useState<any[] | null>(null);
  const [showAllIdeas, setShowAllIdeas] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [status, runHistory] = await Promise.all([
        scriptEngineApi.getStatus(),
        scriptEngineApi.getRuns(),
      ]);
      setData(status);
      setRuns(runHistory);
    } catch (error) {
      console.error('Failed to load script engine data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllIdeas = async (status?: string) => {
    try {
      const ideas = await scriptEngineApi.getIdeas(status);
      setAllIdeas(ideas);
      setShowAllIdeas(true);
    } catch (error) {
      console.error('Failed to load all ideas:', error);
    }
  };

  const loadIdea = async (id: number) => {
    try {
      const idea = await scriptEngineApi.getIdea(id);
      setSelectedIdea(idea);
    } catch (error) {
      console.error('Failed to load idea:', error);
    }
  };

  const fmt = {
    dur: (secs: number | null) => {
      if (!secs) return '—';
      if (secs < 60) return `${secs}s`;
      return `${Math.round(secs / 60)}m`;
    },
    ago: (date: string) => {
      const d = parseUTC(date);
      if (!d) return '—';
      const diff = Date.now() - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    },
    date: (date: string) => {
      const d = parseUTC(date);
      if (!d) return '—';
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    },
    num: (n: number) => n?.toLocaleString() || '0',
    pct: (a: number, b: number) => b ? `${Math.round((a / b) * 100)}%` : '—',
  };

  const StatusBadge = ({ status }: { status: string }) => (
    <span style={{
      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
      textTransform: 'uppercase', letterSpacing: '0.03em',
      background: `color-mix(in srgb, ${STATUS_COLORS[status] || 'var(--text-muted)'} 12%, transparent)`,
      color: STATUS_COLORS[status] || 'var(--text-muted)',
    }}>{status}</span>
  );

  const VerdictBadge = ({ verdict }: { verdict: string }) => {
    const isGood = verdict !== 'rejected';
    return (
      <span style={{
        fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
        textTransform: 'uppercase', letterSpacing: '0.04em',
        background: isGood ? 'color-mix(in srgb, var(--green) 12%, transparent)' : 'color-mix(in srgb, var(--red) 12%, transparent)',
        color: isGood ? 'var(--green)' : 'var(--red)',
      }}>{verdict}</span>
    );
  };

  const SectionLabel = ({ children }: { children: string }) => (
    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
      {children}
    </div>
  );

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{
      borderRadius: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
      boxShadow: 'var(--card-shadow)', ...style,
    }}>{children}</div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
        <div style={{ textAlign: 'center', padding: '32px', borderRadius: '12px', background: 'color-mix(in srgb, var(--red) 8%, var(--bg-elevated))', border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--red)', marginBottom: '4px' }}>Connection Failed</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Could not reach the script engine database</div>
        </div>
      </div>
    );
  }

  const latestRun = data.runs?.[0];
  const totalIdeas = data.ideaStats?.reduce((s: number, i: any) => s + i.count, 0) || 0;
  const displayIdeas = showAllIdeas && allIdeas ? allIdeas : data.recentIdeas || [];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', margin: 0 }}>
            Script Engine
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {totalIdeas} ideas · {data.briefStats?.total || 0} researched · last run {latestRun ? fmt.ago(latestRun.started_at) : 'never'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-elevated)', borderRadius: '10px', padding: '3px', border: '1px solid var(--border-default)' }}>
          {(['overview', 'ideas', 'research', 'runs'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSelectedIdea(null); setShowAllIdeas(false); }} style={{
              padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              border: 'none', transition: 'all 0.15s',
              background: tab === t ? 'var(--gold)' : 'transparent',
              color: tab === t ? 'var(--bg-base)' : 'var(--text-muted)',
            }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* ═══════════ OVERVIEW ═══════════ */}
      {tab === 'overview' && (
        <>
          {latestRun && (
            <Card style={{ padding: '20px 24px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: latestRun.errors_count > 0 ? 'var(--red)' : 'var(--green)',
                    boxShadow: `0 0 8px ${latestRun.errors_count > 0 ? 'var(--red)' : 'var(--green)'}`,
                  }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Run #{latestRun.id}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmt.date(latestRun.started_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}><strong style={{ color: 'var(--gold)', fontWeight: 800 }}>{latestRun.total_ideas}</strong> ideas</span>
                  <span style={{ color: 'var(--text-muted)' }}><strong style={{ fontWeight: 700 }}>{fmt.dur(latestRun.duration_sec)}</strong></span>
                  {latestRun.errors_count > 0 && <span style={{ color: 'var(--red)', fontWeight: 600 }}>{latestRun.errors_count} errors</span>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                {data.latestSteps?.map((s: any) => (
                  <div key={s.agent} style={{
                    borderRadius: '10px', padding: '12px', textAlign: 'center',
                    background: 'var(--bg-base)', border: `1px solid ${s.status === 'completed' ? 'var(--border-default)' : 'var(--red)'}`,
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: s.status === 'completed' ? 'var(--gold)' : 'var(--red)', marginBottom: '6px' }}>
                      {s.agent}
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '4px', letterSpacing: '-0.03em' }}>{s.ideas_generated}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.3 }}>{s.items_processed} items · {fmt.dur(s.duration_sec)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <Card style={{ padding: '18px 20px' }}>
              <SectionLabel>Pipeline Status</SectionLabel>
              {data.ideaStats?.map((s: any) => (
                <div key={s.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_COLORS[s.status] || 'var(--text-muted)' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{s.status}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
                </div>
              ))}
            </Card>

            <Card style={{ padding: '18px 20px' }}>
              <SectionLabel>By Source</SectionLabel>
              {data.ideaSources?.map((s: any) => {
                const maxCount = data.ideaSources[0]?.count || 1;
                return (
                  <div key={s.source} style={{ padding: '3px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{SOURCE_LABELS[s.source] || s.source}</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
                    </div>
                    <div style={{ height: '3px', borderRadius: '2px', background: 'var(--border-default)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '2px', background: 'var(--gold)', width: `${(s.count / maxCount) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </Card>

            <Card style={{ padding: '18px 20px' }}>
              <SectionLabel>Research</SectionLabel>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: '8px', background: 'color-mix(in srgb, var(--green) 8%, var(--bg-base))' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--green)', letterSpacing: '-0.03em' }}>{data.briefStats?.validated || 0}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>validated</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: '8px', background: 'color-mix(in srgb, var(--red) 6%, var(--bg-base))' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--red)', letterSpacing: '-0.03em' }}>{data.briefStats?.rejected || 0}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>rejected</div>
                </div>
              </div>
              <SectionLabel>Data Collected</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '12px' }}>
                {[
                  ['Videos', `${fmt.num(data.videoStats?.shorts)} (${fmt.pct(data.videoStats?.captions, data.videoStats?.shorts)})`],
                  ['Bugs', fmt.num(data.dataCounts?.bugs)],
                  ['Reddit', fmt.num(data.dataCounts?.reddit)],
                  ['Mods', fmt.num(data.dataCounts?.mods)],
                  ['Versions', fmt.num(data.dataCounts?.versions)],
                  ['Wiki', fmt.num(data.dataCounts?.wiki)],
                ].map(([label, val]) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ═══════════ IDEAS ═══════════ */}
      {tab === 'ideas' && (
        <div>
          {selectedIdea ? (
            <IdeaDetail idea={selectedIdea} fmt={fmt} onBack={() => setSelectedIdea(null)} StatusBadge={StatusBadge} VerdictBadge={VerdictBadge} />
          ) : (
            <>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                {['', 'researched', 'new', 'approved', 'rejected', 'duplicate'].map(f => (
                  <button key={f} onClick={() => { setIdeaFilter(f); if (f) loadAllIdeas(f); else { setShowAllIdeas(false); setAllIdeas(null); } }} style={{
                    padding: '4px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    border: 'none', transition: 'all 0.15s',
                    background: ideaFilter === f ? 'var(--gold)' : 'var(--bg-elevated)',
                    color: ideaFilter === f ? 'var(--bg-base)' : 'var(--text-muted)',
                  }}>{f || 'Recent'}</button>
                ))}
                {!showAllIdeas && (
                  <button onClick={() => loadAllIdeas()} style={{
                    padding: '4px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)',
                    marginLeft: 'auto',
                  }}>Show all ({totalIdeas})</button>
                )}
                {showAllIdeas && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {displayIdeas.length} ideas
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {displayIdeas.filter((i: any) => !ideaFilter || i.status === ideaFilter).map((idea: any) => (
                  <div key={idea.id} onClick={() => loadIdea(idea.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                    borderRadius: '10px', cursor: 'pointer', transition: 'all 0.12s',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                  >
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', width: '28px' }}>#{idea.id}</span>
                    <StatusBadge status={idea.status} />
                    <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 600, width: '72px' }}>{SOURCE_LABELS[idea.source] || idea.source}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, flex: 1, letterSpacing: '-0.01em' }}>{idea.title}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmt.ago(idea.created_at)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════ RESEARCH ═══════════ */}
      {tab === 'research' && (
        <div>
          {selectedIdea ? (
            <IdeaDetail idea={selectedIdea} fmt={fmt} onBack={() => setSelectedIdea(null)} StatusBadge={StatusBadge} VerdictBadge={VerdictBadge} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.recentBriefs?.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>No research briefs yet</div>
              )}
              {data.recentBriefs?.map((b: any) => (
                <Card key={b.id} style={{ padding: '16px 20px', cursor: 'pointer' }}>
                  <div onClick={() => loadIdea(b.idea_id)}
                    onMouseEnter={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'var(--gold-border)'; }}
                    onMouseLeave={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <VerdictBadge verdict={b.verdict} />
                      <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 600 }}>{SOURCE_LABELS[b.source] || b.source}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{fmt.ago(b.created_at)}</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '6px' }}>
                      {b.title}
                    </div>
                    {b.verdict_reason && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {b.verdict_reason.length > 200 ? b.verdict_reason.slice(0, 200) + '...' : b.verdict_reason}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ RUNS ═══════════ */}
      {tab === 'runs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {runs.map((run: any) => {
            const hasErrors = run.errors_count > 0;
            return (
              <Card key={run.id} style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: hasErrors ? 'var(--red)' : run.status === 'completed' ? 'var(--green)' : 'var(--status-active)',
                    }} />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Run #{run.id}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmt.date(run.started_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '14px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}><strong style={{ color: 'var(--gold)', fontWeight: 700 }}>{run.total_ideas}</strong> ideas</span>
                    <span style={{ color: 'var(--text-muted)' }}>{run.duplicates_removed} dupes</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{fmt.dur(run.duration_sec)}</span>
                    {hasErrors && <span style={{ color: 'var(--red)', fontWeight: 600 }}>{run.errors_count} errors</span>}
                  </div>
                </div>
                {run.steps?.[0]?.agent && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                    {run.steps.filter((s: any) => s.agent).map((s: any, i: number) => (
                      <div key={i} style={{
                        fontSize: '11px', padding: '8px 6px', borderRadius: '8px', textAlign: 'center',
                        background: 'var(--bg-base)', border: `1px solid ${s.status === 'completed' ? 'var(--border-subtle)' : 'color-mix(in srgb, var(--red) 30%, var(--border-default))'}`,
                      }}>
                        <div style={{ fontWeight: 700, color: s.status === 'completed' ? 'var(--gold)' : 'var(--red)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.agent}</div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px', margin: '2px 0' }}>{s.ideas_generated}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{s.items_processed} items · {fmt.dur(s.duration_sec)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Idea detail view (shared between Ideas and Research tabs)
function IdeaDetail({ idea, fmt, onBack, StatusBadge, VerdictBadge }: {
  idea: any; fmt: any; onBack: () => void;
  StatusBadge: React.FC<{ status: string }>; VerdictBadge: React.FC<{ verdict: string }>;
}) {
  return (
    <div>
      <button onClick={onBack} style={{
        fontSize: '12px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer',
        marginBottom: '16px', fontWeight: 600,
      }}>&larr; Back</button>
      <div style={{
        borderRadius: '14px', padding: '24px', background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <StatusBadge status={idea.idea.status} />
          <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 600 }}>{idea.idea.source}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{idea.idea.confidence} confidence</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{fmt.date(idea.idea.created_at)}</span>
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 12px', lineHeight: 1.3 }}>
          {idea.idea.title}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 20px', borderLeft: '3px solid var(--gold)', paddingLeft: '14px' }}>
          {idea.idea.hook}
        </p>

        {idea.idea.content_points && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Content Points</div>
            {(typeof idea.idea.content_points === 'string' ? JSON.parse(idea.idea.content_points) : idea.idea.content_points)?.map((p: string, i: number) => (
              <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '3px 0', lineHeight: 1.5 }}>
                {p}
              </div>
            ))}
          </div>
        )}

        {idea.brief && (
          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Research Brief</div>
              <VerdictBadge verdict={idea.brief.verdict} />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              {idea.brief.summary}
            </div>
            <details style={{ marginTop: '8px' }}>
              <summary style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, padding: '8px 0' }}>
                Full brief ({idea.brief.full_brief?.length?.toLocaleString()} chars)
              </summary>
              <div style={{
                fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginTop: '12px',
                maxHeight: '600px', overflow: 'auto', padding: '16px', background: 'var(--bg-base)',
                borderRadius: '10px', border: '1px solid var(--border-default)', lineHeight: 1.7,
              }}>
                {idea.brief.full_brief}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
