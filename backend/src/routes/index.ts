import { Express, Request, Response } from 'express';
import { shortsRouter } from './shorts';
import { usersRouter } from './users';
import { assignmentsRouter } from './assignments';
import { filesRouter } from './files';
import { paymentsRouter } from './payments';
import { authRouter } from './auth';
import { scriptGradingRouter } from './scriptGrading';
import { scriptPipelineRouter } from './scriptPipeline';
import analyzedShortsRouter from './analyzedShorts';
import { getCacheStats, clearCache } from '../db';

export function setupRoutes(app: Express): void {
  app.use('/api/auth', authRouter);
  // Register script pipeline routes BEFORE shorts routes to avoid route conflict
  // (otherwise /api/shorts/script-pipeline matches /api/shorts/:id)
  app.use('/api/shorts/script-pipeline', scriptPipelineRouter);
  app.use('/api/shorts', shortsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/assignments', assignmentsRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/script-grading', scriptGradingRouter);
  app.use('/api/analyzed-shorts', analyzedShortsRouter);
  
  // Debug endpoint for cache stats (only in non-production or with debug flag)
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_ENDPOINTS === 'true') {
    app.get('/api/debug/cache/stats', (_req: Request, res: Response) => {
      const stats = getCacheStats();
      res.json(stats);
    });
    
    app.post('/api/debug/cache/clear', async (_req: Request, res: Response) => {
      await clearCache();
      res.json({ message: 'Cache cleared successfully' });
    });
  }
}

