import React, { useState, useEffect, useMemo } from 'react';
import { researchApi, ResearchIdea } from '../services/api';

const CATEGORY_LABELS: Record<string, string> = {
  mechanic_deep_dive: 'Mechanic Deep Dive',
  opinionated_take: 'Opinionated Take',
  history: 'History',
  hypothetical: 'Hypothetical',
  practical_guide: 'Guide',
};

const SOURCE_COLORS: Record<string, string> = {
  youtube: '#c33',
  reddit: '#ff6314',
  minecraft: '#5a8f3c',
  mixed: 'var(--gold)',
};

type FilterMode = 'all' | 'new' | 'acknowledged';
type SortMode = 'score' | 'category' | 'source';

export default function Research() {
  const [ideas, setIdeas] = useState<ResearchIdea[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortMode>('score');

  useEffect(() => { fetchIdeas(); }, []);

  const fetchIdeas = async () => {
    try {
      const backlog = await researchApi.getBacklog();
      setIdeas(backlog.ideas || []);
      setLastUpdated(backlog.lastUpdated);
    } catch {} finally { setLoading(false); }
  };

  const handleAcknowledge = async (ideaId: string) => {
    if (!ideaId) return;
    try {
      const result = await researchApi.acknowledgeIdea(ideaId);
      setIdeas(prev => prev?.map(i =>
        i.ideaId === ideaId ? { ...i, acknowledged: result.acknowledged } : i
      ) || null);
    } catch (error) {
      console.error('Failed to acknowledge idea:', error);
    }
  };

  // Stats
  const stats = useMemo(() => {
    if (!ideas) return null;
    const total = ideas.length;
    const newCount = ideas.filter(i => !i.acknowledged).length;
    const ackCount = ideas.filter(i => i.acknowledged).length;
    const avgScore = total > 0 ? (ideas.reduce((sum, i) => sum + i.score, 0) / total).toFixed(1) : '0';
    const highCount = ideas.filter(i => i.score >= 8).length;
    return { total, newCount, ackCount, avgScore, highCount };
  }, [ideas]);

  // Available categories and sources for filters
  const categories = useMemo(() => {
    if (!ideas) return [];
    return [...new Set(ideas.map(i => i.category))];
  }, [ideas]);

  const sources = useMemo(() => {
    if (!ideas) return [];
    return [...new Set(ideas.map(i => i.sourceType))];
  }, [ideas]);

  // Filtered + sorted ideas
  const filteredIdeas = useMemo(() => {
    if (!ideas) return [];
    let result = [...ideas];

    // Status filter
    if (filter === 'new') result = result.filter(i => !i.acknowledged);
    if (filter === 'acknowledged') result = result.filter(i => i.acknowledged);

    // Category filter
    if (categoryFilter !== 'all') result = result.filter(i => i.category === categoryFilter);

    // Source filter
    if (sourceFilter !== 'all') result = result.filter(i => i.sourceType === sourceFilter);

    // Sort
    if (sortBy === 'score') result.sort((a, b) => b.score - a.score);
    if (sortBy === 'category') result.sort((a, b) => a.category.localeCompare(b.category));
    if (sortBy === 'source') result.sort((a, b) => a.sourceType.localeCompare(b.sourceType));

    return result;
  }, [ideas, filter, categoryFilter, sourceFilter, sortBy]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80, color: 'var(--text-muted)' }}>Loading...</div>;

  if (!ideas || ideas.length === 0) return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Research</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>No ideas yet. Run the research pipeline.</p>
      <code style={{ display: 'block', padding: 12, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--gold)', fontSize: 12 }}>
        cd idea-research && npm run pipeline
      </code>
    </div>
  );

  return (
    <div style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>Research</h1>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Updated {lastUpdated.split('T')[0]}
            </span>
          )}
        </div>

        {/* Stats bar */}
        {stats && (
          <div style={{
            display: 'flex',
            gap: 0,
            borderRadius: 10,
            overflow: 'hidden',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
          }}>
            {[
              { label: 'Total', value: stats.total, color: 'var(--text-primary)' },
              { label: 'New', value: stats.newCount, color: 'var(--gold)' },
              { label: 'Seen', value: stats.ackCount, color: 'var(--text-muted)' },
              { label: 'Avg Score', value: stats.avgScore, color: 'var(--text-primary)' },
              { label: 'Score 8+', value: stats.highCount, color: 'var(--green, #5a8f3c)' },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1,
                padding: '10px 0',
                textAlign: 'center',
                borderRight: i < 4 ? '1px solid var(--border-default)' : 'none',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        {ideas && ideas.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status filter */}
            <FilterGroup
              options={[
                { value: 'all', label: 'All' },
                { value: 'new', label: 'New' },
                { value: 'acknowledged', label: 'Seen' },
              ]}
              value={filter}
              onChange={(v) => setFilter(v as FilterMode)}
            />

            <div style={{ width: 1, height: 20, background: 'var(--border-default)' }} />

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
            >
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
            </select>

            {/* Source filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
            >
              <option value="all">All Sources</option>
              {sources.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
            >
              <option value="score">Sort: Score</option>
              <option value="category">Sort: Category</option>
              <option value="source">Sort: Source</option>
            </select>

            {/* Result count */}
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {filteredIdeas.length} idea{filteredIdeas.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Ideas */}
      {filteredIdeas.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredIdeas.map((idea, i) => (
            <IdeaCard
              key={idea.ideaId || i}
              idea={idea}
              onAcknowledge={handleAcknowledge}
            />
          ))}
        </div>
      ) : (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No ideas match the current filters.
        </div>
      )}
    </div>
  );
}

function IdeaCard({ idea, onAcknowledge }: { idea: ResearchIdea; onAcknowledge: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [acking, setAcking] = useState(false);
  const srcColor = SOURCE_COLORS[idea.sourceType] || 'var(--text-muted)';
  const isAcked = idea.acknowledged;

  const handleAck = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!idea.ideaId || acking) return;
    setAcking(true);
    await onAcknowledge(idea.ideaId);
    setAcking(false);
  };

  return (
    <div style={{
      borderRadius: 12,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      overflow: 'hidden',
      width: '100%',
      opacity: isAcked ? 0.55 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Collapsed row */}
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
      >
        <ScoreBadge score={idea.score} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
            {idea.title}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            <Pill>{CATEGORY_LABELS[idea.category] || idea.category}</Pill>
            <Pill style={{ borderColor: srcColor, color: srcColor }}>{idea.sourceType.toUpperCase()}</Pill>
            {idea.timeliness === 'time_sensitive' && (
              <Pill style={{ borderColor: 'var(--gold)', color: 'var(--gold)', background: 'var(--gold-dim)' }}>
                {idea.timeWindow || 'Timely'}
              </Pill>
            )}
            {isAcked && <Pill style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Seen</Pill>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {idea.ideaId && (
            <button
              onClick={handleAck}
              disabled={acking}
              title={isAcked ? 'Mark as new' : 'Mark as seen'}
              style={{
                width: 28, height: 28, borderRadius: 7,
                border: '1px solid var(--border-default)',
                background: isAcked ? 'var(--gold-dim, color-mix(in srgb, var(--gold) 15%, transparent))' : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isAcked ? 'var(--gold)' : 'var(--text-muted)',
                fontSize: 14,
                transition: 'all 0.15s',
              }}
            >
              {isAcked ? '\u2713' : '\u2022'}
            </button>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '\u25B2' : '\u25BC'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border-default)' }}>
          {/* Hook */}
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-default)' }}>
            <SectionLabel>Hook</SectionLabel>
            <p style={{
              margin: 0, fontSize: 14, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.6,
              padding: '10px 14px', borderRadius: 8,
              background: 'color-mix(in srgb, var(--gold) 5%, var(--bg-base))',
              borderLeft: '3px solid var(--gold)',
            }}>
              "{idea.hook}"
            </p>
          </div>

          {/* Signal */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)' }}>
            <SectionLabel>Data Signal</SectionLabel>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{idea.sourceSignal}</p>
          </div>

          {/* Content Points */}
          {idea.contentPoints?.length > 0 && (
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)' }}>
              <SectionLabel>Script Outline</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {idea.contentPoints.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--gold)', fontWeight: 700, flexShrink: 0, fontSize: 12, marginTop: 1 }}>{i + 1}.</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Code Reference */}
          {idea.codeReference && (
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)', background: 'color-mix(in srgb, var(--gold) 3%, transparent)' }}>
              <SectionLabel color="var(--gold)">From the Code</SectionLabel>
              <pre style={{
                margin: 0, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6,
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--bg-base)', overflow: 'auto', whiteSpace: 'pre-wrap',
                border: '1px solid var(--border-default)',
              }}>
                {idea.codeReference}
              </pre>
            </div>
          )}

          {/* Why it fits */}
          <div style={{ padding: '14px 18px', borderBottom: idea.sources?.length ? '1px solid var(--border-default)' : 'none' }}>
            <SectionLabel>Why it fits KnavishMantis</SectionLabel>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{idea.whyItFits}</p>
          </div>

          {/* Sources */}
          {idea.sources && idea.sources.length > 0 && (
            <div style={{ padding: '14px 18px' }}>
              <SectionLabel>Sources</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {idea.sources.map((s, i) => (
                  s.url ? (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      style={{
                        fontSize: 11, color: 'var(--gold)', textDecoration: 'none',
                        padding: '4px 10px', borderRadius: 6,
                        border: '1px solid var(--border-default)', background: 'var(--bg-base)',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                    >
                      {s.label} &#8599;
                    </a>
                  ) : (
                    <span key={i} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
                      {s.label}
                    </span>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const isHigh = score >= 8;
  const isMid = score >= 6 && score < 8;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, fontWeight: 700,
      background: isHigh ? 'var(--gold-dim)' : isMid ? 'var(--border-subtle)' : 'var(--border-subtle)',
      color: isHigh ? 'var(--gold)' : isMid ? 'var(--text-secondary)' : 'var(--text-muted)',
      border: `1.5px solid ${isHigh ? 'var(--gold)' : 'var(--border-default)'}`,
    }}>
      {score}
    </div>
  );
}

function Pill({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
      border: '1px solid var(--border-default)', color: 'var(--text-muted)',
      letterSpacing: '0.02em', lineHeight: '16px', ...style,
    }}>
      {children}
    </span>
  );
}

function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: color || 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
      {children}
    </div>
  );
}

function FilterGroup({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 7, border: '1px solid var(--border-default)', overflow: 'hidden' }}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 600,
            border: 'none',
            borderLeft: i > 0 ? '1px solid var(--border-default)' : 'none',
            cursor: 'pointer',
            background: value === opt.value ? 'var(--gold)' : 'var(--bg-elevated)',
            color: value === opt.value ? 'var(--bg-base)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
