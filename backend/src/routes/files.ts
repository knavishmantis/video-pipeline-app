import { Router } from 'express';
import { filesController } from '../controllers/files';
import { authenticateToken } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';

export const filesRouter = Router();

filesRouter.use(authenticateToken);
filesRouter.use(requireProfileComplete);

filesRouter.get('/short/:shortId', filesController.getByShortId);
filesRouter.post('/upload', ...filesController.upload);
filesRouter.delete('/:id', filesController.delete);
filesRouter.get('/:id/download', filesController.download);

