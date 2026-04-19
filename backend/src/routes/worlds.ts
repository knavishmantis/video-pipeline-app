import { Router } from 'express';
import { worldsController } from '../controllers/worlds';
import { authenticateToken } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';

export const worldsRouter = Router();

worldsRouter.use(authenticateToken);
worldsRouter.use(requireProfileComplete);

// POST /api/worlds/upload-url (must be before /:id)
worldsRouter.post('/upload-url', worldsController.getUploadUrl);

// GET /api/worlds
worldsRouter.get('/', worldsController.getAll);

// GET /api/worlds/:id
worldsRouter.get('/:id', worldsController.getById);

// GET /api/worlds/:id/screenshot-url
worldsRouter.get('/:id/screenshot-url', worldsController.getScreenshotUrl);

// GET /api/worlds/:id/download-url
worldsRouter.get('/:id/download-url', worldsController.getDownloadUrl);

// POST /api/worlds
worldsRouter.post('/', worldsController.create);

// PUT /api/worlds/:id
worldsRouter.put('/:id', worldsController.update);

// DELETE /api/worlds/:id
worldsRouter.delete('/:id', worldsController.delete);
