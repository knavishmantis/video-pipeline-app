# Hosting Options for Backend + Frontend

## Recommended: Separate Hosting (Best for Scale)

### Option 1: Cloud Run (Backend) + Cloudflare Pages/Vercel (Frontend) ⭐ Recommended

**Backend (Cloud Run):**
- **Cost**: ~$0-10/month (pay per request, free tier: 2M requests/month)
- **Pros**: 
  - Auto-scales to zero when not in use
  - Serverless, no server management
  - Built-in load balancing
  - Easy deployment from Docker
- **Cons**: Cold starts (first request after idle)

**Frontend (Cloudflare Pages or Vercel):**
- **Cost**: FREE (both have generous free tiers)
- **Pros**:
  - Global CDN
  - Automatic deployments from Git
  - Fast and reliable
- **Setup**: Build React app, deploy static files

**Total**: ~$0-10/month

### Option 2: Cloud Run for Both

**Backend + Frontend on Cloud Run:**
- **Cost**: ~$0-15/month
- **Setup**: 
  - Backend: Docker container
  - Frontend: Build React, serve from backend or separate Cloud Run service
- **Pros**: Everything in one place, easy to manage
- **Cons**: Slightly more complex setup

**Total**: ~$0-15/month

### Option 3: App Engine (Simplest)

**Both on App Engine:**
- **Cost**: ~$0-25/month (free tier: 28 hours/day)
- **Pros**: 
  - Very easy deployment
  - Auto-scaling
  - Built-in load balancing
- **Cons**: Less flexible than Cloud Run

**Total**: ~$0-25/month

## Cost Comparison

| Option | Backend | Frontend | Monthly Cost |
|--------|---------|----------|--------------|
| Cloud Run + Vercel | Cloud Run | Vercel | $0-10 |
| Cloud Run Both | Cloud Run | Cloud Run | $0-15 |
| App Engine | App Engine | App Engine | $0-25 |
| Compute Engine | VM | VM | $20-50 |

## Recommended Setup

### For Your Use Case (Low-Medium Traffic)

**Best Choice**: **Cloud Run (Backend) + Vercel/Cloudflare Pages (Frontend)**

**Why:**
- ✅ Lowest cost (~$0-10/month)
- ✅ Auto-scales (handles traffic spikes)
- ✅ Easy deployment
- ✅ Global CDN for frontend
- ✅ No server management

**Monthly Costs:**
- Backend (Cloud Run): $0-10
- Frontend (Vercel): FREE
- Cloud SQL: $0 (dev) / $0-25 (prod with db-f1-micro)
- Storage: $1-10
- **Total**: **~$1-45/month**

## Deployment Steps (Cloud Run + Vercel)

### Backend (Cloud Run)

1. **Build Docker image:**
   ```bash
   cd backend
   gcloud builds submit --tag gcr.io/knavishmantis/video-pipeline-backend
   ```

2. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy video-pipeline-backend \
     --image gcr.io/knavishmantis/video-pipeline-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

3. **Set environment variables:**
   ```bash
   gcloud run services update video-pipeline-backend \
     --set-env-vars="DATABASE_URL=...,GCP_BUCKET_NAME=..."
   ```

### Frontend (Vercel)

1. **Connect GitHub repo to Vercel**
2. **Set build command**: `cd frontend && npm run build`
3. **Set output directory**: `frontend/dist`
4. **Add environment variables**:
   - `VITE_API_URL=https://your-cloud-run-url.run.app`
   - `VITE_GOOGLE_CLIENT_ID=...`

5. **Deploy**: Automatic on every push to main

## Updated Total Costs

### Dev Environment
- Cloud SQL: **$0** (free tier)
- Storage: **$1**
- Backend (Cloud Run): **$0** (free tier)
- Frontend (Vercel): **$0** (free tier)
- **Total**: **~$1/month**

### Prod Environment
- Cloud SQL: **$0** (db-f1-micro) or **$25** (db-g1-small if needed)
- Storage: **$1-10**
- Backend (Cloud Run): **$0-10**
- Frontend (Vercel): **$0** (free tier)
- **Total**: **~$2-45/month**

### Both Environments
- **Total**: **~$3-50/month** (~$36-600/year)

## When to Upgrade

**Upgrade Cloud SQL if:**
- Database becomes slow
- You need more connections
- You hit storage limits

**Upgrade Cloud Run if:**
- You exceed free tier (2M requests/month)
- Need more CPU/memory
- Cold starts become an issue

## Alternative: Single VM (If You Prefer)

**Compute Engine (e2-micro):**
- **Cost**: ~$7-10/month
- **Pros**: Full control, no cold starts
- **Cons**: You manage everything, no auto-scaling

**Setup**: Single VM running both backend and frontend

