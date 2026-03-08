import { Router } from 'express';
import { scenesController } from '../controllers/scenes';
import { authenticateToken } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';
import { validate } from '../middleware/validate';
import { createSceneSchema, updateSceneSchema, bulkCreateScenesSchema, reorderScenesSchema } from '../validators/scenes';

export const scenesRouter = Router({ mergeParams: true });

scenesRouter.use(authenticateToken);
scenesRouter.use(requireProfileComplete);

// GET /api/shorts/:shortId/scenes
scenesRouter.get('/', scenesController.getAll);

// GET /api/shorts/:shortId/scenes/:id/image-url (must be before /:id to avoid route conflict)
scenesRouter.get('/:id/image-url', scenesController.getImageUrl);

// GET /api/shorts/:shortId/scenes/:id
scenesRouter.get('/:id', scenesController.getById);

// POST /api/shorts/:shortId/scenes
scenesRouter.post('/', validate(createSceneSchema), scenesController.create);

// PUT /api/shorts/:shortId/scenes/:id
scenesRouter.put('/:id', validate(updateSceneSchema), scenesController.update);

// DELETE /api/shorts/:shortId/scenes/:id
scenesRouter.delete('/:id', scenesController.delete);

// POST /api/shorts/:shortId/scenes/bulk - Replace all scenes at once
scenesRouter.post('/bulk', validate(bulkCreateScenesSchema), scenesController.bulkCreate);

// POST /api/shorts/:shortId/scenes/reorder
scenesRouter.post('/reorder', validate(reorderScenesSchema), scenesController.reorder);
