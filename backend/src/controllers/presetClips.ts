import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getSignedUrl, getSignedUploadUrl, generateBucketPath, deleteFile } from '../services/gcpStorage';

export const presetClipsController = {
  // GET /api/preset-clips
  async getAll(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await query("SELECT * FROM preset_clips ORDER BY CAST(NULLIF(label, '') AS INTEGER) ASC NULLS LAST, created_at DESC");
      res.json(result.rows);
    } catch (error) {
      logger.error('Get preset clips error', { error });
      res.status(500).json({ error: 'Failed to fetch preset clips' });
    }
  },

  // GET /api/preset-clips/:id
  async getById(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const result = await query('SELECT * FROM preset_clips WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Preset clip not found' });
        return;
      }
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Get preset clip error', { id, error });
      res.status(500).json({ error: 'Failed to fetch preset clip' });
    }
  },

  // POST /api/preset-clips/upload-url
  async getUploadUrl(req: AuthRequest, res: Response): Promise<void> {
    const { file_name, file_size, content_type } = req.body;
    try {
      const bucketPath = `preset-clips/${Date.now()}-${file_name}`;
      const uploadUrl = await getSignedUploadUrl(bucketPath, content_type);
      res.json({ upload_url: uploadUrl, bucket_path: bucketPath, expires_in: 3600 });
    } catch (error) {
      logger.error('Get preset clip upload URL error', { error });
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },

  // POST /api/preset-clips
  async create(req: AuthRequest, res: Response): Promise<void> {
    const { name, description, bucket_path, thumbnail_path, mime_type, file_size } = req.body;
    try {
      // Auto-assign next label number
      const maxResult = await query("SELECT COALESCE(MAX(CAST(label AS INTEGER)), 0) AS max_label FROM preset_clips WHERE label ~ '^[0-9]+$'");
      const nextLabel = String((maxResult.rows[0].max_label || 0) + 1);

      const result = await query(
        'INSERT INTO preset_clips (label, name, description, bucket_path, thumbnail_path, mime_type, file_size) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [nextLabel, name, description || null, bucket_path, thumbnail_path || null, mime_type || null, file_size || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('Create preset clip error', { error });
      res.status(500).json({ error: 'Failed to create preset clip' });
    }
  },

  // PUT /api/preset-clips/:id
  async update(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { name, description, thumbnail_path } = req.body;
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        params.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(description);
      }
      if (thumbnail_path !== undefined) {
        updates.push(`thumbnail_path = $${paramCount++}`);
        params.push(thumbnail_path);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const result = await query(
        `UPDATE preset_clips SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Preset clip not found' });
        return;
      }
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Update preset clip error', { id, error });
      res.status(500).json({ error: 'Failed to update preset clip' });
    }
  },

  // DELETE /api/preset-clips/:id
  async delete(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      // Get bucket path before deleting
      const clipResult = await query('SELECT bucket_path FROM preset_clips WHERE id = $1', [id]);
      if (clipResult.rows.length === 0) {
        res.status(404).json({ error: 'Preset clip not found' });
        return;
      }

      // Clear references in scenes
      await query('UPDATE scenes SET preset_clip_id = NULL WHERE preset_clip_id = $1', [id]);

      // Delete from DB
      await query('DELETE FROM preset_clips WHERE id = $1', [id]);

      // Try to delete from GCS (non-blocking)
      try {
        await deleteFile(clipResult.rows[0].bucket_path);
      } catch (err) {
        logger.warn('Could not delete preset clip file from GCS', { id, error: err });
      }

      res.json({ message: 'Preset clip deleted' });
    } catch (error) {
      logger.error('Delete preset clip error', { id, error });
      res.status(500).json({ error: 'Failed to delete preset clip' });
    }
  },

  // GET /api/preset-clips/:id/thumbnail-url
  async getThumbnailUrl(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const result = await query('SELECT thumbnail_path FROM preset_clips WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Preset clip not found' });
        return;
      }
      if (!result.rows[0].thumbnail_path) {
        res.status(404).json({ error: 'No thumbnail available' });
        return;
      }
      const url = await getSignedUrl(result.rows[0].thumbnail_path);
      res.json({ url });
    } catch (error) {
      logger.error('Get preset clip thumbnail URL error', { id, error });
      res.status(500).json({ error: 'Failed to get thumbnail URL' });
    }
  },

  // GET /api/preset-clips/:id/video-url
  async getVideoUrl(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const result = await query('SELECT bucket_path FROM preset_clips WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Preset clip not found' });
        return;
      }
      const url = await getSignedUrl(result.rows[0].bucket_path);
      res.json({ url });
    } catch (error) {
      logger.error('Get preset clip video URL error', { id, error });
      res.status(500).json({ error: 'Failed to get video URL' });
    }
  },
};
