import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const analyzedShortsController = {
  async getRandomUnrated(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Get a random unrated script (where reviewed_at is NULL or review_user_id is different)
      const isSqlite = process.env.DATABASE_URL?.startsWith('sqlite://');
      
      // SQLite uses different syntax for random and placeholders
      if (isSqlite) {
        const result = await query(`
          SELECT id, youtube_video_id, title, transcript, views, likes, comments, published_at
          FROM analyzed_shorts
          WHERE (reviewed_at IS NULL OR review_user_id != ? OR review_user_id IS NULL)
            AND transcript IS NOT NULL
            AND transcript != ''
          ORDER BY RANDOM()
          LIMIT 1
        `, [req.userId]);
        
        if (result.rows.length === 0) {
          res.status(404).json({ error: 'No unrated scripts available' });
          return;
        }
        res.json(result.rows[0]);
        return;
      }
      
      const result = await query(`
        SELECT id, youtube_video_id, title, transcript, views, likes, comments, published_at
        FROM analyzed_shorts
        WHERE (reviewed_at IS NULL OR review_user_id != $1 OR review_user_id IS NULL)
          AND transcript IS NOT NULL
          AND transcript != ''
        ORDER BY RANDOM()
        LIMIT 1
      `, [req.userId]);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'No unrated scripts available' });
        return;
      }

      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Get random unrated script error', { error });
      res.status(500).json({ error: 'Failed to fetch random script' });
    }
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const result = await query(`
        SELECT 
          id, youtube_video_id, channel_name, channel_id, title, description,
          transcript, transcript_source, views, likes, comments, published_at,
          percentile, user_guess_percentile, notes, reviewed_at, review_user_id
        FROM analyzed_shorts
        WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Script not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Get analyzed short error', { error, shortId: id });
      res.status(500).json({ error: 'Failed to fetch script' });
    }
  },

  async submitReview(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { guess_percentile, notes } = req.body;

    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      if (typeof guess_percentile !== 'number' || guess_percentile < 0 || guess_percentile > 100) {
        res.status(400).json({ error: 'guess_percentile must be a number between 0 and 100' });
        return;
      }

      // Get the script to calculate actual percentile if not already calculated
      const scriptResult = await query(`
        SELECT id, views, percentile
        FROM analyzed_shorts
        WHERE id = $1
      `, [id]);

      if (scriptResult.rows.length === 0) {
        res.status(404).json({ error: 'Script not found' });
        return;
      }

      const script = scriptResult.rows[0];
      let actualPercentile = script.percentile;

      // Calculate percentile if not already stored
      // Percentile calculation: What percentage of videos have fewer views than this one?
      // Formula: (videos_with_lower_views / total_videos) * 100
      // Example: If 87 out of 100 videos have fewer views, this is the 87th percentile
      if (actualPercentile === null) {
        const allVideosResult = await query(`
          SELECT views FROM analyzed_shorts WHERE views > 0 ORDER BY views
        `);
        
        if (allVideosResult.rows.length > 0) {
          const sortedViews = allVideosResult.rows.map((r: any) => r.views);
          const totalVideos = sortedViews.length;
          const videosWithLowerViews = sortedViews.filter((v: number) => v < script.views).length;
          
          // Calculate percentile: percentage of videos with lower views
          actualPercentile = (videosWithLowerViews / totalVideos) * 100;
          
          // Store calculated percentile for future use
          const isSqlite = process.env.DATABASE_URL?.startsWith('sqlite://');
          if (isSqlite) {
            await query(`
              UPDATE analyzed_shorts 
              SET percentile = ? 
              WHERE id = ?
            `, [actualPercentile, id]);
          } else {
            await query(`
              UPDATE analyzed_shorts 
              SET percentile = $1 
              WHERE id = $2
            `, [actualPercentile, id]);
          }
        }
      }

      // Calculate error
      const error = Math.abs(guess_percentile - actualPercentile);

      // Update the script with review
      const isSqlite = process.env.DATABASE_URL?.startsWith('sqlite://');
      
      if (isSqlite) {
        await query(`
          UPDATE analyzed_shorts
          SET user_guess_percentile = ?,
              notes = ?,
              reviewed_at = CURRENT_TIMESTAMP,
              review_user_id = ?
          WHERE id = ?
        `, [guess_percentile, notes || null, req.userId, id]);
      } else {
        await query(`
          UPDATE analyzed_shorts
          SET user_guess_percentile = $1,
              notes = $2,
              reviewed_at = CURRENT_TIMESTAMP,
              review_user_id = $3
          WHERE id = $4
        `, [guess_percentile, notes || null, req.userId, id]);
      }

      res.json({
        actual_percentile: actualPercentile,
        guess_percentile,
        error,
        difference: guess_percentile - actualPercentile,
      });
    } catch (error) {
      logger.error('Submit review error', { error, shortId: id });
      res.status(500).json({ error: 'Failed to submit review' });
    }
  },

  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Get all reviews by this user
      const allReviewsResult = await query(`
        SELECT 
          user_guess_percentile,
          percentile,
          reviewed_at
        FROM analyzed_shorts
        WHERE review_user_id = $1
          AND user_guess_percentile IS NOT NULL
          AND percentile IS NOT NULL
        ORDER BY reviewed_at DESC
      `, [req.userId]);

      const allReviews = allReviewsResult.rows.map((r: any) => ({
        guess: r.user_guess_percentile,
        actual: r.percentile,
        error: Math.abs(r.user_guess_percentile - r.percentile),
        reviewed_at: r.reviewed_at,
      }));

      // Calculate stats
      const calculateStats = (reviews: typeof allReviews) => {
        if (reviews.length === 0) {
          return {
            count: 0,
            avg_error: 0,
            min_error: 0,
            max_error: 0,
          };
        }

        const errors = reviews.map(r => r.error);
        return {
          count: reviews.length,
          avg_error: errors.reduce((a, b) => a + b, 0) / errors.length,
          min_error: Math.min(...errors),
          max_error: Math.max(...errors),
        };
      };

      const last10 = allReviews.slice(0, 10);
      const last30 = allReviews.slice(0, 30);
      const allTime = allReviews;

      // Get total count of scripts with transcripts
      const totalResult = await query(`
        SELECT COUNT(*) as total
        FROM analyzed_shorts
        WHERE transcript IS NOT NULL AND transcript != ''
      `, []);
      const total = parseInt(totalResult.rows[0]?.total || '0', 10);

      // Get reviewed count for this user
      const reviewedResult = await query(`
        SELECT COUNT(*) as reviewed
        FROM analyzed_shorts
        WHERE review_user_id = $1
          AND user_guess_percentile IS NOT NULL
      `, [req.userId]);
      const reviewed = parseInt(reviewedResult.rows[0]?.reviewed || '0', 10);

      res.json({
        last10: calculateStats(last10),
        last30: calculateStats(last30),
        allTime: calculateStats(allTime),
        total,
        reviewed,
      });
    } catch (error) {
      logger.error('Get stats error', { error });
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  },
};

