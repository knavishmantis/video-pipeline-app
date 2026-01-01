import express from 'express';
import cors from 'cors';
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
  origin: (origin, callback) => {
    // Allow requests with or without trailing slash
    const allowedOrigins = [
      config.frontendUrl,
      config.frontendUrl.replace(/\/$/, ''), // without trailing slash
      config.frontendUrl + '/', // with trailing slash
    ];
    
    // Remove duplicates
    const uniqueOrigins = [...new Set(allowedOrigins)];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (uniqueOrigins.some(allowed => origin === allowed || origin === allowed + '/' || origin === allowed.replace(/\/$/, ''))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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

// Root route - API info
app.get('/', (req, res) => {
  res.json({ 
    message: 'Video Pipeline API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api'
    }
  });
});

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

// Note: Frontend is deployed separately to Cloud Run, so we don't serve static files here

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
