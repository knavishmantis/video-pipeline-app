# Deployment Guide

## Architecture Options

### Option 1: Separate Services (Current Setup)

**Development**: Frontend and Backend run separately
- Frontend: Vite dev server on port 3000
- Backend: Express server on port 3001
- Frontend proxies API requests to backend

**Production**: Can deploy separately or together
- Frontend: Build static files, serve via CDN/nginx
- Backend: Deploy to cloud service (Cloud Run, App Engine, etc.)

### Option 2: Combined Deployment (Single App)

For production, you can serve the frontend from the backend:

1. Build frontend: `cd frontend && npm run build`
2. Serve static files from Express
3. Deploy single service

## Local Development (Current)

The app runs as **two separate services**:

```bash
# Terminal 1: Backend
cd backend && npm run dev  # Runs on :3001

# Terminal 2: Frontend  
cd frontend && npm run dev  # Runs on :3000, proxies to :3001
```

This is the recommended setup for development.

## Production Deployment Options

### Option A: Separate Services (Recommended for Scale)

**Frontend Deployment:**
- Build: `cd frontend && npm run build`
- Deploy `dist/` folder to:
  - Vercel
  - Netlify
  - Cloudflare Pages
  - AWS S3 + CloudFront
  - GCP Cloud Storage + CDN

**Backend Deployment:**
- Deploy to:
  - GCP Cloud Run (containerized)
  - GCP App Engine
  - AWS Lambda/ECS
  - Heroku
  - Railway
  - Render

**Environment Variables:**
- Frontend: `VITE_API_URL=https://api.yourdomain.com/api`
- Backend: Set all `.env` variables in hosting platform

### Option B: Combined Deployment

Serve frontend from backend for simpler deployment:

**1. Update Backend to Serve Frontend**

Add to `backend/src/index.ts`:
```typescript
import path from 'path';

// Serve static files from React app
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}
```

**2. Build Process**
```bash
# Build frontend
cd frontend && npm run build

# Copy dist to backend
cp -r frontend/dist backend/frontend-dist

# Build backend
cd backend && npm run build
```

**3. Deploy Single Service**
- Deploy `backend/` folder
- Ensure `frontend-dist/` is included
- Set environment variables

## GCP Deployment Example

### Using Cloud Run (Containerized)

**1. Create Dockerfile**

`backend/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY dist ./dist
COPY frontend-dist ./frontend-dist  # If serving frontend

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "dist/index.js"]
```

**2. Build and Deploy**
```bash
# Build backend
cd backend && npm run build

# Build frontend (if combining)
cd ../frontend && npm run build
cp -r dist ../backend/frontend-dist

# Build Docker image
cd ../backend
gcloud builds submit --tag gcr.io/PROJECT_ID/video-pipeline

# Deploy to Cloud Run
gcloud run deploy video-pipeline \
  --image gcr.io/PROJECT_ID/video-pipeline \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=...,GCP_PROJECT_ID=...,etc
```

### Using App Engine

**1. Create `backend/app.yaml`**:
```yaml
runtime: nodejs18

env_variables:
  NODE_ENV: production
  PORT: 8080
  DATABASE_URL: your-database-url
  GCP_PROJECT_ID: your-project-id
  GCP_BUCKET_NAME: your-bucket-name
  JWT_SECRET: your-jwt-secret
  FRONTEND_URL: https://yourdomain.com
```

**2. Deploy**:
```bash
cd backend
gcloud app deploy
```

## Environment-Specific Configuration

### Development
- Use local PostgreSQL or SQLite
- Use dev GCP bucket (from terraform)
- Frontend and backend on separate ports

### Production
- Use production PostgreSQL (Cloud SQL, etc.)
- Use prod GCP bucket (from terraform)
- Frontend and backend can be combined or separate
- Use production JWT secret
- Enable HTTPS

## Database Setup

### Development
- Local PostgreSQL or SQLite

### Production
- **GCP Cloud SQL** (PostgreSQL)
- **AWS RDS** (PostgreSQL)
- **Managed PostgreSQL** service

**Connection String Format:**
```
postgresql://user:password@host:5432/database?sslmode=require
```

## GCP Resources

### Dev Environment
- Bucket: `your-project-id-video-pipeline-dev`
- Service Account: `video-pipeline-dev@...`
- Key: `gcp-key-dev.json`

### Prod Environment
- Bucket: `your-project-id-video-pipeline-prod`
- Service Account: `video-pipeline-prod@...`
- Key: `gcp-key-prod.json` (keep secure!)

**Provision with Terraform:**
```bash
cd terraform

# Dev
terraform workspace select dev
terraform apply -var="project_id=..." -var="environment=dev"

# Prod
terraform workspace select prod
terraform apply -var="project_id=..." -var="environment=prod"
```

## Security Checklist

- [ ] Use strong JWT secret in production
- [ ] Enable HTTPS everywhere
- [ ] Use environment variables (never commit secrets)
- [ ] Set up database backups
- [ ] Configure CORS properly
- [ ] Use production GCP service account (not dev)
- [ ] Set up monitoring/logging
- [ ] Configure rate limiting
- [ ] Set up error tracking (Sentry, etc.)

## Monitoring

Consider adding:
- **Application Monitoring**: New Relic, Datadog, or GCP Monitoring
- **Error Tracking**: Sentry
- **Logging**: Cloud Logging, or structured logging service
- **Uptime Monitoring**: UptimeRobot, Pingdom

## Scaling Considerations

- **Database**: Use connection pooling, read replicas
- **File Storage**: GCP Storage scales automatically
- **API**: Stateless design allows horizontal scaling
- **Caching**: Add Redis for frequently accessed data
- **CDN**: Use Cloud CDN for static assets

