# GCP Setup Guide

## Important: Data Storage Architecture

**GCP Storage Buckets** are ONLY used for:
- Video files (clips, final videos)
- Audio files
- Large media assets

**PostgreSQL Database** stores ALL persistent data:
- User accounts and profiles
- Shorts (ideas, scripts, metadata)
- Assignments and due dates
- Payment records
- All relationships and business data

**GCP is NOT required for:**
- User authentication
- Creating shorts
- Managing assignments
- Payment tracking
- Any core app functionality

**GCP IS required for:**
- Uploading video clips
- Uploading audio files
- Uploading final videos
- Downloading/viewing uploaded media

## Setup GCP for Local Development

### Step 1: Install Prerequisites

```bash
# Install Terraform (if not already installed)
# macOS: brew install terraform
# Linux: Download from https://www.terraform.io/downloads

# Install Google Cloud SDK (if not already installed)
# macOS: brew install google-cloud-sdk
# Linux: Follow https://cloud.google.com/sdk/docs/install

# Authenticate with GCP
gcloud auth login
gcloud auth application-default login
```

### Step 2: Create or Select GCP Project

```bash
# List existing projects
gcloud projects list

# Create new project (optional)
gcloud projects create your-project-id --name="Video Pipeline"

# Set active project
gcloud config set project your-project-id

# Enable required APIs
gcloud services enable storage-component.googleapis.com
gcloud services enable iam.googleapis.com
```

### Step 3: Provision Dev Environment with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Create dev workspace
terraform workspace new dev
terraform workspace select dev

# Review what will be created
terraform plan \
  -var="project_id=your-project-id" \
  -var="environment=dev"

# Apply (creates bucket, service account, permissions)
terraform apply \
  -var="project_id=your-project-id" \
  -var="environment=dev"
```

**Expected Output:**
- Storage bucket: `your-project-id-video-pipeline-dev`
- Service account: `video-pipeline-dev@your-project-id.iam.gserviceaccount.com`
- Service account key (base64 encoded)

### Step 4: Save Service Account Key

```bash
# Get the key and save it
terraform output -raw service_account_key_private_key | \
  base64 -d > ../backend/gcp-key-dev.json

# Verify the file was created
ls -la ../backend/gcp-key-dev.json
```

### Step 5: Update Backend Configuration

Edit `backend/.env`:

```env
# ... other config ...

# GCP Storage (Dev)
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-project-id-video-pipeline-dev
GCP_KEY_FILE=./gcp-key-dev.json
```

### Step 6: Test the Connection

```bash
cd backend
npm run dev
```

Try uploading a file through the UI. If it works, GCP is configured correctly!

## Setup Production GCP Environment

```bash
cd terraform

# Create prod workspace
terraform workspace new prod
terraform workspace select prod

# Apply
terraform apply \
  -var="project_id=your-project-id" \
  -var="environment=prod"

# Save key (keep secure!)
terraform output -raw service_account_key_private_key | \
  base64 -d > ../backend/gcp-key-prod.json
```

**Important:** 
- Never commit `gcp-key-*.json` files to git
- Use different bucket for production
- Rotate keys periodically
- Use environment variables in production (not files)

## Verify GCP Setup

### Check Bucket Exists
```bash
gsutil ls gs://your-project-id-video-pipeline-dev
```

### Test Upload (Manual)
```bash
echo "test" > test.txt
gsutil cp test.txt gs://your-project-id-video-pipeline-dev/test/
gsutil rm gs://your-project-id-video-pipeline-dev/test/test.txt
```

### Check Service Account Permissions
```bash
# List service account
gcloud iam service-accounts list

# Check bucket permissions
gsutil iam get gs://your-project-id-video-pipeline-dev
```

## Troubleshooting

### "GCP_KEY_FILE environment variable is required"
- Make sure `GCP_KEY_FILE` is set in `backend/.env`
- Verify the key file exists at the specified path
- Check file permissions: `chmod 600 gcp-key-dev.json`

### "Permission denied" errors
- Verify service account has Storage permissions
- Check bucket IAM: `gsutil iam get gs://your-bucket-name`
- Re-run terraform if permissions are missing

### "Bucket not found"
- Verify bucket name matches terraform output
- Check you're using the correct project
- List buckets: `gsutil ls`

### File uploads fail
- Check backend logs for detailed error
- Verify GCP credentials are valid
- Test with `gcloud auth application-default login`

## Cost Considerations

GCP Storage pricing (as of 2024):
- Storage: ~$0.020 per GB/month
- Operations: ~$0.05 per 10,000 operations
- Network egress: Varies by region

**Tips:**
- Use lifecycle rules to delete old files (configured in terraform)
- Consider different storage classes for archived files
- Monitor usage in GCP Console

## Security Best Practices

1. **Never commit keys to git** - Already in `.gitignore`
2. **Use separate dev/prod buckets** - Prevents accidental data mixing
3. **Rotate keys periodically** - Create new keys, update, delete old
4. **Limit service account permissions** - Only Storage permissions needed
5. **Use signed URLs** - Time-limited access (already implemented)
6. **Enable bucket versioning** (optional) - For production data protection

## Next Steps

After GCP is set up:
1. ✅ Test file uploads in the app
2. ✅ Verify files appear in GCP Console
3. ✅ Test file downloads
4. ✅ Set up production environment when ready
5. ✅ Configure monitoring/alerts in GCP Console

