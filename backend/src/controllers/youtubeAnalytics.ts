import { Request, Response } from 'express';
import { query } from '../db';

export const youtubeAnalyticsController = {
  // GET /api/youtube-analytics - returns all video analytics
  getAll: async (_req: Request, res: Response) => {
    try {
      const result = await query(
        'SELECT * FROM youtube_video_analytics ORDER BY views DESC'
      );
      res.json(result.rows);
    } catch (error: any) {
      console.error('Failed to fetch youtube analytics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  },

  // GET /api/youtube-analytics/pipeline - analytics joined with shorts data
  getPipeline: async (_req: Request, res: Response) => {
    try {
      const result = await query(`
        SELECT
          s.id as short_id,
          s.title as short_title,
          s.status,
          s.created_at as pipeline_created_at,
          s.updated_at as pipeline_updated_at,
          s.youtube_video_id,
          s.clips_completed_at,
          s.editing_completed_at,
          ya.title as youtube_title,
          ya.views,
          ya.likes,
          ya.comments,
          ya.shares,
          ya.average_view_percentage,
          ya.average_view_duration,
          ya.estimated_minutes_watched,
          ya.subscribers_gained,
          ya.subscribers_lost,
          ya.engagement_rate,
          ya.like_rate,
          ya.published_at as youtube_published_at,
          ya.duration_sec
        FROM shorts s
        LEFT JOIN youtube_video_analytics ya ON s.youtube_video_id = ya.video_id
        WHERE s.youtube_video_id IS NOT NULL
        ORDER BY ya.views DESC NULLS LAST
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error('Failed to fetch pipeline analytics:', error);
      res.status(500).json({ error: 'Failed to fetch pipeline analytics' });
    }
  },

  // POST /api/youtube-analytics/sync - upsert analytics data (called by GH Action)
  sync: async (req: Request, res: Response) => {
    try {
      const { videos } = req.body;
      if (!Array.isArray(videos)) {
        return res.status(400).json({ error: 'Expected { videos: [...] }' });
      }

      let upserted = 0;
      for (const v of videos) {
        await query(
          `INSERT INTO youtube_video_analytics (
            video_id, title, published_at, duration_sec, is_short,
            views, estimated_minutes_watched, average_view_duration, average_view_percentage,
            likes, dislikes, comments, shares,
            subscribers_gained, subscribers_lost,
            like_rate, comment_rate, share_rate, sub_gain_rate, engagement_rate,
            fetched_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
          ON CONFLICT (video_id) DO UPDATE SET
            title = EXCLUDED.title,
            published_at = EXCLUDED.published_at,
            duration_sec = EXCLUDED.duration_sec,
            is_short = EXCLUDED.is_short,
            views = EXCLUDED.views,
            estimated_minutes_watched = EXCLUDED.estimated_minutes_watched,
            average_view_duration = EXCLUDED.average_view_duration,
            average_view_percentage = EXCLUDED.average_view_percentage,
            likes = EXCLUDED.likes,
            dislikes = EXCLUDED.dislikes,
            comments = EXCLUDED.comments,
            shares = EXCLUDED.shares,
            subscribers_gained = EXCLUDED.subscribers_gained,
            subscribers_lost = EXCLUDED.subscribers_lost,
            like_rate = EXCLUDED.like_rate,
            comment_rate = EXCLUDED.comment_rate,
            share_rate = EXCLUDED.share_rate,
            sub_gain_rate = EXCLUDED.sub_gain_rate,
            engagement_rate = EXCLUDED.engagement_rate,
            fetched_at = EXCLUDED.fetched_at`,
          [
            v.video_id, v.title, v.published_at, v.duration_sec, v.is_short,
            v.views, v.estimated_minutes_watched, v.average_view_duration, v.average_view_percentage,
            v.likes, v.dislikes, v.comments, v.shares,
            v.subscribers_gained, v.subscribers_lost,
            v.like_rate, v.comment_rate, v.share_rate, v.sub_gain_rate, v.engagement_rate,
            v.fetched_at || new Date().toISOString()
          ]
        );
        upserted++;
      }

      res.json({ message: `Synced ${upserted} videos` });
    } catch (error: any) {
      console.error('Failed to sync youtube analytics:', error);
      res.status(500).json({ error: 'Failed to sync analytics' });
    }
  },
};
