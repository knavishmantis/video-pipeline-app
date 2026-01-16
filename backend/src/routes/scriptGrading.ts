import { Router } from 'express';
import multer from 'multer';
import { scriptGradingController } from '../controllers/scriptGrading';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';

export const scriptGradingRouter = Router();

scriptGradingRouter.use(authenticateToken);
scriptGradingRouter.use(requireProfileComplete);
scriptGradingRouter.use(requireRole('admin')); // Only admins can access script grading

// Configure multer for PDF uploads (memory storage, max 50MB for PDFs)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max for PDFs
  },
  fileFilter: (req, file, cb) => {
    // Only accept PDF files
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

scriptGradingRouter.post('/grade', upload.single('pdfFile'), scriptGradingController.gradeScript);

