import { Router, Request, Response, NextFunction } from 'express';
import { youtubeAnalyticsController } from '../controllers/youtubeAnalytics';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';
import { config } from '../config/env';

export const youtubeAnalyticsRouter = Router();

// Middleware for the sync endpoint: accept either a static SYNC_API_KEY or a valid admin JWT
function authenticateSync(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (config.syncApiKey && token === config.syncApiKey) {
    // Static key accepted — bypass JWT/role checks
    next();
    return;
  }

  // Fall back to normal JWT + admin role check
  authenticateToken(req, res, () => {
    requireRole('admin')(req, res, next);
  });
}

// Sync endpoint: accepts static SYNC_API_KEY (GH Action) or admin JWT — must be before authenticateToken middleware
youtubeAnalyticsRouter.post('/sync', authenticateSync, youtubeAnalyticsController.sync);

youtubeAnalyticsRouter.use(authenticateToken);
youtubeAnalyticsRouter.use(requireProfileComplete);

// All authenticated users can view analytics
youtubeAnalyticsRouter.get('/', youtubeAnalyticsController.getAll);
youtubeAnalyticsRouter.get('/pipeline', youtubeAnalyticsController.getPipeline);
