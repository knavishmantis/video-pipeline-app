# GitHub Secrets Setup (Simple - No GCP Secrets Manager)

Use GitHub secrets for everything - simpler and works great!

## Required GitHub Secrets

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these 7 secrets:

### 1. `GCP_PROJECT_ID`
- **Value**: `knavishmantis`

### 2. `GCP_SA_KEY`
- **Value**: Full contents of `backend/github-actions-key.json` (entire JSON file)
- **How to get**: See "Create Service Account" below

### 3. `GCP_REGION`
- **Value**: `us-central1`

### 4. `VITE_API_URL`
- **Value**: `https://api.yourdomain.com/api` (or Cloud Run URL before domain setup)
- **Update later**: After domain is set up

### 5. `DATABASE_URL`
- **Value**: `postgresql://video_pipeline_prod:PASSWORD@34.58.157.140:5432/video_pipeline_prod`
- **Get password**: `terraform -chdir=terraform output -raw database_password`
- **Note**: URL-encode special characters in password

### 6. `JWT_SECRET`
- **Value**: Generate with: `openssl rand -base64 32`
- **Must be**: At least 32 characters

### 7. `GCP_KEY_FILE`
- **Value**: Base64 encoded contents of `backend/gcp-key-prod.json`
- **How to get**: `cat backend/gcp-key-prod.json | base64`

### 8. `FRONTEND_URL` (optional, defaults to localhost)
- **Value**: `https://yourdomain.com` (or Cloud Run URL)

## Create Service Account for CI/CD

```bash
export PROJECT_ID="knavishmantis"

# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD" \
  --project=$PROJECT_ID

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and save key
gcloud iam service-accounts keys create backend/github-actions-key.json \
  --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com

# Copy the entire JSON content for GCP_SA_KEY secret
cat backend/github-actions-key.json
```

## Quick Setup Script

```bash
# Get database password (URL-encode it)
DB_PASS=$(terraform -chdir=terraform output -raw database_password)
DB_PASS_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$DB_PASS'))")

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Get GCP key (base64)
GCP_KEY=$(cat backend/gcp-key-prod.json | base64)

echo "Add these to GitHub secrets:"
echo "DATABASE_URL=postgresql://video_pipeline_prod:${DB_PASS_ENC}@34.58.157.140:5432/video_pipeline_prod"
echo "JWT_SECRET=${JWT_SECRET}"
echo "GCP_KEY_FILE=${GCP_KEY}"
```

## That's It!

No GCP Secrets Manager needed. Just add all secrets to GitHub and push to main!

