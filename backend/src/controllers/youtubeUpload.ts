import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { uploadVideoToYouTube } from '../services/youtubeUpload';
import { logger } from '../utils/logger';

export const youtubeUploadController = {
  uploadShortToYouTube: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const shortId = parseInt(req.params.id);
      if (isNaN(shortId)) {
        res.status(400).json({ error: 'Invalid short ID' });
        return;
      }

      // Fetch the short
      const shortResult = await query(
        'SELECT id, title, description, status, youtube_video_id FROM shorts WHERE id = $1',
        [shortId]
      );

      if (shortResult.rows.length === 0) {
        res.status(404).json({ error: 'Short not found' });
        return;
      }

      const short = shortResult.rows[0];

      if (short.status !== 'completed') {
        res.status(400).json({ error: `Cannot upload: short status is '${short.status}', must be 'completed'` });
        return;
      }

      if (short.youtube_video_id) {
        res.status(400).json({
          error: 'Short has already been uploaded to YouTube',
          youtube_video_id: short.youtube_video_id,
          youtube_url: `https://youtube.com/shorts/${short.youtube_video_id}`,
        });
        return;
      }

      // Get the final_video file for this short
      const fileResult = await query(
        `SELECT gcp_bucket_path, file_name FROM files
         WHERE short_id = $1 AND file_type = 'final_video'
         ORDER BY uploaded_at DESC LIMIT 1`,
        [shortId]
      );

      if (fileResult.rows.length === 0) {
        res.status(400).json({ error: 'No final video file found for this short. Please upload the final video first.' });
        return;
      }

      const finalVideoFile = fileResult.rows[0];
      const description = short.description || '';

      logger.info('Uploading short to YouTube', { shortId, title: short.title, gcpBucketPath: finalVideoFile.gcp_bucket_path });

      // Upload to YouTube
      const videoId = await uploadVideoToYouTube(
        finalVideoFile.gcp_bucket_path,
        short.title,
        description
      );

      // Update the short in the database
      await query(
        `UPDATE shorts SET youtube_video_id = $1, status = 'uploaded', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [videoId, shortId]
      );

      logger.info('Short successfully uploaded to YouTube', { shortId, videoId });

      res.json({
        youtube_video_id: videoId,
        youtube_url: `https://youtube.com/shorts/${videoId}`,
      });
    } catch (error: any) {
      logger.error('YouTube upload failed', { error: error.message, shortId: req.params.id });
      res.status(500).json({ error: error.message || 'YouTube upload failed' });
    }
  },
};
