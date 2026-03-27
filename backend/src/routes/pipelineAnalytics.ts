import { Router } from 'express';
import { pipelineAnalyticsController } from '../controllers/pipelineAnalytics';
import { authenticateToken } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';

export const pipelineAnalyticsRouter = Router();

pipelineAnalyticsRouter.use(authenticateToken);
pipelineAnalyticsRouter.use(requireProfileComplete);
pipelineAnalyticsRouter.get('/', pipelineAnalyticsController.get);
