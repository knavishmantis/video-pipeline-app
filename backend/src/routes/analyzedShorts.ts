import { Router } from 'express';
import { analyzedShortsController } from '../controllers/analyzedShorts';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/random-unrated', analyzedShortsController.getRandomUnrated);
router.get('/stats', analyzedShortsController.getStats);
router.get('/:id', analyzedShortsController.getById);
router.post('/:id/review', analyzedShortsController.submitReview);

export default router;

