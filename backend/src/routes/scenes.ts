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

// POST /api/shorts/:shortId/scenes/reorder (must be before /:id)
scenesRouter.post('/reorder', validate(reorderScenesSchema), scenesController.reorder);

// POST /api/shorts/:shortId/scenes
scenesRouter.post('/', validate(createSceneSchema), scenesController.create);

// PUT /api/shorts/:shortId/scenes/:id
scenesRouter.put('/:id', validate(updateSceneSchema), scenesController.update);

// DELETE /api/shorts/:shortId/scenes/:id
scenesRouter.delete('/:id', scenesController.delete);
