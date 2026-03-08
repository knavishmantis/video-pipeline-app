import { Router } from 'express';
import { youtubeAnalyticsController } from '../controllers/youtubeAnalytics';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';

export const youtubeAnalyticsRouter = Router();

youtubeAnalyticsRouter.use(authenticateToken);
youtubeAnalyticsRouter.use(requireProfileComplete);

// All authenticated users can view analytics
youtubeAnalyticsRouter.get('/', youtubeAnalyticsController.getAll);
youtubeAnalyticsRouter.get('/pipeline', youtubeAnalyticsController.getPipeline);

// Admin only: sync data from GitHub Action
youtubeAnalyticsRouter.post('/sync', requireRole('admin'), youtubeAnalyticsController.sync);
