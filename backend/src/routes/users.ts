import { Router } from 'express';
import { usersController } from '../controllers/users';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';
import { validate } from '../middleware/validate';
import { createUserSchema, updateUserSchema } from '../validators/users';

export const usersRouter = Router();

usersRouter.use(authenticateToken);
// Profile completion not required for viewing/updating own profile
usersRouter.get('/:id/profile', usersController.getProfile);
usersRouter.put('/:id', validate(updateUserSchema), usersController.update);

// Admin routes require profile completion
usersRouter.use(requireProfileComplete);

usersRouter.get('/', usersController.getAll);
usersRouter.get('/:id', usersController.getById);
usersRouter.get('/:id/rates', usersController.getUserRates);

// Admin only
usersRouter.post('/', requireRole('admin'), validate(createUserSchema), usersController.create);
usersRouter.put('/:id/rate', requireRole('admin'), usersController.setUserRate);
usersRouter.delete('/:id', requireRole('admin'), usersController.delete);

