import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getSignedUrl, getSignedUploadUrl, deleteFile } from '../services/gcpStorage';

export const worldsController = {
  // GET /api/worlds
  async getAll(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await query('SELECT * FROM worlds ORDER BY created_at DESC');
      res.json(result.rows);
    } catch (error) {
      logger.error('Get worlds error', { error });
      res.status(500).json({ error: 'Failed to fetch worlds' });
    }
  },

  // GET /api/worlds/:id
  async getById(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const result = await query('SELECT * FROM worlds WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'World not found' });
        return;
      }
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Get world error', { id, error });
      res.status(500).json({ error: 'Failed to fetch world' });
    }
  },

  // POST /api/worlds/upload-url
  async getUploadUrl(req: AuthRequest, res: Response): Promise<void> {
    const { file_name, file_size, content_type, file_type } = req.body;
    try {
      const prefix = file_type === 'screenshot' ? 'world-screenshots' : 'world-zips';
      const bucketPath = `${prefix}/${Date.now()}-${file_name}`;
      const uploadUrl = await getSignedUploadUrl(bucketPath, content_type);
      res.json({ upload_url: uploadUrl, bucket_path: bucketPath, expires_in: 3600 });
    } catch (error) {
      logger.error('Get world upload URL error', { error });
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },

  // POST /api/worlds
  async create(req: AuthRequest, res: Response): Promise<void> {
    const { name, description, bucket_path, screenshot_path, file_size } = req.body;
    try {
      const result = await query(
        'INSERT INTO worlds (name, description, bucket_path, screenshot_path, file_size) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, description || null, bucket_path, screenshot_path || null, file_size || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('Create world error', { error });
      res.status(500).json({ error: 'Failed to create world' });
    }
  },

  // PUT /api/worlds/:id
  async update(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { name, description, screenshot_path } = req.body;
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
      if (screenshot_path !== undefined) {
        updates.push(`screenshot_path = $${paramCount++}`);
        params.push(screenshot_path);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const result = await query(
        `UPDATE worlds SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'World not found' });
        return;
      }
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Update world error', { id, error });
      res.status(500).json({ error: 'Failed to update world' });
    }
  },

  // DELETE /api/worlds/:id
  async delete(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const worldResult = await query('SELECT bucket_path, screenshot_path FROM worlds WHERE id = $1', [id]);
      if (worldResult.rows.length === 0) {
        res.status(404).json({ error: 'World not found' });
        return;
      }

      await query('UPDATE scenes SET world_id = NULL WHERE world_id = $1', [id]);
      await query('DELETE FROM worlds WHERE id = $1', [id]);

      try {
        await deleteFile(worldResult.rows[0].bucket_path);
        if (worldResult.rows[0].screenshot_path) {
          await deleteFile(worldResult.rows[0].screenshot_path);
        }
      } catch (err) {
        logger.warn('Could not delete world files from GCS', { id, error: err });
      }

      res.json({ message: 'World deleted' });
    } catch (error) {
      logger.error('Delete world error', { id, error });
      res.status(500).json({ error: 'Failed to delete world' });
    }
  },

  // GET /api/worlds/:id/screenshot-url
  async getScreenshotUrl(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const result = await query('SELECT screenshot_path FROM worlds WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'World not found' });
        return;
      }
      if (!result.rows[0].screenshot_path) {
        res.status(404).json({ error: 'No screenshot available' });
        return;
      }
      const url = await getSignedUrl(result.rows[0].screenshot_path);
      res.json({ url });
    } catch (error) {
      logger.error('Get world screenshot URL error', { id, error });
      res.status(500).json({ error: 'Failed to get screenshot URL' });
    }
  },

  // GET /api/worlds/:id/download-url
  async getDownloadUrl(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const result = await query('SELECT bucket_path FROM worlds WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'World not found' });
        return;
      }
      const url = await getSignedUrl(result.rows[0].bucket_path);
      res.json({ url });
    } catch (error) {
      logger.error('Get world download URL error', { id, error });
      res.status(500).json({ error: 'Failed to get download URL' });
    }
  },
};
