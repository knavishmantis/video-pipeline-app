import { Router } from 'express';
import { authController } from '../controllers/auth';
import { authenticateToken } from '../middleware/auth';

export const authRouter = Router();

// Registration is disabled - only admins can create users
// authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.get('/me', authenticateToken, authController.getMe);
authRouter.get('/profile-complete', authenticateToken, authController.checkProfileComplete);

