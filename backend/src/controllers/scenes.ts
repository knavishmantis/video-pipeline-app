import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getSignedUrl } from '../services/gcpStorage';

export const scenesController = {
  // GET /api/shorts/:shortId/scenes
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    const { shortId } = req.params;
    try {
      const scenesResult = await query(
        'SELECT * FROM scenes WHERE short_id = $1 ORDER BY scene_order ASC',
        [shortId]
      );
      let imagesByScene: Record<number, any[]> = {};
      try {
        const imagesResult = await query(
          'SELECT * FROM scene_images WHERE scene_id IN (SELECT id FROM scenes WHERE short_id = $1) ORDER BY created_at ASC',
          [shortId]
        );
        for (const img of imagesResult.rows) {
          if (!imagesByScene[img.scene_id]) imagesByScene[img.scene_id] = [];
          imagesByScene[img.scene_id].push(img);
        }
      } catch {
        // scene_images table may not exist yet (pre-migration); return scenes without images
      }

      // Load preset clips for scenes that reference them
      let presetClipsById: Record<number, any> = {};
      try {
        const presetIds = scenesResult.rows.map((s: any) => s.preset_clip_id).filter(Boolean);
        if (presetIds.length > 0) {
          const uniqueIds = [...new Set(presetIds)];
          const placeholders = uniqueIds.map((_, i) => `$${i + 1}`).join(',');
          const presetsResult = await query(
            `SELECT * FROM preset_clips WHERE id IN (${placeholders})`,
            uniqueIds
          );
          for (const p of presetsResult.rows) {
            presetClipsById[p.id] = p;
          }
        }
      } catch {
        // preset_clips table may not exist yet
      }

      // Load worlds for scenes that reference them
      let worldsById: Record<number, any> = {};
      try {
        const worldIds = scenesResult.rows.map((s: any) => s.world_id).filter(Boolean);
        if (worldIds.length > 0) {
          const uniqueIds = [...new Set(worldIds)];
          const placeholders = uniqueIds.map((_, i) => `$${i + 1}`).join(',');
          const worldsResult = await query(
            `SELECT * FROM worlds WHERE id IN (${placeholders})`,
            uniqueIds
          );
          for (const w of worldsResult.rows) {
            worldsById[w.id] = w;
          }
        }
      } catch {
        // worlds table may not exist yet
      }

      const scenes = scenesResult.rows.map((s: any) => ({
        ...s,
        images: imagesByScene[s.id] || [],
        preset_clip: s.preset_clip_id ? presetClipsById[s.preset_clip_id] || null : null,
        world: s.world_id ? worldsById[s.world_id] || null : null,
      }));
      res.json(scenes);
    } catch (error) {
      logger.error('Get scenes error', { shortId, error });
      res.status(500).json({ error: 'Failed to fetch scenes' });
    }
  },

  // GET /api/shorts/:shortId/scenes/:id
  async getById(req: AuthRequest, res: Response): Promise<void> {
    const { shortId, id } = req.params;
    try {
      const result = await query(
        'SELECT * FROM scenes WHERE id = $1 AND short_id = $2',
        [id, shortId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Scene not found' });
        return;
      }
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Get scene error', { shortId, sceneId: id, error });
      res.status(500).json({ error: 'Failed to fetch scene' });
    }
  },

  // POST /api/shorts/:shortId/scenes
  async create(req: AuthRequest, res: Response): Promise<void> {
    const { shortId } = req.params;
    const { script_line, direction, clipper_notes, editor_notes, scene_order, preset_clip_id, world_id } = req.body;
    try {
      // If no scene_order provided, append to end
      let order = scene_order;
      if (order === undefined || order === null) {
        const maxResult = await query(
          'SELECT COALESCE(MAX(scene_order), -1) as max_order FROM scenes WHERE short_id = $1',
          [shortId]
        );
        order = (maxResult.rows[0].max_order ?? -1) + 1;
      }

      const result = await query(
        'INSERT INTO scenes (short_id, scene_order, script_line, direction, clipper_notes, editor_notes, preset_clip_id, world_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [shortId, order, script_line || '', direction || '', clipper_notes || null, editor_notes || null, preset_clip_id || null, world_id || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('Create scene error', { shortId, error });
      res.status(500).json({ error: 'Failed to create scene' });
    }
  },

  // PUT /api/shorts/:shortId/scenes/:id
  async update(req: AuthRequest, res: Response): Promise<void> {
    const { shortId, id } = req.params;
    const input = req.body;
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (input.script_line !== undefined) {
        updates.push(`script_line = $${paramCount++}`);
        params.push(input.script_line);
      }
      if (input.direction !== undefined) {
        updates.push(`direction = $${paramCount++}`);
        params.push(input.direction);
      }
      if (input.clipper_notes !== undefined) {
        updates.push(`clipper_notes = $${paramCount++}`);
        params.push(input.clipper_notes);
      }
      if (input.editor_notes !== undefined) {
        updates.push(`editor_notes = $${paramCount++}`);
        params.push(input.editor_notes);
      }
      if (input.scene_order !== undefined) {
        updates.push(`scene_order = $${paramCount++}`);
        params.push(input.scene_order);
      }
      if (input.image_url !== undefined) {
        updates.push(`image_url = $${paramCount++}`);
        params.push(input.image_url);
      }
      if (input.preset_clip_id !== undefined) {
        updates.push(`preset_clip_id = $${paramCount++}`);
        params.push(input.preset_clip_id);
      }
      if (input.world_id !== undefined) {
        updates.push(`world_id = $${paramCount++}`);
        params.push(input.world_id);
      }
      if (input.needs_rework !== undefined) {
        updates.push(`needs_rework = $${paramCount++}`);
        params.push(input.needs_rework);
      }
      if (input.clipper_checked !== undefined) {
        updates.push(`clipper_checked = $${paramCount++}`);
        params.push(input.clipper_checked);
      }
      if (input.link_group !== undefined) {
        updates.push(`link_group = $${paramCount++}`);
        params.push(input.link_group);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id, shortId);

      const result = await query(
        `UPDATE scenes SET ${updates.join(', ')} WHERE id = $${paramCount} AND short_id = $${paramCount + 1} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Scene not found' });
        return;
      }
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Update scene error', { shortId, sceneId: id, error });
      res.status(500).json({ error: 'Failed to update scene' });
    }
  },

  // DELETE /api/shorts/:shortId/scenes/:id
  async delete(req: AuthRequest, res: Response): Promise<void> {
    const { shortId, id } = req.params;
    try {
      const result = await query(
        'DELETE FROM scenes WHERE id = $1 AND short_id = $2 RETURNING id',
        [id, shortId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Scene not found' });
        return;
      }
      res.json({ message: 'Scene deleted successfully' });
    } catch (error) {
      logger.error('Delete scene error', { shortId, sceneId: id, error });
      res.status(500).json({ error: 'Failed to delete scene' });
    }
  },

  // POST /api/shorts/:shortId/scenes/bulk - Replace all scenes
  async bulkCreate(req: AuthRequest, res: Response): Promise<void> {
    const { shortId } = req.params;
    const { scenes } = req.body;
    try {
      // Delete existing scenes
      await query('DELETE FROM scenes WHERE short_id = $1', [shortId]);

      // Insert all new scenes
      const results: any[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const order = scene.scene_order !== undefined ? scene.scene_order : i;
        const result = await query(
          'INSERT INTO scenes (short_id, scene_order, script_line, direction, clipper_notes, editor_notes, preset_clip_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
          [shortId, order, scene.script_line || '', scene.direction || '', scene.clipper_notes || null, scene.editor_notes || null, scene.preset_clip_id || null]
        );
        results.push(result.rows[0]);
      }

      res.status(201).json(results);
    } catch (error) {
      logger.error('Bulk create scenes error', { shortId, error });
      res.status(500).json({ error: 'Failed to bulk create scenes' });
    }
  },

  // POST /api/shorts/:shortId/scenes/:id/images
  async addImage(req: AuthRequest, res: Response): Promise<void> {
    const { shortId, id } = req.params;
    const { bucket_path, file_type = 'image' } = req.body;
    try {
      const sceneCheck = await query('SELECT id FROM scenes WHERE id = $1 AND short_id = $2', [id, shortId]);
      if (sceneCheck.rows.length === 0) {
        res.status(404).json({ error: 'Scene not found' });
        return;
      }
      const result = await query(
        'INSERT INTO scene_images (scene_id, bucket_path, file_type) VALUES ($1, $2, $3) RETURNING *',
        [id, bucket_path, file_type === 'video' ? 'video' : 'image']
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('Add scene image error', { shortId, sceneId: id, error });
      res.status(500).json({ error: 'Failed to add scene image' });
    }
  },

  // DELETE /api/shorts/:shortId/scenes/:id/images/:imageId
  async deleteImage(req: AuthRequest, res: Response): Promise<void> {
    const { shortId, id, imageId } = req.params;
    try {
      const result = await query(
        'DELETE FROM scene_images WHERE id = $1 AND scene_id = (SELECT id FROM scenes WHERE id = $2 AND short_id = $3) RETURNING id',
        [imageId, id, shortId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }
      res.json({ message: 'Image deleted' });
    } catch (error) {
      logger.error('Delete scene image error', { shortId, sceneId: id, imageId, error });
      res.status(500).json({ error: 'Failed to delete scene image' });
    }
  },

  // GET /api/shorts/:shortId/scenes/:id/images/:imageId/url
  async getSceneImageUrl(req: AuthRequest, res: Response): Promise<void> {
    const { shortId, id, imageId } = req.params;
    try {
      const result = await query(
        'SELECT si.bucket_path FROM scene_images si JOIN scenes s ON s.id = si.scene_id WHERE si.id = $1 AND s.id = $2 AND s.short_id = $3',
        [imageId, id, shortId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }
      const url = await getSignedUrl(result.rows[0].bucket_path);
      res.json({ url });
    } catch (error) {
      logger.error('Get scene image URL error', { shortId, sceneId: id, imageId, error });
      res.status(500).json({ error: 'Failed to get scene image URL' });
    }
  },

  // GET /api/shorts/:shortId/scenes/:id/image-url (legacy — kept for PDF export)
  async getImageUrl(req: AuthRequest, res: Response): Promise<void> {
    const { shortId, id } = req.params;
    try {
      const result = await query(
        'SELECT image_url FROM scenes WHERE id = $1 AND short_id = $2',
        [id, shortId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Scene not found' });
        return;
      }
      const scene = result.rows[0];
      if (!scene.image_url) {
        res.status(404).json({ error: 'No image for this scene' });
        return;
      }
      const url = await getSignedUrl(scene.image_url);
      res.json({ url });
    } catch (error) {
      logger.error('Get scene image URL error', { shortId, sceneId: id, error });
      res.status(500).json({ error: 'Failed to get scene image URL' });
    }
  },

  // POST /api/shorts/:shortId/scenes/reorder
  async reorder(req: AuthRequest, res: Response): Promise<void> {
    const { shortId } = req.params;
    const { scene_ids } = req.body;
    try {
      for (let i = 0; i < scene_ids.length; i++) {
        await query(
          'UPDATE scenes SET scene_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND short_id = $3',
          [i, scene_ids[i], shortId]
        );
      }

      const result = await query(
        'SELECT * FROM scenes WHERE short_id = $1 ORDER BY scene_order ASC',
        [shortId]
      );
      res.json(result.rows);
    } catch (error) {
      logger.error('Reorder scenes error', { shortId, error });
      res.status(500).json({ error: 'Failed to reorder scenes' });
    }
  },
};
