# Quick Start Guide

## Answers to Your Questions

### 1. Will backend and frontend run as one single hosted app?

**Development**: No, they run separately
- Frontend: `http://localhost:3000` (Vite dev server)
- Backend: `http://localhost:3001` (Express API)
- Frontend proxies API calls to backend

**Production**: You have two options:
- **Option A**: Deploy separately (recommended for scale)
  - Frontend → Vercel/Netlify/Cloudflare Pages
  - Backend → Cloud Run/App Engine/Railway
- **Option B**: Combined deployment (simpler)
  - Build frontend, serve from backend
  - Deploy single service
  - See [Deployment Guide](DEPLOYMENT.md) for details

### 2. How to test locally?

**Without GCP (Core Features Only):**
```bash
# 1. Install
cd backend && npm install
cd ../frontend && npm install

# 2. Setup database
# Create PostgreSQL DB or use SQLite
# Update backend/.env with DATABASE_URL

# 3. Run migrations
cd backend && npm run migrate

# 4. Create admin
cd backend && npm run create-admin admin@test.com password123

# 5. Start servers (2 terminals)
cd backend && npm run dev      # Terminal 1
cd frontend && npm run dev     # Terminal 2

# 6. Open http://localhost:3000
```

**With GCP (Full Features):**
1. Follow steps above
2. Provision GCP with Terraform (see below)
3. Update backend/.env with GCP credentials
4. File uploads will work!

### 3. GCP Connection Requirements

**Yes, GCP is required for file uploads**, but:
- ✅ You can test **all other features** without GCP
- ✅ File uploads require GCP Storage bucket
- ✅ Use **separate dev and prod buckets** (best practice)

### 4. Dev vs Prod GCP Setup

**Yes, absolutely!** Use separate buckets:

**Dev Environment:**
- Bucket: `your-project-video-pipeline-dev`
- Service Account: `video-pipeline-dev@...`
- Key: `gcp-key-dev.json`

**Prod Environment:**
- Bucket: `your-project-video-pipeline-prod`
- Service Account: `video-pipeline-prod@...`
- Key: `gcp-key-prod.json`

### 5. Terraform for GCP Provisioning

✅ **Terraform config is ready!** See `terraform/` directory.

## Complete Setup Flow

### Step 1: Local Testing (No GCP)

```bash
# Backend
cd backend
npm install
# Create .env file (see [Setup Guide](SETUP.md))
npm run migrate
npm run setup-admin your-password-here  # Sets quinncaverly@gmail.com as admin
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

✅ You can now test: authentication, shorts, assignments, payments
❌ File uploads won't work (needs GCP)

**Note:** 
- All data is stored in PostgreSQL (not GCP)
- GCP is ONLY for video/audio file storage
- Users must complete profile (Discord, PayPal, Google) before using app
- Only admins can create new users

### Step 2: Provision Dev GCP Environment

```bash
cd terraform

# Initialize
terraform init

# Create dev workspace
terraform workspace new dev
terraform workspace select dev

# Apply (replace with your project ID)
terraform apply \
  -var="project_id=your-gcp-project-id" \
  -var="environment=dev"

# Save service account key
terraform output -raw service_account_key_private_key | \
  base64 -d > ../backend/gcp-key-dev.json
```

### Step 3: Update Backend Config

Edit `backend/.env`:
```env
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-project-id-video-pipeline-dev
GCP_KEY_FILE=./gcp-key-dev.json
```

Restart backend → File uploads now work!

### Step 4: Provision Prod GCP Environment

```bash
cd terraform

# Create prod workspace
terraform workspace new prod
terraform workspace select prod

# Apply
terraform apply \
  -var="project_id=your-gcp-project-id" \
  -var="environment=prod"

# Save key (keep secure!)
terraform output -raw service_account_key_private_key | \
  base64 -d > ../backend/gcp-key-prod.json
```

For production deployment, use `gcp-key-prod.json` and prod bucket name.

## File Structure

```
video-pipeline-app/
├── backend/              # Express API
│   ├── src/
│   ├── .env             # Dev config
│   ├── gcp-key-dev.json # Dev GCP key (gitignored)
│   └── Dockerfile       # For containerized deployment
├── frontend/            # React app
│   ├── src/
│   └── dist/            # Built files (for production)
├── terraform/           # GCP infrastructure
│   ├── main.tf          # Resource definitions
│   └── README.md        # Terraform guide
└── shared/              # Shared TypeScript types
```

## Environment Variables Summary

**Backend `.env`:**
```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/video_pipeline_dev

# Auth
JWT_SECRET=dev-secret
JWT_EXPIRES_IN=7d

# GCP (Dev)
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-project-id-video-pipeline-dev
GCP_KEY_FILE=./gcp-key-dev.json

# CORS
FRONTEND_URL=http://localhost:3000
```

**Frontend `.env` (optional):**
```env
VITE_API_URL=http://localhost:3001/api
```

## Next Steps

1. ✅ Test locally without GCP
2. ✅ Provision dev GCP environment
3. ✅ Test file uploads
4. ✅ Deploy to production (see [Deployment Guide](DEPLOYMENT.md))
5. ✅ Provision prod GCP environment

## Troubleshooting

**"GCP_KEY_FILE environment variable is required"**
→ Leave GCP vars empty for testing without uploads, or set them up with Terraform

**Database connection errors**
→ Check `DATABASE_URL` in `.env`, ensure PostgreSQL is running

**CORS errors**
→ Ensure `FRONTEND_URL` in backend `.env` matches frontend URL

**File upload fails**
→ Verify GCP credentials, bucket name, and service account permissions

See [Local Testing Guide](LOCAL_TESTING.md) and [Deployment Guide](DEPLOYMENT.md) for more details!

