import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, ReferenceLine, Cell,
} from 'recharts';
import { youtubeAnalyticsApi } from '../services/api';

interface ChannelStats {
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
  title: string;
  thumbnail: string;
  customUrl: string;
  rawSubscriberCount: number;
}

interface VideoStats {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  url: string;
  rawViewCount: number;
  rawLikeCount: number;
  rawCommentCount: number;
  shares: number;
  avgViewPercentage: number;
  avgViewDuration: number;
  subscribersGained: number;
  engagementRate: number;
  viewCount: string;
  likeCount: string;
  commentCount: string;
  likesToViewsRatio: number;
  commentsToViewsRatio: number;
}

type TimeFilter = 'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year';
type SortOption =
  | 'date_desc' | 'date_asc'
  | 'views_desc' | 'views_asc'
  | 'likes_desc' | 'likes_asc'
  | 'like_ratio_desc' | 'like_ratio_asc'
  | 'comment_ratio_desc' | 'comment_ratio_asc'
  | 'shares_desc' | 'shares_asc'
  | 'avg_view_pct_desc' | 'avg_view_pct_asc'
  | 'subs_gained_desc';

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (num: string | number): string => {
  const n = typeof num === 'string' ? parseInt(num) : num;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
};

const fmtDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Text colour (CSS vars, for labels)
const retCol = (pct: number) =>
  pct >= 45 ? 'var(--green)' : pct >= 28 ? 'var(--gold)' : 'var(--red)';

// Pearson correlation coefficient
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : Math.max(-1, Math.min(1, num / denom));
}
function corrBg(r: number): string {
  const a = Math.min(1, Math.abs(r)) * 0.7;
  return r >= 0 ? `rgba(78,203,113,${a})` : `rgba(224,90,78,${a})`;
}
function corrText(r: number): string {
  return Math.abs(r) > 0.35 ? 'var(--text-primary)' : 'var(--text-muted)';
}

// ── sub-components ────────────────────────────────────────────────────────────

const PNL = ({ children, label, style }: { children: React.ReactNode; label?: string; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '10px 12px', ...style }}>
    {label && <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', lineHeight: 1 }}>{label}</div>}
    {children}
  </div>
);

const Metric = ({ value, label, color }: { value: string | number; label: string; color?: string }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '20px', fontWeight: 800, color: color || 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
  </div>
);

function InlineBar({ value, max }: { value: number; max: number }) {
  return (
    <div style={{ height: '3px', borderRadius: '2px', background: 'var(--border-default)', width: '60px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: 'var(--gold)', borderRadius: '2px' }} />
    </div>
  );
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '4px', padding: '8px 10px', fontSize: '11px', maxWidth: '220px' }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
      <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px' }}>{d.date}</div>
      <div style={{ color: 'var(--gold)', fontWeight: 700, marginBottom: '1px' }}>{fmt(d.views)} views</div>
      <div style={{ color: retCol(d.retention), fontWeight: 600 }}>{d.retention.toFixed(1)}% retention</div>
    </div>
  );
}

const HEATMAP_METRICS: { key: keyof VideoStats; label: string }[] = [
  { key: 'rawViewCount',        label: 'Views'       },
  { key: 'avgViewPercentage',   label: 'Retention'   },
  { key: 'avgViewDuration',     label: 'Watch Time'  },
  { key: 'subscribersGained',   label: 'Subs'        },
  { key: 'likesToViewsRatio',   label: 'Like Rate'   },
  { key: 'commentsToViewsRatio',label: 'Comment Rate'},
  { key: 'shares',              label: 'Shares'      },
  { key: 'engagementRate',      label: 'Engagement'  },
];

function CorrelationHeatmap({ videos }: { videos: VideoStats[] }) {
  const matrix = React.useMemo(() => {
    const vecs = HEATMAP_METRICS.map(m => videos.map(v => (v[m.key] as number) || 0));
    return vecs.map((xs, i) => vecs.map((ys, j) => i === j ? null : pearson(xs, ys)));
  }, [videos]);

  const n = HEATMAP_METRICS.length;

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `72px repeat(${n}, 1fr)`,
        gap: '2px',
        minWidth: '440px',
      }}>
        {/* Top-left blank */}
        <div />
        {/* Column headers */}
        {HEATMAP_METRICS.map(m => (
          <div key={m.key} style={{
            fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2,
            textAlign: 'center', display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center', paddingBottom: '4px', height: '44px',
          }}>
            {m.label}
          </div>
        ))}

        {/* Rows */}
        {HEATMAP_METRICS.map((m, i) => (
          <React.Fragment key={m.key}>
            <div style={{
              fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: '8px', lineHeight: 1.2,
            }}>
              {m.label}
            </div>
            {matrix[i].map((r, j) => (
              <div
                key={j}
                title={r === null ? m.label : `${m.label} × ${HEATMAP_METRICS[j].label}: ${r.toFixed(3)}`}
                style={{
                  background: r === null ? 'var(--border-default)' : corrBg(r),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, letterSpacing: '-0.02em',
                  color: r === null ? 'transparent' : corrText(r),
                  borderRadius: '3px',
                  aspectRatio: '1',
                  minHeight: '34px',
                }}
              >
                {r === null ? '—' : r.toFixed(2)}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>−1</span>
        <div style={{ width: '100px', height: '6px', borderRadius: '3px', background: 'linear-gradient(to right, rgba(224,90,78,0.7), transparent, rgba(78,203,113,0.7))' }} />
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>+1</span>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function YouTubeStats() {
  const [channelStats, setChannelStats] = useState<ChannelStats | null>(null);
  const [allVideos, setAllVideos] = useState<VideoStats[]>([]);
  const [loadingChannel, setLoadingChannel] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');

  useEffect(() => {
    fetchChannelStats();
    fetchVideos();
  }, []);

  const fetchChannelStats = async () => {
    setLoadingChannel(true);
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      if (!apiKey) { setLoadingChannel(false); return; }

      const channelHandle = '@knavishmantis';
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelHandle)}&type=channel&key=${apiKey}`
      );
      const searchData = await searchResponse.json();
      if (!searchData.items?.length) { setLoadingChannel(false); return; }

      const channelId = searchData.items[0].snippet.channelId;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.items?.length) {
        const ch = data.items[0];
        setChannelStats({
          subscriberCount: fmt(ch.statistics.subscriberCount),
          viewCount: fmt(ch.statistics.viewCount),
          videoCount: fmt(ch.statistics.videoCount),
          title: ch.snippet.title,
          thumbnail: ch.snippet.thumbnails.high?.url || ch.snippet.thumbnails.default.url,
          customUrl: ch.snippet.customUrl || `https://youtube.com/${channelHandle}`,
          rawSubscriberCount: parseInt(ch.statistics.subscriberCount || '0'),
        });
      }
    } catch (err) {
      console.error('Failed to fetch channel stats:', err);
    } finally {
      setLoadingChannel(false);
    }
  };

  const fetchVideos = async () => {
    setLoadingVideos(true);
    setError(null);
    try {
      const data = await youtubeAnalyticsApi.getAll();
      if (!data.length) {
        setError('No analytics data yet — run the sync script or wait for the GitHub Action.');
        setLoadingVideos(false);
        return;
      }

      const videoStats: VideoStats[] = data.map((v) => ({
        id: v.video_id,
        title: v.title,
        thumbnail: `https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`,
        publishedAt: v.published_at,
        url: `https://www.youtube.com/watch?v=${v.video_id}`,
        rawViewCount: v.views,
        rawLikeCount: v.likes,
        rawCommentCount: v.comments,
        shares: v.shares,
        avgViewPercentage: v.average_view_percentage,
        avgViewDuration: v.average_view_duration,
        subscribersGained: v.subscribers_gained,
        engagementRate: v.engagement_rate,
        viewCount: fmt(v.views),
        likeCount: fmt(v.likes),
        commentCount: fmt(v.comments),
        likesToViewsRatio: v.views > 0 ? (v.likes / v.views) * 100 : 0,
        commentsToViewsRatio: v.views > 0 ? (v.comments / v.views) * 100 : 0,
      }));

      setAllVideos(videoStats);
    } catch (err) {
      console.error('Failed to fetch video analytics:', err);
      setError('Failed to load video analytics from backend.');
    } finally {
      setLoadingVideos(false);
    }
  };

  const filteredAndSortedVideos = useMemo(() => {
    let filtered = [...allVideos];

    const now = new Date();
    if (timeFilter === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter(v => new Date(v.publishedAt) >= start);
    } else if (timeFilter === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      filtered = filtered.filter(v => { const d = new Date(v.publishedAt); return d >= start && d <= end; });
    } else if (timeFilter === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1);
      filtered = filtered.filter(v => new Date(v.publishedAt) >= start);
    } else if (timeFilter === 'last_year') {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear(), 0, 0);
      filtered = filtered.filter(v => { const d = new Date(v.publishedAt); return d >= start && d <= end; });
    }

    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'date_desc': return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        case 'date_asc': return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
        case 'views_desc': return b.rawViewCount - a.rawViewCount;
        case 'views_asc': return a.rawViewCount - b.rawViewCount;
        case 'likes_desc': return b.rawLikeCount - a.rawLikeCount;
        case 'likes_asc': return a.rawLikeCount - b.rawLikeCount;
        case 'like_ratio_desc': return b.likesToViewsRatio - a.likesToViewsRatio;
        case 'like_ratio_asc': return a.likesToViewsRatio - b.likesToViewsRatio;
        case 'comment_ratio_desc': return b.commentsToViewsRatio - a.commentsToViewsRatio;
        case 'comment_ratio_asc': return a.commentsToViewsRatio - b.commentsToViewsRatio;
        case 'shares_desc': return b.shares - a.shares;
        case 'shares_asc': return a.shares - b.shares;
        case 'avg_view_pct_desc': return b.avgViewPercentage - a.avgViewPercentage;
        case 'avg_view_pct_asc': return a.avgViewPercentage - b.avgViewPercentage;
        case 'subs_gained_desc': return b.subscribersGained - a.subscribersGained;
        default: return 0;
      }
    });

    return filtered;
  }, [allVideos, timeFilter, sortOption]);

  const filteredSummary = useMemo(() => {
    const videos = timeFilter === 'all' ? allVideos : filteredAndSortedVideos;
    const totalViews = videos.reduce((s, v) => s + v.rawViewCount, 0);
    const totalLikes = videos.reduce((s, v) => s + v.rawLikeCount, 0);
    const totalComments = videos.reduce((s, v) => s + v.rawCommentCount, 0);
    const totalShares = videos.reduce((s, v) => s + v.shares, 0);
    const totalSubsGained = videos.reduce((s, v) => s + v.subscribersGained, 0);
    const avgRetention = videos.length > 0
      ? videos.reduce((s, v) => s + v.avgViewPercentage, 0) / videos.length
      : 0;

    let postingFrequency = 'N/A';
    if (videos.length > 1) {
      const dates = videos.map(v => new Date(v.publishedAt).getTime());
      const daysDiff = (Date.now() - Math.min(...dates)) / (1000 * 60 * 60 * 24);
      const dpv = daysDiff / videos.length;
      postingFrequency = dpv < 1 ? '< 1' : dpv < 10 ? dpv.toFixed(1) : Math.round(dpv).toString();
    }

    return { totalViews, totalLikes, totalComments, totalShares, totalSubsGained, avgRetention, postingFrequency, videoCount: videos.length };
  }, [allVideos, filteredAndSortedVideos, timeFilter]);

  const chartData = useMemo(() => {
    const base = timeFilter === 'all' ? allVideos : filteredAndSortedVideos;
    return [...base]
      .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
      .map(v => ({
        name: new Date(v.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: v.rawViewCount,
        retention: v.avgViewPercentage,
        title: v.title,
        date: new Date(v.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }));
  }, [allVideos, filteredAndSortedVideos, timeFilter]);

  const maxViews = useMemo(
    () => Math.max(...filteredAndSortedVideos.map(v => v.rawViewCount), 1),
    [filteredAndSortedVideos]
  );

  // Cumulative subs gained, sorted chronologically across ALL videos (not filtered)
  const cumSubsData = useMemo(() => {
    const sorted = [...allVideos].sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );
    let running = 0;
    return sorted.map(v => {
      running += v.subscribersGained;
      return {
        name: new Date(v.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        cumSubs: running,
        gained: v.subscribersGained,
        title: v.title,
      };
    });
  }, [allVideos]);

  // Retention per video over time — uses all videos chronologically to show improvement trend
  const retentionTrendData = useMemo(() =>
    [...allVideos]
      .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
      .map(v => ({
        name: new Date(v.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        retention: v.avgViewPercentage,
        title: v.title,
      })),
    [allVideos]
  );

  // Views distribution — buckets by view count range (respects time filter)
  const viewsDistData = useMemo(() => {
    const videos = filteredAndSortedVideos.length > 0 ? filteredAndSortedVideos : allVideos;
    const buckets = [
      { label: '< 10K',    min: 0,       max: 10_000,  color: '#E05A4E' },
      { label: '10–30K',   min: 10_000,  max: 30_000,  color: '#E8943A' },
      { label: '30–100K',  min: 30_000,  max: 100_000, color: '#B8922E' },
      { label: '100–250K', min: 100_000, max: 250_000, color: '#4ECB71' },
      { label: '250–500K', min: 250_000, max: 500_000, color: '#2DC97A' },
      { label: '500K–1M',  min: 500_000,   max: 1_000_000, color: '#1DB954' },
      { label: '1M+',      min: 1_000_000, max: Infinity,  color: '#17A144' },
    ];
    return buckets.map(b => ({
      label: b.label,
      count: videos.filter(v => v.rawViewCount >= b.min && v.rawViewCount < b.max).length,
      color: b.color,
    }));
  }, [filteredAndSortedVideos, allVideos]);

  const loading = loadingChannel && loadingVideos;

  return (
    <div style={{ padding: '0 4px', maxWidth: '1200px', margin: '0 auto', fontVariantNumeric: 'tabular-nums' }}>

      {/* Page header */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>Channel</div>
        <h1 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>YouTube Stats</h1>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Loading analytics…</div>
        </div>
      )}

      {error && !loadingVideos && (
        <PNL style={{ marginBottom: '10px', borderColor: 'color-mix(in srgb, var(--red) 25%, transparent)' }}>
          <div style={{ fontSize: '11px', color: 'var(--red)' }}>{error}</div>
        </PNL>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* ── 1. Compact header: channel identity + inline summary metrics ── */}
          <PNL>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {channelStats && (
                <>
                  <img
                    src="/knavishmantis-profilepic.png"
                    alt={channelStats.title}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', objectPosition: 'center', border: '1px solid var(--border-default)', flexShrink: 0 }}
                  />
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{channelStats.title}</div>
                    <a href={`https://youtube.com/${channelStats.customUrl}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '10px', color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>
                      {channelStats.customUrl} ↗
                    </a>
                  </div>
                  <div style={{ width: '1px', height: '36px', background: 'var(--border-default)', flexShrink: 0 }} />
                </>
              )}
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', flex: 1 }}>
                {channelStats && (
                  <Metric value={channelStats.subscriberCount} label="Subscribers" color="var(--gold)" />
                )}
                <Metric value={fmt(filteredSummary.totalViews)} label={timeFilter === 'all' ? 'Total Views' : 'Filtered Views'} />
                <Metric value={filteredSummary.videoCount} label="Videos" />
                <Metric
                  value={`${filteredSummary.avgRetention.toFixed(1)}%`}
                  label="Avg Retention"
                  color={retCol(filteredSummary.avgRetention)}
                />
                <Metric value={`+${fmt(filteredSummary.totalSubsGained)}`} label="Subs Gained" />
                <Metric value={`${filteredSummary.postingFrequency}d`} label="Days / Short" />
              </div>
            </div>
          </PNL>

          {/* ── 2. Views over time ── */}
          {chartData.length > 0 && (
            <PNL label="Views Over Time">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={fmt}
                    tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--gold) 6%, transparent)' }} />
                  <RBar dataKey="views" fill="var(--gold)" fillOpacity={0.72} radius={[2, 2, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </PNL>
          )}

          {/* ── 3. Correlation heatmap + Subscriber growth ── */}
          {allVideos.length > 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '10px' }}>
              <PNL label="Metric Correlations">
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Green = positive correlation · Red = negative · Strength by opacity
                </div>
                <CorrelationHeatmap videos={filteredAndSortedVideos.length > 2 ? filteredAndSortedVideos : allVideos} />
              </PNL>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <PNL label="Subscriber Growth">
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Cumulative subs across all {allVideos.length} videos
                  </div>
                  <ResponsiveContainer width="100%" height={190}>
                    <AreaChart data={cumSubsData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        interval={Math.floor(cumSubsData.length / 5)}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                      />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-primary)' }}
                        formatter={(value: any, _name: any, props: any) => [`${value} total (+${props.payload.gained})`, 'Subs']}
                        labelFormatter={(_: any, payload: readonly any[]) => payload?.[0]?.payload?.title || ''}
                      />
                      <Area type="monotone" dataKey="cumSubs" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.15} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--gold)', stroke: 'none' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </PNL>

                <PNL label="Retention Over Time">
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Avg view % per video — trend shows if content is improving
                  </div>
                  <ResponsiveContainer width="100%" height={155}>
                    <AreaChart data={retentionTrendData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        interval={Math.floor(retentionTrendData.length / 4)}
                      />
                      <YAxis
                        tickFormatter={v => `${v}%`}
                        tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 100]}
                        width={30}
                      />
                      <ReferenceLine y={45} stroke="#4ECB71" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'good', position: 'right', fontSize: 8, fill: '#4ECB71' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-primary)' }}
                        formatter={(v: any) => [`${(v as number).toFixed(1)}%`, 'Retention']}
                        labelFormatter={(_: any, payload: readonly any[]) => payload?.[0]?.payload?.title || ''}
                      />
                      <Area type="monotone" dataKey="retention" stroke="#4A9EDE" fill="#4A9EDE" fillOpacity={0.12} strokeWidth={2} dot={{ r: 2.5, fill: '#4A9EDE', stroke: 'none' }} activeDot={{ r: 4, fill: '#4A9EDE', stroke: 'none' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </PNL>

                <PNL label="Views Distribution">
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    How many videos hit each range — shows hit rate consistency
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={viewsDistData} layout="vertical" margin={{ top: 2, right: 24, left: 0, bottom: 2 }}>
                      <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontWeight: 600 }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-primary)' }}
                        formatter={(v: any) => [`${v} video${v !== 1 ? 's' : ''}`, '']}
                        cursor={{ fill: 'color-mix(in srgb, var(--gold) 5%, transparent)' }}
                      />
                      <RBar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={18} label={{ position: 'right', fontSize: 10, fill: 'var(--text-muted)', fontWeight: 700 }}>
                        {viewsDistData.map((d, i) => (
                          <Cell key={i} fill={d.color} fillOpacity={d.count > 0 ? 0.75 : 0.2} />
                        ))}
                      </RBar>
                    </BarChart>
                  </ResponsiveContainer>
                </PNL>
              </div>
            </div>
          )}

          {/* ── 4. Controls: time filter + sort ── */}
          <PNL>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '2px' }}>Period</span>
              {(['all', 'this_month', 'last_month', 'this_year', 'last_year'] as TimeFilter[]).map(f => (
                <button key={f} onClick={() => setTimeFilter(f)} style={{
                  padding: '3px 10px',
                  background: timeFilter === f ? 'var(--gold-dim)' : 'transparent',
                  color: timeFilter === f ? 'var(--gold)' : 'var(--text-secondary)',
                  border: `1px solid ${timeFilter === f ? 'var(--gold-border)' : 'var(--border-default)'}`,
                  borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em',
                }}>
                  {f === 'all' ? 'All' : f === 'this_month' ? 'This Month' : f === 'last_month' ? 'Last Month' : f === 'this_year' ? 'This Year' : 'Last Year'}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sort</span>
                <select value={sortOption} onChange={e => setSortOption(e.target.value as SortOption)} style={{
                  padding: '3px 8px', border: '1px solid var(--border-default)', borderRadius: '4px',
                  fontSize: '11px', background: 'var(--bg-base)', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
                }}>
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="views_desc">Most Views</option>
                  <option value="views_asc">Least Views</option>
                  <option value="likes_desc">Most Likes</option>
                  <option value="likes_asc">Least Likes</option>
                  <option value="like_ratio_desc">Highest Like %</option>
                  <option value="like_ratio_asc">Lowest Like %</option>
                  <option value="comment_ratio_desc">Highest Comment %</option>
                  <option value="comment_ratio_asc">Lowest Comment %</option>
                  <option value="shares_desc">Most Shares</option>
                  <option value="shares_asc">Least Shares</option>
                  <option value="avg_view_pct_desc">Best Retention</option>
                  <option value="avg_view_pct_asc">Worst Retention</option>
                  <option value="subs_gained_desc">Most Subs Gained</option>
                </select>
              </div>
            </div>
          </PNL>

          {/* ── 5. Dense video table ── */}
          {loadingVideos ? (
            <PNL>
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Loading videos…</div>
            </PNL>
          ) : (
            <PNL label={`Videos (${filteredAndSortedVideos.length})`}>
              {filteredAndSortedVideos.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No videos found for the selected period
                </div>
              ) : (
                <>
                  {/* Column headers */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '3ch 76px 1fr 96px 56px 58px 46px 24px',
                    gap: '10px',
                    alignItems: 'center',
                    padding: '2px 6px 6px',
                    borderBottom: '1px solid var(--border-default)',
                    marginBottom: '2px',
                  }}>
                    {['#', '', 'Title', 'Views', 'Like%', 'Ret.', 'Subs', ''].map((h, i) => (
                      <div key={i} style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
                    ))}
                  </div>

                  {/* Rows */}
                  {filteredAndSortedVideos.map((video, idx) => (
                    <div
                      key={video.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '3ch 76px 1fr 96px 56px 58px 46px 24px',
                        gap: '10px',
                        alignItems: 'center',
                        padding: '7px 6px',
                        borderBottom: '1px solid var(--border-subtle)',
                        borderRadius: '3px',
                        transition: 'background 0.1s',
                        cursor: 'default',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-base)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Rank */}
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                        {idx + 1}
                      </div>

                      {/* Thumbnail */}
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        style={{ width: '76px', height: '43px', borderRadius: '3px', objectFit: 'cover', border: '1px solid var(--border-subtle)', display: 'block' }}
                      />

                      {/* Title + date */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {video.title}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                          {new Date(video.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>

                      {/* Views + bar */}
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                          {video.viewCount}
                        </div>
                        <InlineBar value={video.rawViewCount} max={maxViews} />
                      </div>

                      {/* Like ratio */}
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
                        {video.likesToViewsRatio.toFixed(2)}%
                      </div>

                      {/* Retention (color-coded) */}
                      <div style={{ fontSize: '12px', fontWeight: 700, color: retCol(video.avgViewPercentage), letterSpacing: '-0.01em' }}>
                        {video.avgViewPercentage.toFixed(1)}%
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '1px' }}>
                          {fmtDuration(video.avgViewDuration)}
                        </div>
                      </div>

                      {/* Subs gained */}
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
                        +{video.subscribersGained}
                      </div>

                      {/* Watch link */}
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        title="Watch on YouTube"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'color 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    </div>
                  ))}
                </>
              )}
            </PNL>
          )}

        </div>
      )}
    </div>
  );
}
