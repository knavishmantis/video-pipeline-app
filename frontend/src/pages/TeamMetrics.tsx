import { useState, useEffect, useMemo } from 'react';
import { teamMetricsApi } from '../services/api';

// ─── Colors ────────────────────────────────────────────────────────────────────
const COLORS = {
  gold: '#B8922E',
  blue: '#4A9EDE',
  coral: '#E05A4E',
  green: '#4ECB71',
  purple: '#9B72CF',
  orange: '#E8943A',
  muted: '#8B8B8B',
};

const ROLE_COLORS: Record<string, string> = {
  clipper: COLORS.blue,
  editor: COLORS.purple,
};

// ─── Status thresholds ─────────────────────────────────────────────────────────
// Active: last submission within 7 days, OR no active load yet
// Slow:   last submission 7-14 days ago
// Risk:   last submission >14 days ago AND has active assignments (holding work)
// Dormant: no activity in >21 days AND no active load (not an alarm, just gray)
type Status = 'active' | 'slow' | 'risk' | 'dormant' | 'new';

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function computeStatus(user: UserStats): Status {
  const days = daysSince(user.last_submission_at);
  const hasLoad = user.current_load > 0;

  if (days === null) {
    // No submissions yet
    return hasLoad ? 'new' : 'new';
  }
  if (days > 14 && hasLoad) return 'risk';
  if (days > 21) return 'dormant';
  if (days > 7) return 'slow';
  return 'active';
}

const STATUS_META: Record<Status, { label: string; color: string; dot: string }> = {
  active:  { label: 'Active',  color: COLORS.green,  dot: COLORS.green },
  slow:    { label: 'Slowing', color: COLORS.orange, dot: COLORS.orange },
  risk:    { label: 'At Risk', color: COLORS.coral,  dot: COLORS.coral },
  dormant: { label: 'Dormant', color: COLORS.muted,  dot: COLORS.muted },
  new:     { label: 'New',     color: COLORS.muted,  dot: COLORS.muted },
};

const STATUS_PRIORITY: Record<Status, number> = {
  risk: 0,
  slow: 1,
  active: 2,
  new: 3,
  dormant: 4,
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface UserStats {
  user_id: number;
  name: string;
  discord_username: string | null;
  profile_picture: string | null;
  role: string;
  total_assignments: number;
  completed_assignments: number;
  current_load: number;
  rework_count: number;
  avg_turnaround_hours: number | null;
  last_submission_at: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatHours(h: number | null): string {
  if (h === null || h === undefined) return '—';
  if (h < 24) return `${Math.round(h)}h`;
  const days = Math.floor(h / 24);
  const rem = Math.round(h % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function formatRelativeDays(d: number | null): string {
  if (d === null) return 'never';
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 14) return '1 week ago';
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  if (d < 60) return '1 month ago';
  return `${Math.floor(d / 30)} months ago`;
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

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function TeamMetrics() {
  const [data, setData] = useState<{ users: UserStats[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | 'clipper' | 'editor'>('all');

  useEffect(() => {
    teamMetricsApi.get()
      .then(setData)
      .catch((e: any) => setError(e.response?.data?.error || 'Failed to load team metrics'))
      .finally(() => setLoading(false));
  }, []);

  const sortedUsers = useMemo(() => {
    if (!data) return [];
    const filtered = data.users.filter(u => roleFilter === 'all' || u.role === roleFilter);
    return filtered
      .map(u => ({ user: u, status: computeStatus(u) }))
      .sort((a, b) => {
        // 1. Status priority (risk first, dormant last)
        const pa = STATUS_PRIORITY[a.status];
        const pb = STATUS_PRIORITY[b.status];
        if (pa !== pb) return pa - pb;
        // 2. Current load desc (who's holding the most work)
        if (b.user.current_load !== a.user.current_load) return b.user.current_load - a.user.current_load;
        // 3. Most recent activity first
        const da = daysSince(a.user.last_submission_at) ?? 9999;
        const db = daysSince(b.user.last_submission_at) ?? 9999;
        return da - db;
      });
  }, [data, roleFilter]);

  // Summary counts for the role pills
  const counts = useMemo(() => {
    if (!data) return { all: 0, clipper: 0, editor: 0, risk: 0, slow: 0 };
    return {
      all: data.users.length,
      clipper: data.users.filter(u => u.role === 'clipper').length,
      editor: data.users.filter(u => u.role === 'editor').length,
      risk: data.users.filter(u => computeStatus(u) === 'risk').length,
      slow: data.users.filter(u => computeStatus(u) === 'slow').length,
    };
  }, [data]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Loading team…
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
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Team
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Who's active, who's holding work, who needs a nudge
        </p>
      </div>

      {/* Alerts row — only shows if anything needs attention */}
      {(counts.risk > 0 || counts.slow > 0) && (
        <div style={{
          display: 'flex',
          gap: 10,
          marginBottom: 18,
          padding: '10px 14px',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          fontSize: 12,
          color: 'var(--text-secondary)',
          alignItems: 'center',
        }}>
          {counts.risk > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.coral }} />
              <strong style={{ color: COLORS.coral }}>{counts.risk}</strong> at risk
            </span>
          )}
          {counts.risk > 0 && counts.slow > 0 && <span style={{ color: 'var(--border-default)' }}>·</span>}
          {counts.slow > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.orange }} />
              <strong style={{ color: COLORS.orange }}>{counts.slow}</strong> slowing
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
            Sorted by priority — address these first
          </span>
        </div>
      )}

      {/* Role filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(['all', 'clipper', 'editor'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid',
              borderColor: roleFilter === r ? COLORS.gold : 'var(--border-default)',
              background: roleFilter === r ? 'var(--gold-dim)' : 'transparent',
              color: roleFilter === r ? COLORS.gold : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {r === 'all' ? `All (${counts.all})` : `${r.charAt(0).toUpperCase() + r.slice(1)}s (${counts[r]})`}
          </button>
        ))}
      </div>

      {/* Cards */}
      {sortedUsers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: 'var(--text-muted)',
          fontSize: 13,
          background: 'var(--card-bg)',
          border: '1px dashed var(--border-default)',
          borderRadius: 12,
        }}>
          No {roleFilter === 'all' ? 'team members' : roleFilter + 's'} to show.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {sortedUsers.map(({ user, status }) => (
            <UserCard key={`${user.user_id}-${user.role}`} user={user} status={status} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── User card ─────────────────────────────────────────────────────────────────
function UserCard({ user, status }: { user: UserStats; status: Status }) {
  const roleColor = ROLE_COLORS[user.role] || COLORS.gold;
  const meta = STATUS_META[status];
  const profileSrc = getProfilePictureSrc(user);
  const emoji = isEmoji(user.profile_picture) ? user.profile_picture : null;

  const days = daysSince(user.last_submission_at);
  const reworkRate = user.completed_assignments > 0
    ? Math.round((user.rework_count / user.completed_assignments) * 100)
    : null;

  return (
    <div style={{
      background: 'var(--card-bg)',
      borderRadius: 12,
      border: `1px solid ${status === 'risk' ? COLORS.coral + '55' : 'var(--border-default)'}`,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'relative',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {profileSrc ? (
          <img
            src={profileSrc}
            alt=""
            style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-default)', flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : emoji ? (
          <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: 'var(--gold-dim)', flexShrink: 0 }}>
            {emoji}
          </div>
        ) : (
          <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: 'var(--border-subtle)', color: 'var(--text-muted)', flexShrink: 0 }}>
            {(user.name || '?')[0].toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
            marginTop: 3,
            textTransform: 'capitalize',
          }}>
            {user.role}
          </span>
        </div>
        {/* Status pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 9px',
          borderRadius: 10,
          background: meta.color + '14',
          border: `1px solid ${meta.color}30`,
          fontSize: 10,
          fontWeight: 700,
          color: meta.color,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }} />
          {meta.label}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label="Completed" value={user.completed_assignments} sub={user.total_assignments > 0 ? `of ${user.total_assignments}` : undefined} />
        <Stat label="Avg turnaround" value={formatHours(user.avg_turnaround_hours)} sub="assign → done" />
        <Stat
          label="Current load"
          value={user.current_load}
          sub={user.current_load === 1 ? 'short in progress' : user.current_load === 0 ? '—' : 'shorts in progress'}
          highlight={user.current_load > 0 ? roleColor : undefined}
        />
        <Stat
          label="Rework rate"
          value={reworkRate === null ? '—' : `${reworkRate}%`}
          sub={user.rework_count > 0 ? `${user.rework_count} bounced back` : 'none bounced back'}
          highlight={reworkRate !== null && reworkRate >= 25 ? COLORS.coral : reworkRate === 0 && user.completed_assignments > 0 ? COLORS.green : undefined}
        />
      </div>

      {/* Footer: last activity */}
      <div style={{
        paddingTop: 10,
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 11,
        color: 'var(--text-muted)',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Last submission</span>
        <span style={{
          fontWeight: 600,
          color: status === 'risk' ? COLORS.coral : status === 'slow' ? COLORS.orange : 'var(--text-secondary)',
        }}>
          {formatRelativeDays(days)}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: string }) {
  return (
    <div style={{
      background: 'var(--border-subtle)',
      borderRadius: 8,
      padding: '10px 12px',
    }}>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        color: highlight || 'var(--text-primary)',
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
