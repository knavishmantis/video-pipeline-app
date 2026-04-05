import { useState, useEffect, useMemo } from 'react';
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

function formatHours(h: number | null): string {
  if (h === null || h === undefined) return '—';
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

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    return data.users
      .filter(u => roleFilter === 'all' || u.role === roleFilter)
      .sort((a, b) => b.completed_assignments - a.completed_assignments);
  }, [data, roleFilter]);

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
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Team
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Per-person completion counts and turnaround times
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

      {/* Individual cards */}
      {filteredUsers.length === 0 ? (
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filteredUsers.map(u => (
            <UserCard key={`${u.user_id}-${u.role}`} user={u} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserCard({ user }: { user: UserStats }) {
  const roleColor = ROLE_COLORS[user.role] || COLORS.gold;
  const profileSrc = getProfilePictureSrc(user);
  const emoji = isEmoji(user.profile_picture) ? user.profile_picture : null;

  return (
    <div style={{
      background: 'var(--card-bg)',
      borderRadius: 14,
      border: '1px solid var(--border-default)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Header: avatar + name + role */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {profileSrc ? (
          <img
            src={profileSrc}
            alt=""
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-default)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : emoji ? (
          <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'var(--gold-dim)' }}>
            {emoji}
          </div>
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, background: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
            {(user.name || '?')[0]}
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
      </div>

      {/* Two big stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <BigStat
          label="Completed"
          value={user.completed_assignments}
          sub={user.total_assignments > 0 ? `of ${user.total_assignments}` : undefined}
          color={roleColor}
        />
        <BigStat
          label="Avg turnaround"
          value={formatHours(user.avg_turnaround_hours)}
          sub="assigned → done"
          color={COLORS.gold}
        />
      </div>
    </div>
  );
}

function BigStat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--border-subtle)',
      borderRadius: 10,
      padding: '14px 14px',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 24,
        fontWeight: 700,
        color: color || 'var(--text-primary)',
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
