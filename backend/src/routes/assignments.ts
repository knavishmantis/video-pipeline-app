import { Router } from 'express';
import { assignmentsController } from '../controllers/assignments';
import { authenticateToken } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';

export const assignmentsRouter = Router();

assignmentsRouter.use(authenticateToken);
assignmentsRouter.use(requireProfileComplete);

assignmentsRouter.get('/', assignmentsController.getAll);
assignmentsRouter.get('/my-assignments', assignmentsController.getMyAssignments);
assignmentsRouter.get('/:id', assignmentsController.getById);
assignmentsRouter.post('/', assignmentsController.create);
assignmentsRouter.put('/:id', assignmentsController.update);
assignmentsRouter.delete('/:id', assignmentsController.delete);
assignmentsRouter.post('/:id/complete', assignmentsController.markComplete);

