import { Router, Request, Response } from 'express';
import { scenesController } from '../controllers/scenes';
import { authenticateToken } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';
import { validate } from '../middleware/validate';
import { createSceneSchema, updateSceneSchema, bulkCreateScenesSchema, reorderScenesSchema } from '../validators/scenes';
import { suggestLinkGroups } from '../services/vertexAI';
import { query } from '../db';

export const scenesRouter = Router({ mergeParams: true });

scenesRouter.use(authenticateToken);
scenesRouter.use(requireProfileComplete);

// GET /api/shorts/:shortId/scenes
scenesRouter.get('/', scenesController.getAll);

// GET /api/shorts/:shortId/scenes/:id/image-url (legacy, must be before /:id)
scenesRouter.get('/:id/image-url', scenesController.getImageUrl);

// POST /api/shorts/:shortId/scenes/:id/images
scenesRouter.post('/:id/images', scenesController.addImage);

// GET /api/shorts/:shortId/scenes/:id/images/:imageId/url
scenesRouter.get('/:id/images/:imageId/url', scenesController.getSceneImageUrl);

// DELETE /api/shorts/:shortId/scenes/:id/images/:imageId
scenesRouter.delete('/:id/images/:imageId', scenesController.deleteImage);

// GET /api/shorts/:shortId/scenes/:id
scenesRouter.get('/:id', scenesController.getById);

// POST /api/shorts/:shortId/scenes/bulk - Replace all scenes at once (must be before /:id)
scenesRouter.post('/bulk', validate(bulkCreateScenesSchema), scenesController.bulkCreate);

// POST /api/shorts/:shortId/scenes/auto-link-groups
// Uses Gemini to suggest link groups and applies them
scenesRouter.post('/auto-link-groups', async (req: Request, res: Response) => {
  const { shortId } = req.params;
  try {
    const scenesResult = await query(
      'SELECT id, scene_order, script_line, direction, clipper_notes FROM scenes WHERE short_id = $1 ORDER BY scene_order ASC',
      [shortId]
    );
    if (scenesResult.rows.length === 0) {
      res.json({ applied: [] });
      return;
    }

    const suggestions = await suggestLinkGroups(scenesResult.rows);

    // Apply all suggestions in parallel
    await Promise.all(suggestions.map(s =>
      query('UPDATE scenes SET link_group = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND short_id = $3', [s.link_group, s.scene_id, shortId])
    ));

    res.json({ applied: suggestions });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shorts/:shortId/scenes/reorder (must be before /:id)
scenesRouter.post('/reorder', validate(reorderScenesSchema), scenesController.reorder);

// POST /api/shorts/:shortId/scenes
scenesRouter.post('/', validate(createSceneSchema), scenesController.create);

// PUT /api/shorts/:shortId/scenes/:id
scenesRouter.put('/:id', validate(updateSceneSchema), scenesController.update);

// DELETE /api/shorts/:shortId/scenes/:id
scenesRouter.delete('/:id', scenesController.delete);
