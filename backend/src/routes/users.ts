import { Router } from 'express';
import { usersController } from '../controllers/users';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';

export const usersRouter = Router();

usersRouter.use(authenticateToken);
// Profile completion not required for viewing/updating own profile
usersRouter.get('/:id/profile', usersController.getProfile);
usersRouter.put('/:id', usersController.update);

// Admin routes require profile completion
usersRouter.use(requireProfileComplete);

usersRouter.get('/', usersController.getAll);
usersRouter.get('/:id', usersController.getById);

// Admin only
usersRouter.post('/', requireRole('admin'), usersController.create);
usersRouter.delete('/:id', requireRole('admin'), usersController.delete);

