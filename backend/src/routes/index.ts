import { Express } from 'express';
import { shortsRouter } from './shorts';
import { usersRouter } from './users';
import { assignmentsRouter } from './assignments';
import { filesRouter } from './files';
import { paymentsRouter } from './payments';
import { authRouter } from './auth';
import { scriptGradingRouter } from './scriptGrading';

export function setupRoutes(app: Express): void {
  app.use('/api/auth', authRouter);
  app.use('/api/shorts', shortsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/assignments', assignmentsRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/script-grading', scriptGradingRouter);
}

