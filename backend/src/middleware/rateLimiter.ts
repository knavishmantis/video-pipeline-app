import rateLimit from 'express-rate-limit';

// General API rate limiter (excludes auth routes which have their own limiter)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs (increased for dashboard auto-refresh)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for auth routes (they have their own authLimiter)
    return req.path.startsWith('/api/auth');
  },
});

// Stricter limit for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs (increased from 5)
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  skipFailedRequests: false, // Count failed requests to prevent brute force
});

// File upload rate limiter (more lenient)
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes (reduced from 1 hour for better UX)
  max: 30, // limit each IP to 30 uploads per 15 minutes (increased from 20/hour)
  message: 'Too many file uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful uploads
});

