import React, { useState, useEffect, useMemo } from 'react';

interface ChannelStats {
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
  title: string;
  description: string;
  thumbnail: string;
  customUrl: string;
  rawSubscriberCount: number;
  rawViewCount: number;
  rawVideoCount: number;
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
          title: channel.snippet.title,
          description: channel.snippet.description,
          thumbnail: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default.url,
          customUrl: channel.snippet.customUrl || `https://youtube.com/${channelHandle}`,
          rawSubscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
          rawViewCount: parseInt(channel.statistics.viewCount || '0'),
          rawVideoCount: parseInt(channel.statistics.videoCount || '0'),
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
    
    if (timeFilter === 'all') {
      return stats;
    }

    const totalViews = filteredAndSortedVideos.reduce((sum, v) => sum + v.rawViewCount, 0);
    const videoCount = filteredAndSortedVideos.length;

    return {
      ...stats,
      viewCount: formatNumber(totalViews),
      videoCount: formatNumber(videoCount),
      rawViewCount: totalViews,
      rawVideoCount: videoCount,
    };
  }, [stats, filteredAndSortedVideos, timeFilter]);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1E293B', marginBottom: '24px' }}>
        YouTube Channel Stats
      </h1>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '16px', color: '#64748B' }}>Loading channel statistics...</div>
        </div>
      )}

      {error && (
        <div style={{ padding: '24px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
          <div style={{ fontSize: '16px', color: '#DC2626', marginBottom: '8px', fontWeight: '500' }}>{error}</div>
          <div style={{ fontSize: '14px', color: '#991B1B' }}>
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
            marginBottom: '32px',
            padding: '24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px',
            color: 'white',
          }}>
            <img
              src={filteredStats.thumbnail}
              alt={filteredStats.title}
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            />
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
                {filteredStats.title}
              </h2>
              <a
                href={`https://youtube.com/${filteredStats.customUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.9)',
                  textDecoration: 'none',
                  fontWeight: '500',
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
            marginBottom: '24px',
            padding: '16px',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #E5E7EB',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Time Period:</div>
            {(['all', 'this_month', 'last_month', 'this_year', 'last_year'] as TimeFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                style={{
                  padding: '6px 12px',
                  background: timeFilter === filter ? '#3B82F6' : '#F3F4F6',
                  color: timeFilter === filter ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '20px', 
            marginBottom: '32px' 
          }}>
            <div style={{ 
              textAlign: 'center', 
              padding: '24px', 
              background: 'white', 
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#DC2626', marginBottom: '8px' }}>
                {filteredStats.subscriberCount}
              </div>
              <div style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>Subscribers</div>
            </div>
            <div style={{ 
              textAlign: 'center', 
              padding: '24px', 
              background: 'white', 
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#DC2626', marginBottom: '8px' }}>
                {filteredStats.viewCount}
              </div>
              <div style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>
                {timeFilter === 'all' ? 'Total Views' : 'Filtered Views'}
              </div>
            </div>
            <div style={{ 
              textAlign: 'center', 
              padding: '24px', 
              background: 'white', 
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#DC2626', marginBottom: '8px' }}>
                {filteredStats.videoCount}
              </div>
              <div style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>
                {timeFilter === 'all' ? 'Total Videos' : 'Filtered Videos'}
              </div>
            </div>
          </div>

          {/* Videos Section */}
          <div style={{ marginTop: '32px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '16px',
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1E293B', margin: 0 }}>
                Videos ({filteredAndSortedVideos.length})
              </h2>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: '#64748B', fontWeight: '500' }}>Sort by:</div>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'white',
                    color: '#374151',
                    cursor: 'pointer',
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
                <div style={{ fontSize: '14px', color: '#64748B' }}>Loading video statistics...</div>
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
                      gap: '16px',
                      padding: '20px',
                      background: 'white',
                      borderRadius: '12px',
                      border: '2px solid #E5E7EB',
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#DC2626';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.15)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E5E7EB';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* YouTube Icon Indicator */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: '#DC2626',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      Watch
                    </div>

                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      style={{
                        width: '200px',
                        height: '112px',
                        borderRadius: '8px',
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: '1px solid #E5E7EB',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '80px' }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1E293B',
                        marginBottom: '8px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {video.title}
                      </h3>
                      <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
                        Published: {new Date(video.publishedAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                      
                      {/* Stats Grid */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', 
                        gap: '10px',
                        fontSize: '13px',
                      }}>
                        <div style={{ padding: '10px', background: '#F9FAFB', borderRadius: '6px' }}>
                          <div style={{ fontWeight: '600', color: '#374151', marginBottom: '2px' }}>
                            {video.viewCount}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Views</div>
                        </div>
                        <div style={{ padding: '10px', background: '#F9FAFB', borderRadius: '6px' }}>
                          <div style={{ fontWeight: '600', color: '#374151', marginBottom: '2px' }}>
                            {video.likeCount}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Likes</div>
                          <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>
                            {video.likesToViewsRatio.toFixed(2)}% ratio
                          </div>
                        </div>
                        <div style={{ padding: '10px', background: '#F9FAFB', borderRadius: '6px' }}>
                          <div style={{ fontWeight: '600', color: '#374151', marginBottom: '2px' }}>
                            {video.commentCount}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>Comments</div>
                          <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>
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
              <div style={{ padding: '24px', background: '#F9FAFB', borderRadius: '8px', textAlign: 'center', color: '#64748B' }}>
                No videos found for the selected time period
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
