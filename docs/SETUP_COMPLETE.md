# Complete Setup Guide

## Architecture Clarification

**Data Storage:**
- ✅ **PostgreSQL Database**: Stores ALL persistent data
  - User accounts, profiles, authentication
  - Shorts (ideas, scripts, metadata)
  - Assignments and due dates
  - Payment records
  - All relationships

- ✅ **GCP Storage Buckets**: ONLY for media files
  - Video clips
  - Audio files
  - Final videos
  - Large binary assets

**GCP is NOT required for:**
- User authentication
- Creating/managing shorts
- Assignments
- Payments
- Any core functionality

**GCP IS required for:**
- Uploading video/audio files
- Downloading uploaded media

## Complete Setup Steps

### 1. Initial Setup (No GCP Needed)

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Create backend/.env
cat > backend/.env << EOF
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/video_pipeline_dev
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
EOF

# Run migrations
cd backend && npm run migrate

# Set up your admin account
cd backend && npm run setup-admin your-secure-password-here

# This creates quinncaverly@gmail.com as admin with your password
```

### 2. Start Development Servers

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### 3. First Login

1. Open http://localhost:3000
2. Login with: `quinncaverly@gmail.com` / `your-secure-password`
3. You'll be prompted to complete your profile:
   - Discord username
   - PayPal email
   - Google account (already set to quinncaverly@gmail.com)
4. After completing profile, you can use the app!

### 4. Create Users (Admin Only)

**Only you (admin) can create users:**
1. Go to Users page
2. Click "Create User" (admin only)
3. Fill in user details
4. User will be created without password (they'll need to set it)
5. User must complete profile on first login

### 5. Set Up GCP (For File Uploads)

See [GCP_SETUP.md](GCP_SETUP.md) for detailed instructions.

**Quick version:**
```bash
cd terraform
terraform init
terraform workspace new dev
terraform apply -var="project_id=your-project-id" -var="environment=dev"
terraform output -raw service_account_key_private_key | base64 -d > ../backend/gcp-key-dev.json
```

Update `backend/.env`:
```env
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-project-id-video-pipeline-dev
GCP_KEY_FILE=./gcp-key-dev.json
```

Restart backend → File uploads now work!

## Security Features Implemented

✅ **Admin-Only User Creation**
- Public registration disabled
- Only admins can create users via `/api/users` endpoint
- Users created by admin must complete profile

✅ **Profile Completion Required**
- Users must fill: Discord, PayPal, Google account
- Cannot use app until profile is complete
- Redirected to `/complete-profile` if incomplete

✅ **Your Admin Account**
- `quinncaverly@gmail.com` set as admin
- Google account automatically set
- Full control over user management

## User Flow

1. **Admin creates user** → User exists but no password
2. **User logs in** → Must complete profile first
3. **Profile completion** → Can now use app
4. **Normal usage** → Create shorts, assignments, etc.

## Testing Without GCP

You can test everything except file uploads:
- ✅ User authentication
- ✅ Creating shorts
- ✅ Assignments
- ✅ Payment tracking
- ✅ All CRUD operations
- ❌ File uploads (needs GCP)

## Next Steps

1. ✅ Set up database and create admin
2. ✅ Test core features
3. ✅ Create test users
4. ✅ Set up GCP for file uploads
5. ✅ Deploy to production when ready

## Troubleshooting

**"Profile incomplete" error:**
- User must complete profile at `/complete-profile`
- All three fields required: Discord, PayPal, Google

**"Only admins can create users":**
- This is by design
- Use admin account to create users
- Or use `usersApi.create()` as admin

**GCP upload errors:**
- Verify GCP credentials in `.env`
- Check bucket name matches terraform output
- Ensure service account has Storage permissions

