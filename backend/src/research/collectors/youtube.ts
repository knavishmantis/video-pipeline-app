import { google } from 'googleapis';
import { config, CompetitorConfig } from '../config';
import { VideoData, VideoWithRatio, ChannelReport } from '../types';

const youtube = google.youtube('v3');

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY environment variable is required');
  return key;
}

async function resolveChannelId(competitor: CompetitorConfig): Promise<string | null> {
  if (competitor.channelId) return competitor.channelId;

  // Try handle-based lookup first
  try {
    const response = await youtube.channels.list({
      part: ['id'],
      forHandle: competitor.handle.replace('@', ''),
      auth: getApiKey(),
    } as any);

    if (response.data.items?.length) {
      return response.data.items[0].id || null;
    }
  } catch {
    // Fall through to search
  }

  // Fallback: search by name
  try {
    const response = await youtube.search.list({
      part: ['id', 'snippet'],
      q: competitor.name,
      type: ['channel'],
      maxResults: 5,
      auth: getApiKey(),
    } as any);

    const exactMatch = response.data.items?.find(
      (item: any) => item.snippet?.title?.toLowerCase() === competitor.name.toLowerCase()
    );
    return exactMatch?.id?.channelId || response.data.items?.[0]?.id?.channelId || null;
  } catch {
    return null;
  }
}

async function getUploadsPlaylistId(channelId: string): Promise<string | null> {
  const response: any = await youtube.channels.list({
    part: ['contentDetails'],
    id: [channelId],
    auth: getApiKey(),
  } as any);

  return response.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
}

function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] || '0') * 3600 +
    parseInt(match[2] || '0') * 60 +
    parseInt(match[3] || '0')
  );
}

async function fetchRecentVideos(channelId: string, maxVideos: number): Promise<VideoData[]> {
  const uploadsPlaylistId = await getUploadsPlaylistId(channelId);
  if (!uploadsPlaylistId) return [];

  const allVideos: VideoData[] = [];
  let nextPageToken: string | undefined;

  while (allVideos.length < maxVideos) {
    const playlistResponse: any = await youtube.playlistItems.list({
      part: ['contentDetails', 'snippet'],
      playlistId: uploadsPlaylistId,
      maxResults: Math.min(50, maxVideos - allVideos.length),
      pageToken: nextPageToken,
      auth: getApiKey(),
    } as any);

    const items = playlistResponse.data.items;
    if (!items?.length) break;

    const videoIds = items
      .map((i: any) => i.contentDetails?.videoId)
      .filter(Boolean);
    if (!videoIds.length) break;

    const detailsResponse: any = await youtube.videos.list({
      part: ['id', 'snippet', 'statistics', 'contentDetails'],
      id: videoIds,
      auth: getApiKey(),
    } as any);

    for (const video of detailsResponse.data.items || []) {
      const durationSec = parseDuration(video.contentDetails?.duration || '');
      allVideos.push({
        videoId: video.id,
        title: video.snippet?.title || '',
        description: (video.snippet?.description || '').slice(0, 300),
        channelName: video.snippet?.channelTitle || '',
        channelId,
        views: parseInt(video.statistics?.viewCount || '0'),
        likes: parseInt(video.statistics?.likeCount || '0'),
        comments: parseInt(video.statistics?.commentCount || '0'),
        publishedAt: video.snippet?.publishedAt || '',
        durationSec,
        isShort: durationSec <= 60,
      });
    }

    nextPageToken = playlistResponse.data.nextPageToken;
    if (!nextPageToken) break;

    // Gentle rate limit
    await new Promise((r) => setTimeout(r, 100));
  }

  return allVideos;
}

export async function collectYouTubeData(since: Date): Promise<ChannelReport[]> {
  getApiKey(); // Validate key exists before starting

  const reports: ChannelReport[] = [];

  for (const competitor of config.competitors) {
    console.log(`  Fetching ${competitor.name} (${competitor.handle})...`);

    const channelId = await resolveChannelId(competitor);
    if (!channelId) {
      console.warn(`  Could not resolve channel ID for ${competitor.name}, skipping`);
      continue;
    }

    const allVideos = await fetchRecentVideos(channelId, config.videosForAverage);
    if (allVideos.length === 0) {
      console.warn(`  No videos found for ${competitor.name}`);
      continue;
    }

    // Compute average/median views across all fetched videos
    const viewCounts = allVideos.map((v) => v.views).sort((a, b) => a - b);
    const avgViews = Math.round(
      viewCounts.reduce((a, b) => a + b, 0) / viewCounts.length
    );
    const medianViews = viewCounts[Math.floor(viewCounts.length / 2)];

    // Filter to videos published since last report, compute ratio
    const recentVideos: VideoWithRatio[] = allVideos
      .filter((v) => new Date(v.publishedAt) > since)
      .map((v) => ({
        ...v,
        ratio: Number((v.views / Math.max(avgViews, 1)).toFixed(2)),
      }))
      .sort((a, b) => b.ratio - a.ratio);

    const standouts = recentVideos.filter(
      (v) => v.ratio >= config.standoutThreshold
    );

    reports.push({
      channel: { channelId, handle: competitor.handle, name: competitor.name },
      avgViews,
      medianViews,
      recentVideos,
      standouts,
    });

    console.log(
      `  ${competitor.name}: ${allVideos.length} total, ${recentVideos.length} new, ${standouts.length} standouts (avg ${avgViews.toLocaleString()} views)`
    );
  }

  return reports;
}
