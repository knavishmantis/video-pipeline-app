import { Router } from 'express';
import { filesController } from '../controllers/files';
import { authenticateToken } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';
import { uploadLimiter } from '../middleware/rateLimiter';

export const filesRouter = Router();

filesRouter.use(authenticateToken);
filesRouter.use(requireProfileComplete);

filesRouter.get('/short/:shortId', filesController.getByShortId);
filesRouter.post('/upload', uploadLimiter, ...filesController.upload);
filesRouter.post('/upload-url', uploadLimiter, filesController.getUploadUrl);
filesRouter.post('/confirm-upload', uploadLimiter, filesController.confirmUpload);
filesRouter.delete('/:id', filesController.delete);
filesRouter.get('/:id/download', filesController.download);

