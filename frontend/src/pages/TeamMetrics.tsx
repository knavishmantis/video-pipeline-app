import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { teamMetricsApi } from '../services/api';

const COLORS = {
  gold: '#B8922E',
  blue: '#4A9EDE',
  coral: '#E05A4E',
  green: '#4ECB71',
  purple: '#9B72CF',
  orange: '#E8943A',
};

const ROLE_COLORS: Record<string, string> = {
  clipper: COLORS.blue,
  editor: COLORS.purple,
};

interface UserStats {
  user_id: number;
  name: string;
  discord_username: string | null;
  profile_picture: string | null;
  role: string;
  total_assignments: number;
  completed_assignments: number;
  total_submissions: number;
  first_submission_at: string | null;
  last_submission_at: string | null;
  submissions_last7: number;
  submissions_last30: number;
  avg_turnaround_hours: number | null;
  avg_per_day: number;
  avg_per_day_last30: number;
}

interface DailySubmission {
  date: string;
  clipper_submissions: number;
  editor_submissions: number;
}

interface PerUserDaily {
  user_id: number;
  role: string;
  date: string;
  submissions: number;
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatHours(h: number | null): string {
  if (h === null || h === undefined) return '-';
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  const rem = Math.round(h % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function getProfilePictureSrc(user: UserStats): string | null {
  if (!user.profile_picture) return null;
  if (user.profile_picture.startsWith('http')) return user.profile_picture;
  return null;
}

function isEmoji(s: string | null): boolean {
  if (!s) return false;
  return !s.startsWith('http') && !s.startsWith('/') && s.length <= 4;
}

export default function TeamMetrics() {
  const [data, setData] = useState<{ users: UserStats[]; daily_submissions: DailySubmission[]; per_user_daily: PerUserDaily[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | 'clipper' | 'editor'>('all');

  useEffect(() => {
    teamMetricsApi.get()
      .then(setData)
      .catch((e: any) => setError(e.response?.data?.error || 'Failed to load team metrics'))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    return data.users.filter(u => roleFilter === 'all' || u.role === roleFilter);
  }, [data, roleFilter]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.daily_submissions.map(d => ({
      ...d,
      date: formatDate(d.date),
      total: d.clipper_submissions + d.editor_submissions,
    }));
  }, [data]);

  // Aggregate stats
  const aggStats = useMemo(() => {
    if (!data) return null;
    const users = filteredUsers;
    const totalSubs = users.reduce((s, u) => s + u.total_submissions, 0);
    const last7 = users.reduce((s, u) => s + u.submissions_last7, 0);
    const last30 = users.reduce((s, u) => s + u.submissions_last30, 0);
    const totalAssignments = users.reduce((s, u) => s + u.total_assignments, 0);
    const completedAssignments = users.reduce((s, u) => s + u.completed_assignments, 0);
    return { totalSubs, last7, last30, totalAssignments, completedAssignments };
  }, [data, filteredUsers]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Loading team metrics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: COLORS.coral }}>
        {error}
      </div>
    );
  }

  if (!data || data.users.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        No team data available yet.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Team Throughput
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Clipper &amp; editor submission rates and turnaround times
        </p>
      </div>

      {/* Role filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'clipper', 'editor'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid',
              borderColor: roleFilter === r ? COLORS.gold : 'var(--border-default)',
              background: roleFilter === r ? 'var(--gold-dim)' : 'transparent',
              color: roleFilter === r ? COLORS.gold : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1) + 's'}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      {aggStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          <KPICard label="Total Submissions" value={aggStats.totalSubs} />
          <KPICard label="Last 7 Days" value={aggStats.last7} accent={COLORS.green} />
          <KPICard label="Last 30 Days" value={aggStats.last30} accent={COLORS.blue} />
          <KPICard label="Assignments" value={`${aggStats.completedAssignments}/${aggStats.totalAssignments}`} sub="completed" />
          <KPICard
            label="Avg/Day (30d)"
            value={aggStats.last30 > 0 ? (aggStats.last30 / 30).toFixed(2) : '0'}
            accent={COLORS.orange}
          />
        </div>
      )}

      {/* Daily submission chart */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: 16,
        border: '1px solid var(--border-default)',
        padding: 20,
        marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, letterSpacing: '-0.02em' }}>
          Daily Submissions (Last 90 Days)
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-default)' }}
              interval={Math.floor(chartData.length / 8)}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-default)',
                borderRadius: 10,
                fontSize: 12,
                color: 'var(--text-primary)',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }}
            />
            <Area
              type="monotone"
              dataKey="clipper_submissions"
              name="Clipper"
              stackId="1"
              stroke={COLORS.blue}
              fill={COLORS.blue}
              fillOpacity={0.3}
            />
            <Area
              type="monotone"
              dataKey="editor_submissions"
              name="Editor"
              stackId="1"
              stroke={COLORS.purple}
              fill={COLORS.purple}
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* User cards */}
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.02em' }}>
        Individual Performance
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: 24 }}>
        {filteredUsers.map(u => (
          <UserCard key={`${u.user_id}-${u.role}`} user={u} perUserDaily={data.per_user_daily} />
        ))}
      </div>

      {/* Leaderboard table */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: 16,
        border: '1px solid var(--border-default)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              {['Name', 'Role', 'Total', 'Last 7d', 'Last 30d', 'Avg/Day', 'Avg/Day (30d)', 'Turnaround', 'Completion'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <tr key={`${u.user_id}-${u.role}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {u.discord_username || u.name}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    background: ROLE_COLORS[u.role] + '18',
                    color: ROLE_COLORS[u.role],
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>{u.total_submissions}</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{u.submissions_last7}</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{u.submissions_last30}</td>
                <td style={{ padding: '10px 16px', color: COLORS.gold, fontWeight: 600 }}>{u.avg_per_day}</td>
                <td style={{ padding: '10px 16px', color: COLORS.orange, fontWeight: 600 }}>{u.avg_per_day_last30}</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{formatHours(u.avg_turnaround_hours)}</td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>
                  {u.total_assignments > 0
                    ? `${u.completed_assignments}/${u.total_assignments} (${Math.round(u.completed_assignments / u.total_assignments * 100)}%)`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPICard({ label, value, accent, sub }: { label: string; value: string | number; accent?: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--card-bg)',
      borderRadius: 14,
      border: '1px solid var(--border-default)',
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent || 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function UserCard({ user, perUserDaily }: { user: UserStats; perUserDaily: PerUserDaily[] }) {
  const sparkData = useMemo(() => {
    // Build 30-day sparkline data
    const dailyMap = new Map<string, number>();
    perUserDaily
      .filter(d => d.user_id === user.user_id && d.role === user.role)
      .forEach(d => dailyMap.set(d.date, d.submissions));

    const days: { date: string; val: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push({ date: key, val: dailyMap.get(key) || 0 });
    }
    return days;
  }, [user, perUserDaily]);

  const roleColor = ROLE_COLORS[user.role] || COLORS.gold;
  const profileSrc = getProfilePictureSrc(user);
  const emoji = isEmoji(user.profile_picture) ? user.profile_picture : null;

  return (
    <div style={{
      background: 'var(--card-bg)',
      borderRadius: 16,
      border: '1px solid var(--border-default)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {/* User header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {profileSrc ? (
          <img
            src={profileSrc}
            alt=""
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-default)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : emoji ? (
          <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: 'var(--gold-dim)' }}>
            {emoji}
          </div>
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
            {(user.name || '?')[0]}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {user.discord_username || user.name}
          </div>
          <span style={{
            display: 'inline-block',
            padding: '1px 8px',
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 600,
            background: roleColor + '18',
            color: roleColor,
            marginTop: 2,
          }}>
            {user.role}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            {user.avg_per_day_last30}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>sets/day (30d)</div>
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ height: 48 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Bar dataKey="val" fill={roleColor} radius={[2, 2, 0, 0]} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <StatCell label="7d" value={user.submissions_last7} />
        <StatCell label="30d" value={user.submissions_last30} />
        <StatCell label="Total" value={user.total_submissions} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCell label="Avg Turnaround" value={formatHours(user.avg_turnaround_hours)} />
        <StatCell
          label="Completion"
          value={user.total_assignments > 0
            ? `${Math.round(user.completed_assignments / user.total_assignments * 100)}%`
            : '-'}
        />
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: 'var(--border-subtle)',
      borderRadius: 10,
      padding: '8px 12px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
    </div>
  );
}
