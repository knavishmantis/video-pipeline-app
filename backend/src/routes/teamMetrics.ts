import { Router } from 'express';
import { teamMetricsController } from '../controllers/teamMetrics';
import { authenticateToken } from '../middleware/auth';

export const teamMetricsRouter = Router();

teamMetricsRouter.get('/', authenticateToken, teamMetricsController.get);
