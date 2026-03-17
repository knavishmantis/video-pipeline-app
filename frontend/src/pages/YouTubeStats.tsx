import React, { useState, useEffect, useMemo } from 'react';
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
  // Formatted
  viewCount: string;
  likeCount: string;
  commentCount: string;
  // Calculated ratios
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
      if (!apiKey) {
        setLoadingChannel(false);
        return;
      }

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
          subscriberCount: formatNumber(ch.statistics.subscriberCount),
          viewCount: formatNumber(ch.statistics.viewCount),
          videoCount: formatNumber(ch.statistics.videoCount),
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
        viewCount: formatNumber(v.views),
        likeCount: formatNumber(v.likes),
        commentCount: formatNumber(v.comments),
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

  const formatNumber = (num: string | number): string => {
    const n = typeof num === 'string' ? parseInt(num) : num;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const loading = loadingChannel && loadingVideos;

  return (
    <div style={{ padding: '0 4px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
          Channel
        </p>
        <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
          YouTube Stats
        </h1>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading analytics…</div>
        </div>
      )}

      {error && !loadingVideos && (
        <div style={{ padding: '16px 20px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-strong)', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600' }}>{error}</div>
        </div>
      )}

      {!loading && (
        <div>
          {/* Channel Header (only if YouTube API key available) */}
          {channelStats && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              marginBottom: '24px',
              padding: '20px 24px',
              background: 'var(--bg-surface)',
              borderRadius: '10px',
              border: '1px solid var(--border-default)',
              borderLeft: '3px solid var(--gold)',
              boxShadow: 'var(--card-shadow)',
            }}>
              <img
                src={channelStats.thumbnail}
                alt={channelStats.title}
                style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-default)', boxShadow: 'var(--card-shadow)' }}
              />
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {channelStats.title}
                </h2>
                <a
                  href={`https://youtube.com/${channelStats.customUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: 'var(--gold)', textDecoration: 'none', fontWeight: '600' }}
                >
                  {channelStats.customUrl} ↗
                </a>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--gold)', letterSpacing: '-0.03em' }}>{channelStats.subscriberCount}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subscribers</div>
              </div>
            </div>
          )}

          {/* Time Filter */}
          <div style={{
            marginBottom: '20px',
            padding: '10px 14px',
            background: 'var(--bg-surface)',
            borderRadius: '8px',
            border: '1px solid var(--border-default)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
            boxShadow: 'var(--card-shadow)',
          }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: '4px' }}>Period</span>
            {(['all', 'this_month', 'last_month', 'this_year', 'last_year'] as TimeFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                style={{
                  padding: '5px 12px',
                  background: timeFilter === filter ? 'var(--gold-dim)' : 'transparent',
                  color: timeFilter === filter ? 'var(--gold)' : 'var(--text-secondary)',
                  border: timeFilter === filter ? '1px solid var(--gold-border)' : '1px solid var(--border-default)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  letterSpacing: '-0.01em',
                }}
              >
                {filter === 'all' ? 'All Time' : filter === 'this_month' ? 'This Month' : filter === 'last_month' ? 'Last Month' : filter === 'this_year' ? 'This Year' : 'Last Year'}
              </button>
            ))}
          </div>

          {/* Summary Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: timeFilter === 'all' ? 'Total Views' : 'Filtered Views', value: formatNumber(filteredSummary.totalViews) },
              { label: timeFilter === 'all' ? 'Total Videos' : 'Filtered Videos', value: filteredSummary.videoCount.toString() },
              { label: timeFilter === 'all' ? 'Total Likes' : 'Filtered Likes', value: formatNumber(filteredSummary.totalLikes) },
              { label: timeFilter === 'all' ? 'Total Shares' : 'Filtered Shares', value: formatNumber(filteredSummary.totalShares) },
              { label: timeFilter === 'all' ? 'Total Comments' : 'Filtered Comments', value: formatNumber(filteredSummary.totalComments) },
              { label: 'Avg Retention', value: `${filteredSummary.avgRetention.toFixed(1)}%` },
              { label: 'Subs Gained', value: `+${formatNumber(filteredSummary.totalSubsGained)}` },
              { label: 'Days per Short', value: `1 / ${filteredSummary.postingFrequency}d` },
            ].map(({ label, value }) => (
              <div key={label} style={{
                textAlign: 'center',
                padding: '20px 16px',
                background: 'var(--bg-surface)',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--card-shadow)',
              }}>
                <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--gold)', marginBottom: '6px', letterSpacing: '-0.03em' }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Videos Section */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                Videos <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>({filteredAndSortedVideos.length})</span>
              </h2>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sort</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  style={{ padding: '5px 10px', border: '1px solid var(--border-default)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="views_desc">Most Views</option>
                  <option value="views_asc">Least Views</option>
                  <option value="likes_desc">Most Likes</option>
                  <option value="likes_asc">Least Likes</option>
                  <option value="like_ratio_desc">Highest Like Ratio</option>
                  <option value="like_ratio_asc">Lowest Like Ratio</option>
                  <option value="comment_ratio_desc">Highest Comment Ratio</option>
                  <option value="comment_ratio_asc">Lowest Comment Ratio</option>
                  <option value="shares_desc">Most Shares</option>
                  <option value="shares_asc">Least Shares</option>
                  <option value="avg_view_pct_desc">Best Retention</option>
                  <option value="avg_view_pct_asc">Worst Retention</option>
                  <option value="subs_gained_desc">Most Subs Gained</option>
                </select>
              </div>
            </div>

            {loadingVideos && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading video analytics…</div>
              </div>
            )}

            {!loadingVideos && filteredAndSortedVideos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredAndSortedVideos.map((video) => (
                  <a
                    key={video.id}
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      gap: '14px',
                      padding: '16px',
                      background: 'var(--bg-surface)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-default)',
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                      position: 'relative',
                      boxShadow: 'var(--card-shadow)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--gold-border)';
                      e.currentTarget.style.boxShadow = 'var(--card-hover-shadow)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                      e.currentTarget.style.boxShadow = 'var(--card-shadow)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Watch badge */}
                    <div style={{
                      position: 'absolute', top: '10px', right: '10px',
                      background: 'var(--gold-dim)', color: 'var(--gold)',
                      padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700',
                      display: 'flex', alignItems: 'center', gap: '4px',
                      border: '1px solid var(--gold-border)', letterSpacing: '0.04em',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      Watch
                    </div>

                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      style={{ width: '180px', height: '101px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-default)' }}
                    />

                    <div style={{ flex: 1, minWidth: 0, paddingRight: '72px' }}>
                      <h3 style={{
                        margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)',
                        marginBottom: '6px', letterSpacing: '-0.01em',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {video.title}
                      </h3>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: '500' }}>
                        {new Date(video.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>

                      {/* Stats Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', fontSize: '12px' }}>
                        <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', letterSpacing: '-0.01em' }}>{video.viewCount}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Views</div>
                        </div>
                        <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', letterSpacing: '-0.01em' }}>{video.likeCount}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Likes</div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>{video.likesToViewsRatio.toFixed(2)}% ratio</div>
                        </div>
                        <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', letterSpacing: '-0.01em' }}>{video.commentCount}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Comments</div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>{video.commentsToViewsRatio.toFixed(2)}% ratio</div>
                        </div>
                        <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', letterSpacing: '-0.01em' }}>{formatNumber(video.shares)}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Shares</div>
                        </div>
                        <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', letterSpacing: '-0.01em' }}>{video.avgViewPercentage.toFixed(1)}%</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Retention</div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>{formatDuration(video.avgViewDuration)} avg</div>
                        </div>
                        <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', letterSpacing: '-0.01em' }}>+{video.subscribersGained}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Subs Gained</div>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {!loadingVideos && filteredAndSortedVideos.length === 0 && !error && (
              <div style={{ padding: '32px', background: 'var(--bg-surface)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', border: '1px solid var(--border-default)' }}>
                No videos found for the selected time period
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
