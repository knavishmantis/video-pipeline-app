# Production Refactoring & Improvements Guide

This document outlines critical refactors and improvements needed before deploying to production.

## 🔴 Critical Security Issues

### 1. **JWT Secret Fallback to "secret"**
**Location**: `backend/src/middleware/auth.ts:22`, `backend/src/controllers/auth.ts:45,157`

**Issue**: Using fallback secret "secret" in production is a critical security vulnerability.

**Fix**:
```typescript
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'secret') {
  throw new Error('JWT_SECRET must be set to a secure value in production');
}
```

### 2. **Environment Variable Validation**
**Issue**: No validation of required environment variables at startup.

**Fix**: Create `backend/src/config/env.ts`:
```typescript
import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: requireEnv('FRONTEND_URL'),
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    bucketName: process.env.GCP_BUCKET_NAME,
    keyFile: process.env.GCP_KEY_FILE,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
  },
};

// Validate production requirements
if (config.nodeEnv === 'production') {
  if (config.jwtSecret === 'secret') {
    throw new Error('JWT_SECRET must be changed from default in production');
  }
  if (!config.gcp.projectId || !config.gcp.bucketName || !config.gcp.keyFile) {
    throw new Error('GCP configuration required in production');
  }
}
```

### 3. **Input Validation & Sanitization**
**Issue**: Limited input validation using Zod (installed but not used).

**Fix**: Create validation schemas for all inputs:
```typescript
// backend/src/validators/shorts.ts
import { z } from 'zod';

export const createShortSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  idea: z.string().max(5000).optional(),
});

// backend/src/middleware/validate.ts
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        next(error);
      }
    }
  };
}
```

### 4. **SQL Injection Prevention**
**Status**: ✅ Good - All queries use parameterized queries ($1, $2, etc.)

**Note**: Continue using parameterized queries. Never concatenate user input into SQL strings.

### 5. **Rate Limiting**
**Issue**: No rate limiting on API endpoints.

**Fix**: Add `express-rate-limit`:
```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', apiLimiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
});
app.use('/api/auth/', authLimiter);
```

## 🟡 Code Quality Issues

### 1. **Large Files**
**Issue**: 
- `frontend/src/pages/Dashboard.tsx` - ~2400 lines (should be <500)
- `backend/src/controllers/shorts.ts` - ~690 lines
- `backend/src/controllers/payments.ts` - ~505 lines

**Refactor Strategy**:
- **Dashboard.tsx**: Split into:
  - `Dashboard.tsx` (main component, ~200 lines)
  - `KanbanColumn.tsx` (column component)
  - `ShortCard.tsx` (card component)
  - `ShortModal.tsx` (modal component)
  - `hooks/useShorts.ts` (data fetching logic)
  - `hooks/useDragAndDrop.ts` (drag & drop logic)
  - `utils/shortHelpers.ts` (helper functions)

- **shorts.ts**: Extract:
  - `services/shortService.ts` (business logic)
  - `validators/shortValidators.ts` (validation)
  - Keep controller thin (just request/response handling)

### 2. **TypeScript `any` Usage**
**Issue**: 38 instances of `any` type in frontend.

**Fix**: Replace with proper types:
```typescript
// Instead of: catch (error: any)
catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  // ...
}
```

### 3. **Console.log in Production**
**Issue**: 108 console.log/error statements throughout backend.

**Fix**: Use proper logging library (`winston` or `pino`):
```typescript
// backend/src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### 4. **Error Handling Consistency**
**Issue**: Inconsistent error handling across controllers.

**Fix**: Create error handling middleware:
```typescript
// backend/src/middleware/errorHandler.ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error(err);
  
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message });
  }
  
  if (err instanceof UnauthorizedError) {
    return res.status(401).json({ error: err.message });
  }
  
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
}
```

### 5. **Missing Error Boundaries**
**Issue**: No React error boundaries in frontend.

**Fix**: Add error boundary component:
```typescript
// frontend/src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## 🟢 Performance Improvements

### 1. **Database Query Optimization**
**Issue**: N+1 queries in some endpoints (fetching user roles separately).

**Fix**: Use JOINs or batch queries:
```typescript
// Instead of fetching roles separately, use JOIN:
const result = await db.query(`
  SELECT u.*, 
    COALESCE(ARRAY_AGG(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') as roles
  FROM users u
  LEFT JOIN user_roles ur ON u.id = ur.user_id
  WHERE u.id = $1
  GROUP BY u.id
`, [userId]);
```

### 2. **Frontend Bundle Size**
**Issue**: Large bundle size with unused dependencies.

**Fix**:
- Remove unused dependencies (`@react-three/fiber`, `ogl`, `three` if not used)
- Code splitting for routes:
```typescript
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PaymentTracking = lazy(() => import('./pages/PaymentTracking'));
```

### 3. **API Response Caching**
**Issue**: No caching for frequently accessed data.

**Fix**: Add Redis or in-memory cache for:
- User roles
- Short lists (with TTL)
- File signed URLs (already time-limited, but cache generation)

### 4. **File Upload Optimization**
**Issue**: 10GB files loaded into memory.

**Fix**: Use streaming uploads for large files:
```typescript
import { Storage } from '@google-cloud/storage';

const stream = storage.bucket(bucketName).file(fileName).createWriteStream();
req.pipe(stream);
```

## 🔵 Missing Features for Production

### 1. **Request Logging & Monitoring**
**Fix**: Add request logging middleware:
```typescript
import morgan from 'morgan';

app.use(morgan('combined')); // or 'json' for structured logs
```

### 2. **Health Check Endpoint**
**Status**: ✅ Exists at `/health`

**Enhancement**: Add database health check:
```typescript
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected' 
    });
  }
});
```

### 3. **API Documentation**
**Issue**: No API documentation.

**Fix**: Add Swagger/OpenAPI:
```typescript
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json';

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
```

### 4. **Database Migrations Management**
**Issue**: Multiple separate migration scripts.

**Fix**: Use a migration tool like `node-pg-migrate` or `knex`:
```typescript
// Single migration runner that handles all migrations in order
```

### 5. **Backup Strategy**
**Issue**: No documented backup strategy.

**Fix**: 
- Set up automated Cloud SQL backups
- Document restore procedure
- Test backups regularly

## 🟣 Testing

### 1. **Unit Tests**
**Issue**: No tests.

**Fix**: Add Jest/Vitest:
```typescript
// Example test
describe('authController', () => {
  it('should reject invalid credentials', async () => {
    // Test implementation
  });
});
```

### 2. **Integration Tests**
**Fix**: Test API endpoints with test database.

### 3. **E2E Tests**
**Fix**: Use Playwright or Cypress for critical user flows.

## 📋 Pre-Deployment Checklist

- [ ] Replace all `console.log` with proper logger
- [ ] Remove all `any` types
- [ ] Add input validation to all endpoints
- [ ] Set up environment variable validation
- [ ] Change JWT_SECRET from default
- [ ] Add rate limiting
- [ ] Split large files
- [ ] Add error boundaries
- [ ] Set up logging
- [ ] Add health checks
- [ ] Configure production database backups
- [ ] Set up monitoring/alerting (e.g., Sentry)
- [ ] Review and test all API endpoints
- [ ] Load test critical endpoints
- [ ] Document deployment process
- [ ] Set up CI/CD pipeline
- [ ] Configure production environment variables
- [ ] Test file uploads with large files
- [ ] Verify CORS settings
- [ ] Test authentication flow
- [ ] Verify all permissions/authorization

## 🚀 Deployment Recommendations

1. **Use Environment-Specific Configs**: Separate dev/staging/prod configs
2. **Secrets Management**: Use GCP Secret Manager or similar
3. **CDN**: Use Cloud CDN for static assets
4. **Load Balancer**: For high availability
5. **Auto-scaling**: Configure based on traffic
6. **Monitoring**: Set up Cloud Monitoring/Logging
7. **Alerting**: Configure alerts for errors, high latency, etc.

## 📝 Additional Notes

- Consider adding request ID tracking for debugging
- Implement audit logging for sensitive operations (payments, user changes)
- Add database connection pooling configuration
- Consider adding GraphQL for more efficient data fetching
- Implement WebSocket for real-time updates (optional)

