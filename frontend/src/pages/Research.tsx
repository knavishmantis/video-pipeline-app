import React, { useState, useEffect } from 'react';
import { researchApi, ResearchReportSummary, ResearchIdea } from '../services/api';

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

export default function Research() {
  const [reports, setReports] = useState<ResearchReportSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<ResearchIdea[] | null>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [noIdeas, setNoIdeas] = useState(false);

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    try {
      const data = await researchApi.listReports();
      setReports(data);
      if (data.length > 0) selectReport(data[0].date, data[0].hasIdeas);
    } catch {} finally { setLoading(false); }
  };

  const selectReport = async (date: string, hasIdeas: boolean) => {
    setSelectedDate(date);
    setIdeas(null);
    setNoIdeas(!hasIdeas);
    if (hasIdeas) {
      try {
        const data = await researchApi.getIdeas(date);
        setIdeas(data.ideas);
      } catch { setNoIdeas(true); }
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80, color: 'var(--text-muted)' }}>Loading...</div>;

  if (reports.length === 0) return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Short Ideas</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>No reports yet.</p>
      <code style={{ display: 'block', padding: 12, borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border-default)', color: 'var(--gold)', fontSize: 12 }}>
        cd backend && npm run research
      </code>
    </div>
  );

  return (
    <div style={{ maxWidth: 760, width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>Short Ideas</h1>
        {reports.length > 1 && (
          <select
            value={selectedDate || ''}
            onChange={(e) => { const r = reports.find(r => r.date === e.target.value); if (r) selectReport(r.date, r.hasIdeas); }}
            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}
          >
            {reports.map(r => <option key={r.date} value={r.date}>{r.periodStart} — {r.periodEnd || r.date}</option>)}
          </select>
        )}
      </div>

      {noIdeas ? (
        <div style={{ padding: '32px 20px', borderRadius: 12, textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border-default)' }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Raw data collected — run Claude Code to generate ideas</p>
          <code style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            "Read research-reports/{selectedDate}-raw.json and backend/src/research/RESEARCH_PROMPT.md, then generate ideas"
          </code>
        </div>
      ) : ideas ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ideas.map((idea, i) => <IdeaCard key={i} idea={idea} rank={i + 1} />)}
        </div>
      ) : null}

      {/* Raw data toggle */}
      <div style={{ marginTop: 28, borderTop: '1px solid var(--border-default)', paddingTop: 16 }}>
        <button onClick={() => { setShowRaw(!showRaw); if (!rawData && selectedDate) researchApi.getRaw(selectedDate).then(setRawData).catch(() => {}); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, padding: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {showRaw ? '\u25BC' : '\u25B6'} Source Data
        </button>
        {showRaw && rawData && (
          <pre style={{ marginTop: 10, padding: 14, borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border-default)', fontSize: 10, color: 'var(--text-muted)', overflow: 'auto', maxHeight: 400, lineHeight: 1.5 }}>
            {JSON.stringify(rawData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function IdeaCard({ idea, rank }: { idea: ResearchIdea; rank: number }) {
  const [open, setOpen] = useState(false);
  const srcColor = SOURCE_COLORS[idea.sourceType] || 'var(--text-muted)';

  return (
    <div style={{ borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border-default)', overflow: 'hidden', width: '100%' }}>
      {/* Collapsed row */}
      <div onClick={() => setOpen(!open)} style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
        <ScoreBadge score={idea.score} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3 }}>{idea.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            <Pill>{CATEGORY_LABELS[idea.category] || idea.category}</Pill>
            <Pill style={{ borderColor: srcColor, color: srcColor }}>{idea.sourceType.toUpperCase()}</Pill>
            {idea.timeliness === 'time_sensitive' && <Pill style={{ borderColor: 'var(--gold)', color: 'var(--gold)', background: 'var(--gold-dim)' }}>{idea.timeWindow || 'Timely'}</Pill>}
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--border-default)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Hook */}
          <div>
            <SectionLabel>Hook</SectionLabel>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.5, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-base)', borderLeft: '3px solid var(--gold)' }}>
              "{idea.hook}"
            </p>
          </div>

          {/* Signal */}
          <div>
            <SectionLabel>Signal</SectionLabel>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{idea.sourceSignal}</p>
          </div>

          {/* Content Points */}
          {idea.contentPoints?.length > 0 && (
            <div>
              <SectionLabel>Content Points</SectionLabel>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {idea.contentPoints.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {/* Code Reference */}
          {idea.codeReference && (
            <div>
              <SectionLabel>From the Code</SectionLabel>
              <pre style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-base)', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                {idea.codeReference}
              </pre>
            </div>
          )}

          {/* Why it fits */}
          <div>
            <SectionLabel>Why it fits KM</SectionLabel>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{idea.whyItFits}</p>
          </div>

          {/* Sources */}
          {idea.sources && idea.sources.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
              {idea.sources.map((s, i) => (
                s.url ? (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
                    {s.label} &#8599;
                  </a>
                ) : (
                  <span key={i} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
                    {s.label}
                  </span>
                )
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const isHigh = score >= 8;
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 700,
      background: isHigh ? 'var(--gold-dim)' : 'var(--border-subtle)',
      color: isHigh ? 'var(--gold)' : 'var(--text-muted)',
      border: `1.5px solid ${isHigh ? 'var(--gold-border)' : 'var(--border-default)'}`,
    }}>
      {score}
    </div>
  );
}

function Pill({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 5,
      border: '1px solid var(--border-default)', color: 'var(--text-muted)',
      letterSpacing: '0.02em', ...style,
    }}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
      {children}
    </div>
  );
}
