import { google } from 'googleapis';
import { query } from '../db';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
import path from 'path';
import { YouTubeTranscriptApi } from '@playzone/youtube-transcript/dist/api';
import he from 'he';

// Load .env from backend directory (default) and also from scripts directory
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
if (!YOUTUBE_API_KEY) {
  throw new Error('YOUTUBE_API_KEY environment variable is required');
}

const youtube = google.youtube('v3');

// camman18 channel ID - can be set via env var or found automatically
// To find manually: https://www.youtube.com/@camman18 -> copy channel ID from URL or use a tool
const DEFAULT_CHANNEL_ID = process.env.CAMMAN18_CHANNEL_ID || '';

async function getChannelIdByHandle(handle: string): Promise<string | null> {
  try {
    // Handle format: @camman18 (without @)
    const cleanHandle = handle.replace('@', '');
    const response = await youtube.channels.list({
      part: ['id', 'snippet'],
      forHandle: cleanHandle,
      auth: YOUTUBE_API_KEY,
    } as any);

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].id || null;
    }
    return null;
  } catch (error: any) {
    // Handle API might not be available in all regions/API versions
    logger.warn('Could not fetch channel ID by handle (API might not support this)', { 
      error: error.message, 
      handle 
    });
    return null;
  }
}

async function searchChannelByName(name: string): Promise<string | null> {
  try {
    // Search for channel by name
    const response = await youtube.search.list({
      part: ['id', 'snippet'],
      q: name,
      type: ['channel'],
      maxResults: 5,
      auth: YOUTUBE_API_KEY,
    } as any);

    if (response.data.items && response.data.items.length > 0) {
      // Try to find exact match
      const exactMatch = response.data.items.find(
        (item: any) => item.snippet?.title?.toLowerCase() === name.toLowerCase()
      );
      if (exactMatch?.id?.channelId) {
        return exactMatch.id.channelId;
      }
      // Return first result
      return response.data.items[0].id?.channelId || null;
    }
    return null;
  } catch (error: any) {
    logger.error('Error searching for channel', { error: error.message, name });
    return null;
  }
}

async function getChannelUploadsPlaylistId(channelId: string): Promise<string | null> {
  try {
    const response: any = await youtube.channels.list({
      part: ['contentDetails'],
      id: [channelId],
      auth: YOUTUBE_API_KEY,
    } as any);

    if (response.data.items && response.data.items.length > 0) {
      const uploadsPlaylistId = response.data.items[0].contentDetails?.relatedPlaylists?.uploads;
      return uploadsPlaylistId || null;
    }
    return null;
  } catch (error: any) {
    logger.error('Error fetching channel uploads playlist', { error: error.message, channelId });
    return null;
  }
}

async function fetchChannelVideos(channelId: string, maxResults: number = 1000): Promise<any[]> {
  const allVideos: any[] = [];
  let nextPageToken: string | undefined = undefined;
  const maxPerPage = 50; // YouTube API max per request

  logger.info('Starting to fetch videos', { channelId, maxResults });

  // Get the uploads playlist ID (more reliable than search.list)
  const uploadsPlaylistId = await getChannelUploadsPlaylistId(channelId);
  
  if (!uploadsPlaylistId) {
    logger.warn('Could not get uploads playlist, falling back to search.list');
    // Fallback to search.list if we can't get the playlist
    return await fetchChannelVideosViaSearch(channelId, maxResults);
  }

  logger.info('Using uploads playlist', { uploadsPlaylistId });

  while (allVideos.length < maxResults) {
    try {
      // Use playlistItems.list to get videos from the uploads playlist
      const response: any = await youtube.playlistItems.list({
        part: ['contentDetails', 'snippet'],
        playlistId: uploadsPlaylistId,
        maxResults: Math.min(maxPerPage, maxResults - allVideos.length),
        pageToken: nextPageToken,
        auth: YOUTUBE_API_KEY,
      } as any);

      if (!response.data.items || response.data.items.length === 0) {
        break;
      }

      const videoIds = response.data.items
        .map((item: any) => item.contentDetails?.videoId)
        .filter((id: any): id is string => !!id);

      if (videoIds.length === 0) {
        break;
      }

      // Get detailed video statistics
      const videoDetails: any = await youtube.videos.list({
        part: ['id', 'snippet', 'statistics', 'contentDetails'],
        id: videoIds,
        auth: YOUTUBE_API_KEY,
      } as any);

      if (videoDetails.data.items) {
        allVideos.push(...videoDetails.data.items);
        logger.info(`Fetched ${allVideos.length} videos so far`);
      }

      nextPageToken = response.data.nextPageToken || undefined;
      if (!nextPageToken) {
        logger.info('No more pages available', { totalVideos: allVideos.length });
        break;
      }

      // Rate limiting: YouTube API allows 10,000 units per day
      // Each playlistItems.list call costs 1 unit, videos.list costs 1 unit per video
      // Wait a bit to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      logger.error('Error fetching videos from playlist', { error: error.message, channelId });
      if (error.message.includes('quotaExceeded')) {
        logger.error('YouTube API quota exceeded. Please wait or increase quota.');
        break;
      }
      throw error;
    }
  }

  return allVideos;
}

async function fetchChannelVideosViaSearch(channelId: string, maxResults: number = 1000): Promise<any[]> {
  const allVideos: any[] = [];
  let nextPageToken: string | undefined = undefined;
  const maxPerPage = 50;

  logger.info('Fetching videos via search.list (fallback method)', { channelId, maxResults });

  while (allVideos.length < maxResults) {
    try {
      const response: any = await youtube.search.list({
        part: ['id', 'snippet'],
        channelId: channelId,
        type: ['video'],
        maxResults: Math.min(maxPerPage, maxResults - allVideos.length),
        order: 'date',
        pageToken: nextPageToken,
        auth: YOUTUBE_API_KEY,
      } as any);

      if (!response.data.items || response.data.items.length === 0) {
        break;
      }

      const videoIds = response.data.items
        .map((item: any) => item.id?.videoId)
        .filter((id: any): id is string => !!id);

      if (videoIds.length === 0) {
        break;
      }

      const videoDetails: any = await youtube.videos.list({
        part: ['id', 'snippet', 'statistics', 'contentDetails'],
        id: videoIds,
        auth: YOUTUBE_API_KEY,
      } as any);

      if (videoDetails.data.items) {
        allVideos.push(...videoDetails.data.items);
        logger.info(`Fetched ${allVideos.length} videos so far`);
      }

      nextPageToken = response.data.nextPageToken || undefined;
      if (!nextPageToken) {
        logger.info('No more pages available (search method)', { totalVideos: allVideos.length });
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      logger.error('Error fetching videos via search', { error: error.message, channelId });
      if (error.message.includes('quotaExceeded')) {
        logger.error('YouTube API quota exceeded. Please wait or increase quota.');
        break;
      }
      throw error;
    }
  }

  return allVideos;
}

async function fetchTranscript(videoId: string): Promise<{ transcript: string | null; source: string }> {
  try {
    // Use @playzone/youtube-transcript package (no API key needed, works with public transcripts)
    const api = new YouTubeTranscriptApi();
    const transcriptData = await api.fetch(videoId);
    
    if (!transcriptData || !transcriptData.snippets || transcriptData.snippets.length === 0) {
      logger.debug('No transcript available', { videoId });
      return { transcript: null, source: 'none' };
    }

    // Join all transcript snippets into a single text and decode HTML entities
    const transcript = he.decode(
      transcriptData.snippets
        .map((snippet: any) => snippet.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    );

    const source = 'youtube_transcript_api';

    return { transcript, source };
  } catch (error: any) {
    // Handle common errors
    if (error.message?.includes('Transcript is disabled') || 
        error.message?.includes('No transcript found') ||
        error.message?.includes('Could not retrieve a transcript') ||
        error.message?.includes('TranscriptsDisabled') ||
        error.message?.includes('NoTranscriptFound')) {
      logger.debug('Transcript not available for video', { videoId, error: error.message });
      return { transcript: null, source: 'none' };
    }
    
    logger.warn('Error fetching transcript', { 
      error: error.message, 
      videoId 
    });
    return { transcript: null, source: 'error' };
  }
}

async function storeVideo(video: any, channelId: string, channelName: string, transcript: string | null, transcriptSource: string): Promise<void> {
  const videoId = video.id;
  const snippet = video.snippet || {};
  const statistics = video.statistics || {};

  const views = parseInt(statistics.viewCount || '0', 10);
  const likes = parseInt(statistics.likeCount || '0', 10);
  const comments = parseInt(statistics.commentCount || '0', 10);
  const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt).toISOString() : null;

  try {
    // Use INSERT OR IGNORE / ON CONFLICT to avoid duplicates
    const isSqlite = process.env.DATABASE_URL?.startsWith('sqlite://');
    
    if (isSqlite) {
      await query(`
        INSERT OR IGNORE INTO analyzed_shorts 
        (youtube_video_id, channel_name, channel_id, title, description, views, likes, comments, published_at, transcript, transcript_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        videoId,
        channelName,
        channelId,
        snippet.title || '',
        snippet.description || null,
        views,
        likes,
        comments,
        publishedAt,
        transcript,
        transcriptSource,
      ]);
    } else {
      await query(`
        INSERT INTO analyzed_shorts 
        (youtube_video_id, channel_name, channel_id, title, description, views, likes, comments, published_at, transcript, transcript_source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (youtube_video_id) 
        DO UPDATE SET
          views = EXCLUDED.views,
          likes = EXCLUDED.likes,
          comments = EXCLUDED.comments,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          transcript = COALESCE(EXCLUDED.transcript, analyzed_shorts.transcript),
          transcript_source = COALESCE(EXCLUDED.transcript_source, analyzed_shorts.transcript_source),
          updated_at = CURRENT_TIMESTAMP
      `, [
        videoId,
        channelName,
        channelId,
        snippet.title || '',
        snippet.description || null,
        views,
        likes,
        comments,
        publishedAt,
        transcript,
        transcriptSource,
      ]);
    }
  } catch (error: any) {
    logger.error('Error storing video', { 
      error: error.message, 
      videoId,
      title: snippet.title 
    });
  }
}

function isValidChannelId(value: string): boolean {
  // YouTube channel IDs start with UC and are 24 characters long
  // Or they can be custom channel IDs (but those are less common)
  return value.startsWith('UC') && value.length === 24;
}

async function main() {
  try {
    logger.info('Starting camman18 shorts fetch script');

    // Try to find channel ID
    let channelId = DEFAULT_CHANNEL_ID;
    let channelName = 'camman18';

    // If channelId is provided but doesn't look like a valid channel ID, treat it as username/handle
    if (channelId && !isValidChannelId(channelId)) {
      logger.info('Provided value does not look like a channel ID, treating as username/handle', { value: channelId });
      const handleChannelId = await getChannelIdByHandle(channelId.startsWith('@') ? channelId : `@${channelId}`);
      if (handleChannelId) {
        channelId = handleChannelId;
        logger.info('Found channel ID by handle', { channelId });
      } else {
        const searchChannelId = await searchChannelByName(channelId);
        if (searchChannelId) {
          channelId = searchChannelId;
          logger.info('Found channel ID by search', { channelId });
        } else {
          throw new Error(
            `Could not find channel ID for "${channelId}". ` +
            'Please provide a valid channel ID (starts with UC, 24 chars) or set CAMMAN18_CHANNEL_ID to a valid channel ID. ' +
            'You can find the channel ID at: https://www.youtube.com/@camman18/about'
          );
        }
      }
    } else if (!channelId) {
      // Try handle first (@camman18)
      logger.info('Attempting to find channel ID by handle @camman18');
      const handleChannelId = await getChannelIdByHandle('@camman18');
      if (handleChannelId) {
        channelId = handleChannelId;
        logger.info('Found channel ID by handle', { channelId });
      } else {
        // Try searching by name
        logger.info('Attempting to find channel ID by searching for "camman18"');
        const searchChannelId = await searchChannelByName('camman18');
        if (searchChannelId) {
          channelId = searchChannelId;
          logger.info('Found channel ID by search', { channelId });
        } else {
          throw new Error(
            'Could not find channel ID automatically. ' +
            'Please set CAMMAN18_CHANNEL_ID environment variable to a valid channel ID. ' +
            'You can find the channel ID at: https://www.youtube.com/@camman18/about'
          );
        }
      }
    } else {
      logger.info('Using channel ID from environment variable', { channelId });
    }

    // Get channel name
    try {
      const channelResponse: any = await youtube.channels.list({
        part: ['snippet'],
        id: [channelId],
        auth: YOUTUBE_API_KEY,
      } as any);

      if (channelResponse.data.items && channelResponse.data.items.length > 0) {
        channelName = channelResponse.data.items[0].snippet?.title || 'camman18';
        logger.info('Channel name', { channelName });
      }
    } catch (error: any) {
      logger.warn('Could not fetch channel name', { error: error.message });
    }

    // Fetch videos
    const videos = await fetchChannelVideos(channelId, 1000);
    logger.info(`Fetched ${videos.length} videos`);

    // Store videos with transcripts
    let successCount = 0;
    let transcriptCount = 0;
    
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const videoId = video.id;
      
      logger.info(`Processing video ${i + 1}/${videos.length}`, { 
        videoId, 
        title: video.snippet?.title 
      });

      // Fetch transcript
      const { transcript, source } = await fetchTranscript(videoId);
      if (transcript) {
        transcriptCount++;
        logger.info('Transcript fetched', { videoId, length: transcript.length });
      } else {
        logger.warn('No transcript available', { videoId });
      }

      // Store video with transcript
      await storeVideo(video, channelId, channelName, transcript, source);
      successCount++;

      // Rate limiting: be nice to YouTube API
      // Captions.download costs 200 units per call
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    logger.info('Script completed successfully', { 
      totalVideos: videos.length,
      storedVideos: successCount,
      videosWithTranscripts: transcriptCount,
      channelId,
      channelName 
    });

    logger.info('Script completed successfully', { 
      totalVideos: videos.length,
      channelId,
      channelName 
    });
  } catch (error: any) {
    logger.error('Script failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      logger.info('Script finished');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Script error', { error });
      process.exit(1);
    });
}

