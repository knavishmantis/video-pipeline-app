# Dev Environment Setup Complete

The dev environment has been successfully created and configured!

## Created Resources

✅ **Storage Bucket**: `knavishmantis-video-pipeline-dev`
✅ **Service Account**: `video-pipeline-dev@knavishmantis.iam.gserviceaccount.com`
✅ **Service Account Key**: Saved to `backend/gcp-key-dev.json`

## Backend Configuration

Update your `backend/.env` file with the following:

```env
# Database
DATABASE_URL=sqlite://./dev.db

# GCP Configuration for Dev
GCP_PROJECT_ID=knavishmantis
GCP_BUCKET_NAME=knavishmantis-video-pipeline-dev
GCP_KEY_FILE=./gcp-key-dev.json

# JWT
JWT_SECRET=your-jwt-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Verify Setup

1. **Check the key file exists**:
   ```bash
   ls -lh backend/gcp-key-dev.json
   ```

2. **Start the backend**:
   ```bash
   cd backend
   npm run dev
   ```

3. **Look for this log message**:
   ```
   GCP Storage initialized. Using bucket: knavishmantis-video-pipeline-dev
   ```

## Testing File Uploads

Once the backend is running, you can test file uploads through the app. Files will be stored in:
- `gs://knavishmantis-video-pipeline-dev/shorts/{shortId}/{fileType}/...`
- `gs://knavishmantis-video-pipeline-dev/users/{userId}/profile_picture/...`

## Next Steps

1. Update `backend/.env` with the GCP configuration above
2. Run database migrations: `cd backend && npm run migrate`
3. Set up admin user: `cd backend && npm run setup-admin`
4. Start the backend: `cd backend && npm run dev`
5. Start the frontend: `cd frontend && npm run dev`

## Terraform Workspace

You're currently in the `dev` workspace. To switch:

```bash
cd terraform
terraform workspace show  # Shows current workspace
terraform workspace select dev  # Switch to dev
terraform workspace select prod  # Switch to prod (when created)
```

