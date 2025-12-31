import express from 'express';
import cors from 'cors';
import path from 'path';
import { setupRoutes } from './routes';
import { initDatabase } from './db';
import { config } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

const app = express();
const PORT = config.port;

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (apply to all API routes)
app.use('/api', apiLimiter);

// Initialize database
initDatabase().catch((error) => {
  logger.error('Failed to initialize database', { error });
  process.exit(1);
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

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, { 
    environment: config.nodeEnv,
    port: PORT 
  });
});
