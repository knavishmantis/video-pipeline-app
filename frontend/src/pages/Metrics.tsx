import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { pipelineAnalyticsApi } from '../services/api';
import YouTubeStats from './YouTubeStats';
import TeamMetrics from './TeamMetrics';

// ── Pipeline tab ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  idea: 'Idea',
  script: 'Script',
  clipping: 'Clipping',
  clips: 'Clips',
  clip_changes: 'Clip Changes',
  editing: 'Editing',
  editing_changes: 'Edit Changes',
  completed: 'Completed',
  uploaded: 'Uploaded',
};

const STATUS_COLORS: Record<string, string> = {
  idea: '#B8922E',
  script: '#4A9EDE',
  clipping: '#5BA3F5',
  clips: '#4ECB71',
  clip_changes: '#E8943A',
  editing: '#9B72CF',
  editing_changes: '#E05A4E',
  completed: '#2DC97A',
  uploaded: '#1DB954',
};

function fmtHours(h: number | null): string {
  if (h === null || h === undefined) return '—';
  if (h < 24) return `${h}h`;
  const days = (h / 24).toFixed(1);
  return `${days}d`;
}

const PNL = ({ children, label, style }: { children: React.ReactNode; label?: string; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px 14px', ...style }}>
    {label && <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', lineHeight: 1 }}>{label}</div>}
    {children}
  </div>
);

const KPI = ({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '14px 18px' }}>
    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{label}</div>
    <div style={{ fontSize: '28px', fontWeight: 800, color: accent || 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{sub}</div>}
  </div>
);

const StatRow = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</span>
    <span style={{ fontSize: '12px', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</span>
  </div>
);

function PipelineTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pipelineAnalyticsApi.get()
      .then(setData)
      .catch((e: any) => setError(e.response?.data?.error || 'Failed to load pipeline analytics'))
      .finally(() => setLoading(false));
  }, []);

  const maxStatusCount = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.status_distribution.map((s: any) => s.count), 1);
  }, [data]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)', fontSize: '12px' }}>
        Loading pipeline analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', color: '#E05A4E', fontSize: '13px' }}>{error}</div>
    );
  }

  if (!data) return null;

  const { totals, stage_durations, monthly_throughput, status_distribution } = data;
  const avgDays = stage_durations.avg_total_hours != null
    ? (stage_durations.avg_total_hours / 24).toFixed(1)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        <KPI label="Total Shorts" value={totals.total} />
        <KPI label="In Progress" value={totals.in_progress} accent="#4A9EDE" />
        <KPI label="Completed" value={totals.completed_all_time} accent="#2DC97A"
          sub={totals.total > 0 ? `${Math.round(totals.completed_all_time / totals.total * 100)}% of total` : undefined} />
        <KPI label="Avg Pipeline" value={avgDays != null ? `${avgDays}d` : '—'} sub="idea → done" />
      </div>

      {/* Throughput chart + Status distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <PNL label="Monthly Throughput">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly_throughput} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-default)' }}
                interval={Math.floor(monthly_throughput.length / 5)}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={24}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  fontSize: 11,
                  color: 'var(--text-primary)',
                }}
              />
              <Area type="monotone" dataKey="created" name="Created" stroke="#4A9EDE" fill="#4A9EDE" fillOpacity={0.15} strokeWidth={1.5} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="#2DC97A" fill="#2DC97A" fillOpacity={0.2} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', justifyContent: 'flex-end' }}>
            {[{ color: '#4A9EDE', label: 'Created' }, { color: '#2DC97A', label: 'Completed' }].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                <div style={{ width: '10px', height: '2px', background: color, borderRadius: '1px' }} />
                {label}
              </div>
            ))}
          </div>
        </PNL>

        <PNL label="Current Stage Distribution">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '2px' }}>
            {status_distribution.map((s: any) => (
              <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: '80px', textAlign: 'right', letterSpacing: '-0.01em' }}>
                  {STATUS_LABELS[s.status]}
                </span>
                <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'var(--border-default)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(s.count / maxStatusCount) * 100}%`,
                    background: STATUS_COLORS[s.status] || 'var(--gold)',
                    borderRadius: '4px',
                    transition: 'width 0.4s ease',
                    minWidth: s.count > 0 ? '4px' : 0,
                  }} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: s.count > 0 ? 'var(--text-primary)' : 'var(--text-muted)', minWidth: '20px' }}>
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </PNL>
      </div>

      {/* Stage durations + Revision rates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <PNL label="Stage Durations (avg)">
          {stage_durations.avg_total_hours != null ? (
            <>
              <StatRow label="Idea → Clips complete" value={fmtHours(stage_durations.avg_hours_to_clips)} color="#4A9EDE" />
              <StatRow label="Clips → Editing complete" value={fmtHours(stage_durations.avg_hours_editing)} color="#9B72CF" />
              <StatRow label="Total (idea → done)" value={fmtHours(stage_durations.avg_total_hours)} color="var(--gold)" />
              <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Based on {totals.completed_all_time} completed short{totals.completed_all_time !== 1 ? 's' : ''}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No completed shorts yet</div>
          )}
        </PNL>

        <PNL label="Revision Rates">
          <StatRow label="Clip revisions requested" value={`${totals.clip_revision_rate}%`} color={totals.clip_revision_rate > 50 ? '#E05A4E' : '#4ECB71'} />
          <StatRow label="Editing revisions requested" value={`${totals.editing_revision_rate}%`} color={totals.editing_revision_rate > 50 ? '#E05A4E' : '#4ECB71'} />
          <div style={{ marginTop: '10px' }}>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart
                data={[
                  { label: 'Clips', rate: totals.clip_revision_rate },
                  { label: 'Editing', rate: totals.editing_revision_rate },
                ]}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 11 }}
                  formatter={(v: any) => [`${v}%`, 'Revision rate']}
                />
                <Bar dataKey="rate" radius={[3, 3, 0, 0]} fill="#E8943A" maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PNL>
      </div>
    </div>
  );
}

// ── Metrics page ──────────────────────────────────────────────────────────────

type Tab = 'youtube' | 'pipeline' | 'team';

const TABS: { id: Tab; label: string; adminOnly: boolean }[] = [
  { id: 'youtube', label: 'YouTube', adminOnly: false },
  { id: 'pipeline', label: 'Pipeline', adminOnly: true },
  { id: 'team', label: 'Team', adminOnly: true },
];

export default function Metrics() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);
  const [activeTab, setActiveTab] = useState<Tab>('youtube');

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header — only shown for admins who see multiple tabs */}
      {visibleTabs.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
            Analytics
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Metrics
          </h1>
        </div>
      )}

      {/* Tab bar — only show when admin has multiple tabs */}
      {visibleTabs.length > 1 && (
        <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border-default)', paddingBottom: 0 }}>
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: activeTab === tab.id ? 'var(--gold)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--gold)' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'color 0.15s',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={(e) => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'youtube' && <YouTubeStats />}
      {activeTab === 'pipeline' && isAdmin && <PipelineTab />}
      {activeTab === 'team' && isAdmin && <TeamMetrics />}
    </div>
  );
}
