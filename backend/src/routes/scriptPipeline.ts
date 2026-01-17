import { Router } from 'express';
import { scriptPipelineController } from '../controllers/scriptPipeline';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';

export const scriptPipelineRouter = Router();

// All routes require authentication
scriptPipelineRouter.use(authenticateToken);
scriptPipelineRouter.use(requireProfileComplete);

// View routes (all authenticated users)
scriptPipelineRouter.get('/', scriptPipelineController.getAll);
scriptPipelineRouter.get('/:id/draft', scriptPipelineController.getDraft);

// Edit routes (admin or script_writer only)
scriptPipelineRouter.post('/', requireRole('admin', 'script_writer'), scriptPipelineController.create);
scriptPipelineRouter.patch('/:id/draft', requireRole('admin', 'script_writer'), scriptPipelineController.updateDraft);
scriptPipelineRouter.post('/:id/advance-stage', requireRole('admin', 'script_writer'), scriptPipelineController.advanceStage);

