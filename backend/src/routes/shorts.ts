import { Router } from 'express';
import { shortsController } from '../controllers/shorts';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';
import { validate } from '../middleware/validate';
import { createShortSchema, updateShortSchema } from '../validators/shorts';

export const shortsRouter = Router();

shortsRouter.use(authenticateToken);
shortsRouter.use(requireProfileComplete);

shortsRouter.get('/', shortsController.getAll);
shortsRouter.get('/assigned', shortsController.getAssigned);
shortsRouter.get('/:id', shortsController.getById);
shortsRouter.post('/', validate(createShortSchema), shortsController.create);
shortsRouter.put('/:id', validate(updateShortSchema), shortsController.update);
shortsRouter.delete('/:id', shortsController.delete);
shortsRouter.post('/:id/mark-clips-complete', requireRole('admin'), shortsController.markClipsComplete);
shortsRouter.post('/:id/mark-editing-complete', requireRole('admin'), shortsController.markEditingComplete);

