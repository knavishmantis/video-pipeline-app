import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

/**
 * Middleware to log incoming HTTP requests with timing and metadata
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const { method, originalUrl, ip } = req;
  const userAgent = req.get('user-agent') || 'unknown';
  
  // Get user ID if available (from auth middleware)
  const authReq = req as AuthRequest;
  const userId = authReq.userId || null;
  
  // Log the incoming request
  logger.info('Incoming request', {
    method,
    url: originalUrl,
    ip,
    userAgent,
    userId,
  });
  
  // Override res.json to log the response
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Outgoing response', {
      method,
      url: originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId,
    });
    
    return originalJson(body);
  };
  
  // Handle cases where res.send is used instead of res.json
  const originalSend = res.send.bind(res);
  res.send = function (body: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Outgoing response', {
      method,
      url: originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId,
    });
    
    return originalSend(body);
  };
  
  // Handle response end (for cases without .json() or .send())
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Only log if we haven't already logged via .json() or .send()
    if (!res.headersSent || res.statusCode >= 400) {
      logger.info('Request completed', {
        method,
        url: originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId,
      });
    }
  });
  
  next();
};

