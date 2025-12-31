import { Router } from 'express';
import { shortsController } from '../controllers/shorts';
import { authenticateToken } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';

export const shortsRouter = Router();

shortsRouter.use(authenticateToken);
shortsRouter.use(requireProfileComplete);

shortsRouter.get('/', shortsController.getAll);
shortsRouter.get('/assigned', shortsController.getAssigned);
shortsRouter.get('/:id', shortsController.getById);
shortsRouter.post('/', shortsController.create);
shortsRouter.put('/:id', shortsController.update);
shortsRouter.delete('/:id', shortsController.delete);

