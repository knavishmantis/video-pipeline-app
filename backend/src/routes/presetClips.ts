import { Router } from 'express';
import { presetClipsController } from '../controllers/presetClips';
import { authenticateToken } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';

export const presetClipsRouter = Router();

presetClipsRouter.use(authenticateToken);
presetClipsRouter.use(requireProfileComplete);

// GET /api/preset-clips
presetClipsRouter.get('/', presetClipsController.getAll);

// POST /api/preset-clips/upload-url (must be before /:id)
presetClipsRouter.post('/upload-url', presetClipsController.getUploadUrl);

// GET /api/preset-clips/:id
presetClipsRouter.get('/:id', presetClipsController.getById);

// GET /api/preset-clips/:id/thumbnail-url
presetClipsRouter.get('/:id/thumbnail-url', presetClipsController.getThumbnailUrl);

// GET /api/preset-clips/:id/video-url
presetClipsRouter.get('/:id/video-url', presetClipsController.getVideoUrl);

// POST /api/preset-clips
presetClipsRouter.post('/', presetClipsController.create);

// PUT /api/preset-clips/:id
presetClipsRouter.put('/:id', presetClipsController.update);

// DELETE /api/preset-clips/:id
presetClipsRouter.delete('/:id', presetClipsController.delete);
