# GitHub Actions Deployment Guide

This guide explains how to set up automated deployment to GCP Cloud Run (cost-effective serverless option) using GitHub Actions.

## Architecture Overview

**Recommended Setup (Lowest Cost)**:
- **Frontend**: Cloud Run (serverless, pay per request)
- **Backend**: Cloud Run (serverless, pay per request)
- **Database**: Cloud SQL (shared instance, db-f1-micro - FREE tier)
- **Storage**: Cloud Storage (pay per GB stored + operations)

**Alternative (Even Cheaper)**:
- **Frontend**: Cloud Storage static hosting (FREE for small sites)
- **Backend**: Cloud Run
- **Database**: Cloud SQL (shared)
- **Storage**: Cloud Storage

## Cost Breakdown

### Current Setup (Minimal Cost)
- **Cloud SQL (db-f1-micro)**: **FREE** (first instance per billing account)
- **Cloud Storage**: ~$0.02/GB/month + $0.05 per 10,000 operations
  - For 100GB: ~$2/month
  - For 1TB: ~$20/month
- **Cloud Run**: 
  - **FREE tier**: 2 million requests/month, 360,000 GB-seconds, 180,000 vCPU-seconds
  - **After free tier**: $0.40 per million requests, $0.0000025 per GB-second, $0.0000100 per vCPU-second
  - **Estimated**: $0-5/month for low traffic (<100k requests/month)

**Total Estimated Cost**: **$0-25/month** for low-medium traffic

### Cost Optimization Tips
1. Use Cloud Run (serverless) instead of VMs - only pay when running
2. Use shared Cloud SQL instance (already done)
3. Use Cloud Storage lifecycle rules to delete old files (already configured)
4. Enable Cloud CDN for static assets (reduces Cloud Run costs)
5. Use Cloud Storage static hosting for frontend (FREE alternative)

## GitHub Actions Setup

### Step 1: Create GCP Service Account for CI/CD

```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD"

# Grant necessary permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### Step 2: Add GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions, add:

- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_SA_KEY`: Contents of `github-actions-key.json` (entire JSON file)
- `GCP_REGION`: `us-central1` (or your preferred region)

### Step 3: Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
  branches:
    - main  # or 'master' if that's your default branch

env:
  GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  GCP_REGION: ${{ secrets.GCP_REGION || 'us-central1' }}
  SERVICE_BACKEND: video-pipeline-backend
  SERVICE_FRONTEND: video-pipeline-frontend

jobs:
  deploy-backend:
    name: Deploy Backend
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: ./backend
        run: npm ci

      - name: Build backend
        working-directory: ./backend
        run: npm run build

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for GCR
        run: gcloud auth configure-docker

      - name: Build and push Docker image
        working-directory: ./backend
        run: |
          docker build -t gcr.io/$GCP_PROJECT_ID/$SERVICE_BACKEND:$GITHUB_SHA \
                       -t gcr.io/$GCP_PROJECT_ID/$SERVICE_BACKEND:latest .
          docker push gcr.io/$GCP_PROJECT_ID/$SERVICE_BACKEND:$GITHUB_SHA
          docker push gcr.io/$GCP_PROJECT_ID/$SERVICE_BACKEND:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy $SERVICE_BACKEND \
            --image gcr.io/$GCP_PROJECT_ID/$SERVICE_BACKEND:$GITHUB_SHA \
            --platform managed \
            --region $GCP_REGION \
            --allow-unauthenticated \
            --set-env-vars NODE_ENV=production \
            --set-secrets DATABASE_URL=db-connection:latest,JWT_SECRET=jwt-secret:latest,GCP_KEY_FILE=gcp-key:latest \
            --memory 512Mi \
            --cpu 1 \
            --min-instances 0 \
            --max-instances 10 \
            --timeout 300

  deploy-frontend:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Build frontend
        working-directory: ./frontend
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL || 'https://video-pipeline-backend-xxxxx.run.app' }}
        run: npm run build

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Deploy to Cloud Run
        working-directory: ./frontend
        run: |
          # Create a simple Dockerfile for frontend
          cat > Dockerfile << 'EOF'
          FROM nginx:alpine
          COPY dist /usr/share/nginx/html
          COPY nginx.conf /etc/nginx/conf.d/default.conf
          EXPOSE 80
          EOF
          
          cat > nginx.conf << 'EOF'
          server {
            listen 80;
            server_name _;
            root /usr/share/nginx/html;
            index index.html;
            
            location / {
              try_files $uri $uri/ /index.html;
            }
          }
          EOF
          
          docker build -t gcr.io/$GCP_PROJECT_ID/$SERVICE_FRONTEND:$GITHUB_SHA \
                       -t gcr.io/$GCP_PROJECT_ID/$SERVICE_FRONTEND:latest .
          docker push gcr.io/$GCP_PROJECT_ID/$SERVICE_FRONTEND:$GITHUB_SHA
          docker push gcr.io/$GCP_PROJECT_ID/$SERVICE_FRONTEND:latest
          
          gcloud run deploy $SERVICE_FRONTEND \
            --image gcr.io/$GCP_PROJECT_ID/$SERVICE_FRONTEND:$GITHUB_SHA \
            --platform managed \
            --region $GCP_REGION \
            --allow-unauthenticated \
            --memory 128Mi \
            --cpu 1 \
            --min-instances 0 \
            --max-instances 5 \
            --timeout 60

  # Alternative: Deploy frontend to Cloud Storage (FREE)
  deploy-frontend-static:
    name: Deploy Frontend to Cloud Storage
    runs-on: ubuntu-latest
    needs: deploy-backend
    if: false  # Set to true to use this instead of Cloud Run
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Build frontend
        working-directory: ./frontend
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
        run: npm run build

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Deploy to Cloud Storage
        working-directory: ./frontend
        run: |
          gsutil -m rsync -r -d dist/ gs://$GCP_PROJECT_ID-video-pipeline-prod-frontend/
          gsutil web set -m index.html -e index.html gs://$GCP_PROJECT_ID-video-pipeline-prod-frontend/
          gsutil iam ch allUsers:objectViewer gs://$GCP_PROJECT_ID-video-pipeline-prod-frontend
```

## Step 4: Update Backend Dockerfile

Ensure `backend/Dockerfile` is production-ready:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]
```

## Step 5: Set Up GCP Secrets Manager

Store sensitive values in Secret Manager:

```bash
# Database connection string
echo "postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE" | \
  gcloud secrets create db-connection --data-file=-

# JWT Secret
echo "your-super-secret-jwt-key" | \
  gcloud secrets create jwt-secret --data-file=-

# GCP Service Account Key (base64 encoded)
cat gcp-key-prod.json | base64 | \
  gcloud secrets create gcp-key --data-file=-
```

## Step 6: Configure Cloud Run Environment

After first deployment, update Cloud Run service to use secrets:

```bash
gcloud run services update video-pipeline-backend \
  --region us-central1 \
  --update-env-vars NODE_ENV=production \
  --update-secrets DATABASE_URL=db-connection:latest,JWT_SECRET=jwt-secret:latest,GCP_KEY_FILE=gcp-key:latest
```

## Step 7: Set Up Custom Domain (Optional)

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service video-pipeline-backend \
  --domain api.yourdomain.com \
  --region us-central1
```

## Cost Optimization Strategies

### 1. Use Cloud Run with Min Instances = 0
- **Saves**: ~$10-30/month (no idle costs)
- **Trade-off**: Cold start latency (~1-2 seconds on first request)

### 2. Use Cloud Storage for Frontend
- **Saves**: ~$2-5/month (no Cloud Run costs for frontend)
- **Setup**: Static site hosting in Cloud Storage

### 3. Enable Cloud CDN
- **Cost**: ~$0.01-0.08/GB (cheaper than Cloud Run for static assets)
- **Benefit**: Faster loading, lower Cloud Run costs

### 4. Optimize Database
- Already using shared instance (FREE tier)
- Consider connection pooling to reduce connections

### 5. Set Up Budget Alerts
```bash
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Video Pipeline Budget" \
  --budget-amount=50USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

## Monitoring & Alerts

Set up monitoring:

```bash
# Create alert for high costs
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Cloud Run Costs" \
  --condition-display-name="Cloud Run cost > $10" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=3600s
```

## Troubleshooting

### Build Fails
- Check GitHub Actions logs
- Verify secrets are set correctly
- Ensure Dockerfile is correct

### Deployment Fails
- Check Cloud Run logs: `gcloud run services logs read SERVICE_NAME`
- Verify service account permissions
- Check environment variables

### High Costs
- Review Cloud Run metrics in GCP Console
- Check for memory leaks or inefficient code
- Consider reducing max instances

## Next Steps

1. Set up the GitHub Actions workflow
2. Configure GCP secrets
3. Test deployment on a test branch first
4. Monitor costs for first month
5. Set up budget alerts
6. Optimize based on actual usage

