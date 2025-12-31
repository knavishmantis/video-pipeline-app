# Local Testing Guide

## Quick Start (Without GCP - Testing Core Features)

For initial development and testing of core features (without file uploads), you can run the app locally without GCP setup.

### Prerequisites
- Node.js 18+
- PostgreSQL (or use SQLite for quick testing)

### 1. Database Setup

**Option A: PostgreSQL (Recommended)**
```bash
# Create database
createdb video_pipeline_dev

# Or using psql
psql -c "CREATE DATABASE video_pipeline_dev;"
```

**Option B: SQLite (Quick Testing)**
```bash
# No setup needed, SQLite will create the file automatically
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/video_pipeline_dev
# Or for SQLite: DATABASE_URL=sqlite://./dev.db

JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# GCP - Leave empty or use dummy values for testing without uploads
GCP_PROJECT_ID=
GCP_BUCKET_NAME=
GCP_KEY_FILE=

FRONTEND_URL=http://localhost:3000
```

**Note**: File uploads won't work without GCP, but you can test all other features.

Run migrations:
```bash
npm run migrate
```

Start backend:
```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env` (optional):
```env
VITE_API_URL=http://localhost:3001/api
```

Start frontend:
```bash
npm run dev
```

### 4. Create Admin User

```bash
cd backend
npm run create-admin admin@example.com password123 "Admin User"
```

### 5. Access the App

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Login with: `admin@example.com` / `password123`

## Testing with GCP (Full Features)

To test file uploads, you'll need GCP setup. See [GCP Setup Guide](GCP_SETUP.md) or `../terraform/README.md` for provisioning GCP resources.

### Quick GCP Setup

1. **Provision Dev Environment**:
```bash
cd terraform
terraform init
terraform workspace new dev
terraform apply -var="project_id=your-gcp-project-id" -var="environment=dev"
```

2. **Save Service Account Key**:
```bash
# Get the key from terraform output
terraform output -raw service_account_key_private_key | base64 -d > ../backend/gcp-key-dev.json
```

3. **Update Backend .env**:
```env
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-project-id-video-pipeline-dev
GCP_KEY_FILE=./gcp-key-dev.json
```

4. **Restart Backend** - File uploads will now work!

## Testing Workflow

1. **Create a Short**: Login → Dashboard → (You'll need to add a "Create Short" button or use API)
2. **Assign Clipper**: Go to short detail → Assign → Select clipper
3. **Upload Clip**: As clipper, upload a clip file
4. **Assign Editor**: Assign editor to short
5. **Upload Final Video**: As editor, upload final video
6. **Track Payment**: As admin, go to Payments → Create payment

## API Testing with curl

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Save token from response
TOKEN="your-jwt-token-here"

# Get all shorts
curl http://localhost:3001/api/shorts \
  -H "Authorization: Bearer $TOKEN"

# Create a short
curl -X POST http://localhost:3001/api/shorts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Short","description":"Testing","idea":"Test idea"}'
```

## Troubleshooting

### Database Connection Issues
- Check PostgreSQL is running: `pg_isready`
- Verify connection string in `.env`
- Check database exists: `psql -l | grep video_pipeline`

### CORS Errors
- Ensure `FRONTEND_URL` in backend `.env` matches frontend URL
- Check browser console for specific CORS errors

### File Upload Fails
- Verify GCP credentials are correct
- Check bucket name matches terraform output
- Ensure service account has Storage permissions

### Port Already in Use
- Change `PORT` in backend `.env`
- Update `VITE_API_URL` in frontend `.env` to match

