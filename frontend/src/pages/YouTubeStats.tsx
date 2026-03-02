import React, { useState, useEffect, useMemo } from 'react';

interface ChannelStats {
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
  likeCount: string;
  commentCount: string;
  title: string;
  description: string;
  thumbnail: string;
  customUrl: string;
  rawSubscriberCount: number;
  rawViewCount: number;
  rawVideoCount: number;
  rawLikeCount: number;
  rawCommentCount: number;
}

interface VideoStats {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
  commentCount: string;
  url: string;
  rawViewCount: number;
  rawLikeCount: number;
  rawCommentCount: number;
  // Calculated ratios
  likesToViewsRatio: number;
  commentsToViewsRatio: number;
}

type TimeFilter = 'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year';
type SortOption = 'date_desc' | 'date_asc' | 'views_desc' | 'views_asc' | 'likes_desc' | 'likes_asc' | 'like_ratio_desc' | 'like_ratio_asc' | 'comment_ratio_desc' | 'comment_ratio_asc';

export default function YouTubeStats() {
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [allVideos, setAllVideos] = useState<VideoStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [channelId, setChannelId] = useState<string>('');

  useEffect(() => {
    fetchChannelStats();
  }, []);

  useEffect(() => {
    if (channelId) {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      if (apiKey) {
        fetchRecentVideos(channelId, apiKey);
      }
    }
  }, [channelId]);

  const fetchChannelStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      if (!apiKey) {
        setError('YouTube API key not configured');
        setLoading(false);
        return;
      }

      const channelHandle = '@knavishmantis';
      let channelIdToUse = channelHandle;
      
      // Get channel ID from handle if needed
      if (channelHandle.startsWith('@')) {
        const searchResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelHandle)}&type=channel&key=${apiKey}`
        );
        const searchData = await searchResponse.json();
        if (searchData.items && searchData.items.length > 0) {
          channelIdToUse = searchData.items[0].snippet.channelId;
        }
      }

      setChannelId(channelIdToUse);

      // Get channel statistics
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIdToUse}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const channel = data.items[0];
        setStats({
          subscriberCount: formatNumber(channel.statistics.subscriberCount),
          viewCount: formatNumber(channel.statistics.viewCount),
          videoCount: formatNumber(channel.statistics.videoCount),
          likeCount: '0', // Will be calculated from videos
          commentCount: '0', // Will be calculated from videos
          title: channel.snippet.title,
          description: channel.snippet.description,
          thumbnail: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default.url,
          customUrl: channel.snippet.customUrl || `https://youtube.com/${channelHandle}`,
          rawSubscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
          rawViewCount: parseInt(channel.statistics.viewCount || '0'),
          rawVideoCount: parseInt(channel.statistics.videoCount || '0'),
          rawLikeCount: 0, // Will be calculated from videos
          rawCommentCount: 0, // Will be calculated from videos
        });
      } else {
        setError('Channel not found');
      }
    } catch (err) {
      console.error('Failed to fetch YouTube stats:', err);
      setError('Failed to load channel statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentVideos = async (channelId: string, apiKey: string) => {
    setLoadingVideos(true);
    try {
      // Get uploads playlist ID
      const channelResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
      );
      const channelData = await channelResponse.json();
      
      if (!channelData.items || channelData.items.length === 0) {
        setLoadingVideos(false);
        return;
      }

      const uploadsPlaylistId = channelData.items[0].contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) {
        setLoadingVideos(false);
        return;
      }

      // Get more videos (50 for better filtering)
      const playlistResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`
      );
      const playlistData = await playlistResponse.json();

      if (!playlistData.items || playlistData.items.length === 0) {
        setLoadingVideos(false);
        return;
      }

      // Get video IDs
      const videoIds = playlistData.items.map((item: any) => item.snippet.resourceId.videoId).join(',');

      // Get video statistics
      const videosResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`
      );
      const videosData = await videosResponse.json();

      if (videosData.items) {
        const videoStats: VideoStats[] = videosData.items.map((video: any) => {
          const views = parseInt(video.statistics.viewCount || '0');
          const likes = parseInt(video.statistics.likeCount || '0');
          const comments = parseInt(video.statistics.commentCount || '0');
          
          return {
            id: video.id,
            title: video.snippet.title,
            thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url,
            publishedAt: video.snippet.publishedAt,
            viewCount: formatNumber(views),
            likeCount: formatNumber(likes),
            commentCount: formatNumber(comments),
            url: `https://www.youtube.com/watch?v=${video.id}`,
            rawViewCount: views,
            rawLikeCount: likes,
            rawCommentCount: comments,
            likesToViewsRatio: views > 0 ? (likes / views) * 100 : 0,
            commentsToViewsRatio: views > 0 ? (comments / views) * 100 : 0,
          };
        });
        setAllVideos(videoStats);
      }
    } catch (err) {
      console.error('Failed to fetch video stats:', err);
    } finally {
      setLoadingVideos(false);
    }
  };

  const formatNumber = (num: string | number): string => {
    const n = typeof num === 'string' ? parseInt(num) : num;
    if (n >= 1000000) {
      return (n / 1000000).toFixed(1) + 'M';
    } else if (n >= 1000) {
      return (n / 1000).toFixed(1) + 'K';
    }
    return n.toString();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter and sort videos
  const filteredAndSortedVideos = useMemo(() => {
    let filtered = [...allVideos];

    // Apply time filter
    const now = new Date();
    if (timeFilter === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter(v => new Date(v.publishedAt) >= startOfMonth);
    } else if (timeFilter === 'last_month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      filtered = filtered.filter(v => {
        const date = new Date(v.publishedAt);
        return date >= startOfLastMonth && date <= endOfLastMonth;
      });
    } else if (timeFilter === 'this_year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      filtered = filtered.filter(v => new Date(v.publishedAt) >= startOfYear);
    } else if (timeFilter === 'last_year') {
      const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(now.getFullYear(), 0, 0);
      filtered = filtered.filter(v => {
        const date = new Date(v.publishedAt);
        return date >= startOfLastYear && date <= endOfLastYear;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'date_desc':
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        case 'date_asc':
          return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
        case 'views_desc':
          return b.rawViewCount - a.rawViewCount;
        case 'views_asc':
          return a.rawViewCount - b.rawViewCount;
        case 'likes_desc':
          return b.rawLikeCount - a.rawLikeCount;
        case 'likes_asc':
          return a.rawLikeCount - b.rawLikeCount;
        case 'like_ratio_desc':
          return b.likesToViewsRatio - a.likesToViewsRatio;
        case 'like_ratio_asc':
          return a.likesToViewsRatio - b.likesToViewsRatio;
        case 'comment_ratio_desc':
          return b.commentsToViewsRatio - a.commentsToViewsRatio;
        case 'comment_ratio_asc':
          return a.commentsToViewsRatio - b.commentsToViewsRatio;
        default:
          return 0;
      }
    });

    return filtered;
  }, [allVideos, timeFilter, sortOption]);

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    if (!stats) return null;
    
    const videosToUse = timeFilter === 'all' ? allVideos : filteredAndSortedVideos;
    const totalViews = videosToUse.reduce((sum, v) => sum + v.rawViewCount, 0);
    const totalLikes = videosToUse.reduce((sum, v) => sum + v.rawLikeCount, 0);
    const totalComments = videosToUse.reduce((sum, v) => sum + v.rawCommentCount, 0);
    const videoCount = videosToUse.length;

    // Calculate posting frequency: days from first video to now / number of videos
    let postingFrequency: string = 'N/A';
    if (videosToUse.length > 0) {
      const videoDates = videosToUse.map(v => new Date(v.publishedAt).getTime());
      const oldestDate = Math.min(...videoDates);
      const now = Date.now();
      const daysDiff = (now - oldestDate) / (1000 * 60 * 60 * 24); // Convert ms to days
      const daysPerVideo = daysDiff / videoCount;
      
      if (daysPerVideo < 1) {
        postingFrequency = '< 1';
      } else if (daysPerVideo < 10) {
        postingFrequency = daysPerVideo.toFixed(1);
      } else {
        postingFrequency = Math.round(daysPerVideo).toString();
      }
    }

    return {
      ...stats,
      viewCount: formatNumber(totalViews),
      videoCount: formatNumber(videoCount),
      likeCount: formatNumber(totalLikes),
      commentCount: formatNumber(totalComments),
      postingFrequency,
      rawViewCount: totalViews,
      rawVideoCount: videoCount,
      rawLikeCount: totalLikes,
      rawCommentCount: totalComments,
    };
  }, [stats, filteredAndSortedVideos, allVideos, timeFilter]);

  return (
    <div style={{ padding: '0 4px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── Page header ── */}
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
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading channel statistics…</div>
        </div>
      )}

      {error && (
        <div style={{ padding: '16px 20px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px', fontWeight: '600' }}>{error}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Make sure VITE_YOUTUBE_API_KEY is set in your .env file
          </div>
        </div>
      )}

      {filteredStats && !loading && (
        <div>
          {/* Channel Header */}
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
              src={filteredStats.thumbnail}
              alt={filteredStats.title}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--border-default)',
                boxShadow: 'var(--card-shadow)',
              }}
            />
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {filteredStats.title}
              </h2>
              <a
                href={`https://youtube.com/${filteredStats.customUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '12px',
                  color: 'var(--gold)',
                  textDecoration: 'none',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {filteredStats.customUrl} ↗
              </a>
            </div>
          </div>

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
                {filter === 'all' ? 'All Time' :
                 filter === 'this_month' ? 'This Month' :
                 filter === 'last_month' ? 'Last Month' :
                 filter === 'this_year' ? 'This Year' :
                 'Last Year'}
              </button>
            ))}
          </div>

          {/* Stats Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: '12px', 
            marginBottom: '24px',
          }}>
            {[
              { label: 'Subscribers', value: filteredStats.subscriberCount },
              { label: timeFilter === 'all' ? 'Total Views' : 'Filtered Views', value: filteredStats.viewCount },
              { label: timeFilter === 'all' ? 'Total Videos' : 'Filtered Videos', value: filteredStats.videoCount },
              { label: timeFilter === 'all' ? 'Total Likes' : 'Filtered Likes', value: filteredStats.likeCount },
              { label: timeFilter === 'all' ? 'Total Comments' : 'Filtered Comments', value: filteredStats.commentCount },
              { label: 'Days per Short', value: `1 every ${filteredStats.postingFrequency}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ 
                textAlign: 'center', 
                padding: '20px 16px', 
                background: 'var(--bg-surface)', 
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--card-shadow)',
              }}>
                <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--gold)', marginBottom: '6px', letterSpacing: '-0.03em' }}>
                  {value}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Videos Section */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                Videos <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>({filteredAndSortedVideos.length})</span>
              </h2>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sort</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  style={{
                    padding: '5px 10px',
                    border: '1px solid var(--border-default)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
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
                </select>
              </div>
            </div>
            
            {loadingVideos && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading video statistics…</div>
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
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'var(--gold-dim)',
                      color: 'var(--gold)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid var(--gold-border)',
                      letterSpacing: '0.04em',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      Watch
                    </div>

                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      style={{
                        width: '180px',
                        height: '101px',
                        borderRadius: '6px',
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: '1px solid var(--border-default)',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '72px' }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: '6px',
                        letterSpacing: '-0.01em',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {video.title}
                      </h3>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: '500' }}>
                        {new Date(video.publishedAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                      
                      {/* Stats Grid */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
                        gap: '8px',
                        fontSize: '12px',
                      }}>
                        <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', letterSpacing: '-0.01em' }}>
                            {video.viewCount}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Views</div>
                        </div>
                        <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', letterSpacing: '-0.01em' }}>
                            {video.likeCount}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Likes</div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {video.likesToViewsRatio.toFixed(2)}% ratio
                          </div>
                        </div>
                        <div style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', letterSpacing: '-0.01em' }}>
                            {video.commentCount}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Comments</div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {video.commentsToViewsRatio.toFixed(2)}% ratio
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {!loadingVideos && filteredAndSortedVideos.length === 0 && (
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
