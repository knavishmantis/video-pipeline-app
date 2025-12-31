import { Router } from 'express';
import { paymentsController } from '../controllers/payments';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';

export const paymentsRouter = Router();

paymentsRouter.use(authenticateToken);
paymentsRouter.use(requireProfileComplete);

// User can view their own payments
paymentsRouter.get('/my-payments', paymentsController.getMyPayments);

// Admin-only routes
paymentsRouter.get('/', requireRole('admin'), paymentsController.getAll);
paymentsRouter.get('/pending', requireRole('admin'), paymentsController.getPending);
paymentsRouter.get('/:id', requireRole('admin'), paymentsController.getById);
paymentsRouter.post('/', requireRole('admin'), paymentsController.create);
paymentsRouter.put('/:id', requireRole('admin'), paymentsController.update);
paymentsRouter.post('/:id/mark-paid', requireRole('admin'), paymentsController.markPaid);

