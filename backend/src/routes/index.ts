import { Express, Request, Response } from 'express';
import { shortsRouter } from './shorts';
import { scenesRouter } from './scenes';
import { usersRouter } from './users';
import { assignmentsRouter } from './assignments';
import { filesRouter } from './files';
import { paymentsRouter } from './payments';
import { authRouter } from './auth';
import analyzedShortsRouter from './analyzedShorts';
import { youtubeAnalyticsRouter } from './youtubeAnalytics';
import { teamMetricsRouter } from './teamMetrics';
import { formulaGuidesRouter } from './formulaGuides';
import { researchRouter } from './research';
import { presetClipsRouter } from './presetClips';
import { scriptEngineRouter } from './scriptEngine';
import { pipelineAnalyticsRouter } from './pipelineAnalytics';
import { getCacheStats, clearCache } from '../db';

export function setupRoutes(app: Express): void {
  app.use('/api/auth', authRouter);
  app.use('/api/shorts', shortsRouter);
  app.use('/api/shorts/:shortId/scenes', scenesRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/assignments', assignmentsRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/analyzed-shorts', analyzedShortsRouter);
  app.use('/api/youtube-analytics', youtubeAnalyticsRouter);
  app.use('/api/team-metrics', teamMetricsRouter);
  app.use('/api/formula-guides', formulaGuidesRouter);
  app.use('/api/research', researchRouter);
  app.use('/api/preset-clips', presetClipsRouter);
  app.use('/api/script-engine', scriptEngineRouter);
  app.use('/api/analytics/pipeline', pipelineAnalyticsRouter);

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

