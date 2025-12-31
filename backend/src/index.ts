import express from 'express';
import cors from 'cors';
import path from 'path';
import { setupRoutes } from './routes';
import { initDatabase } from './db';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

// Load config with error handling
let config: any;
let PORT: number;
try {
  const configModule = require('./config/env');
  config = configModule.config;
  PORT = config.port;
} catch (error: any) {
  console.error('Failed to load configuration:', error.message);
  console.error('Required environment variables: DATABASE_URL, JWT_SECRET, FRONTEND_URL');
  process.exit(1);
}

const app = express();

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (apply to all API routes)
app.use('/api', apiLimiter);

// Initialize database (non-blocking - server will start even if DB init fails)
initDatabase().catch((error) => {
  logger.error('Failed to initialize database', { error });
  // Don't exit - let the server start and health check will show DB status
});

// API Routes
setupRoutes(app);

// Health check with database status
app.get('/health', async (req, res) => {
  try {
    const db = await import('./db').then(m => m.getPool());
    await db.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected',
      timestamp: new Date().toISOString() 
    });
  }
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Serve static files from React app in production
if (config.nodeEnv === 'production') {
  const frontendPath = path.join(__dirname, '../frontend-dist');
  app.use(express.static(frontendPath));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Start server with error handling
try {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`, { 
      environment: config.nodeEnv,
      port: PORT 
    });
    console.log(`Server started successfully on port ${PORT}`);
  }).on('error', (error: Error) => {
    console.error('Failed to start server:', error);
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
} catch (error: any) {
  console.error('Failed to start server:', error);
  logger.error('Failed to start server', { error });
  process.exit(1);
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught exception:', error);
  logger.error('Uncaught exception', { error });
  // Don't exit immediately - let Cloud Run handle it
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled rejection:', reason);
  logger.error('Unhandled rejection', { reason });
});
