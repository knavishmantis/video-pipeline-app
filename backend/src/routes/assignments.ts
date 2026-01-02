import { Router } from 'express';
import { assignmentsController } from '../controllers/assignments';
import { authenticateToken } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';
import { validate } from '../middleware/validate';
import { createAssignmentSchema, updateAssignmentSchema } from '../validators/assignments';

export const assignmentsRouter = Router();

assignmentsRouter.use(authenticateToken);
assignmentsRouter.use(requireProfileComplete);

assignmentsRouter.get('/', assignmentsController.getAll);
assignmentsRouter.get('/public', assignmentsController.getAllPublic);
assignmentsRouter.get('/my-assignments', assignmentsController.getMyAssignments);
assignmentsRouter.get('/:id', assignmentsController.getById);
assignmentsRouter.post('/', validate(createAssignmentSchema), assignmentsController.create);
assignmentsRouter.put('/:id', validate(updateAssignmentSchema), assignmentsController.update);
assignmentsRouter.delete('/:id', assignmentsController.delete);
assignmentsRouter.post('/:id/complete', assignmentsController.markComplete);

