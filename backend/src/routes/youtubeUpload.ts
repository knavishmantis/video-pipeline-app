import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { youtubeUploadController } from '../controllers/youtubeUpload';

export const youtubeUploadRouter = Router();

// POST /api/youtube/shorts/:id/upload — admin only
youtubeUploadRouter.post(
  '/shorts/:id/upload',
  authenticateToken,
  requireRole('admin'),
  youtubeUploadController.uploadShortToYouTube
);
