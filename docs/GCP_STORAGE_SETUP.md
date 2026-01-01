# GCP Storage Setup for Cloud Run

## Option 1: Service Account (Recommended for Cloud Run)

This is the recommended approach for Cloud Run - no key files needed.

### Step 1: Create a Service Account

```bash
# Create service account
gcloud iam service-accounts create video-pipeline-storage \
  --project knavishmantis \
  --display-name "Video Pipeline Storage Service Account"

# Grant Storage permissions
gcloud projects add-iam-policy-binding knavishmantis \
  --member="serviceAccount:video-pipeline-storage@knavishmantis.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### Step 2: Create Storage Bucket

```bash
# Create bucket
gsutil mb -p knavishmantis -l us-central1 gs://knavishmantis-video-pipeline

# Make bucket accessible (or keep private and use signed URLs)
gsutil iam ch serviceAccount:video-pipeline-storage@knavishmantis.iam.gserviceaccount.com:objectAdmin gs://knavishmantis-video-pipeline
```

### Step 3: Attach Service Account to Cloud Run

```bash
# Attach service account to backend
gcloud run services update video-pipeline-backend \
  --service-account video-pipeline-storage@knavishmantis.iam.gserviceaccount.com \
  --region us-central1 \
  --project knavishmantis
```

### Step 4: Update Code to Use Application Default Credentials

The code needs to be updated to use Application Default Credentials instead of keyFilename.

**Note:** This requires a code change. Currently the code uses `keyFilename` which expects a file path. For Cloud Run with service accounts, we should use Application Default Credentials.

### Step 5: Set Environment Variables

Only these two are needed with service account:
- `GCP_PROJECT_ID`: `knavishmantis`
- `GCP_BUCKET_NAME`: `knavishmantis-video-pipeline`

## Option 2: JSON Key File (Works with Current Code)

If you want to use the current code without changes:

### Step 1: Create Service Account and Download Key

```bash
# Create service account
gcloud iam service-accounts create video-pipeline-storage \
  --project knavishmantis \
  --display-name "Video Pipeline Storage Service Account"

# Grant Storage permissions
gcloud projects add-iam-policy-binding knavishmantis \
  --member="serviceAccount:video-pipeline-storage@knavishmantis.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Create and download key
gcloud iam service-accounts keys create /tmp/video-pipeline-key.json \
  --iam-account=video-pipeline-storage@knavishmantis.iam.gserviceaccount.com \
  --project knavishmantis
```

### Step 2: Create Storage Bucket

```bash
# Create bucket
gsutil mb -p knavishmantis -l us-central1 gs://knavishmantis-video-pipeline
```

### Step 3: Store Key in GitHub Secrets

**Important:** For Cloud Run, you need to store the entire JSON key content as a string, then write it to a temp file at runtime. However, the current code expects a file path, which won't work in Cloud Run.

**This approach requires code changes** to write the JSON content to a temp file at runtime.

## Recommendation

Use **Option 1 (Service Account)** - it's more secure, simpler, and the Cloud Run best practice. We'll need to update the code to support Application Default Credentials.

## Quick Setup Commands (Option 1)

```bash
PROJECT_ID="knavishmantis"
SERVICE_ACCOUNT="video-pipeline-storage"
BUCKET_NAME="knavishmantis-video-pipeline"

# Create service account
gcloud iam service-accounts create $SERVICE_ACCOUNT \
  --project $PROJECT_ID \
  --display-name "Video Pipeline Storage"

# Grant Storage permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Create bucket
gsutil mb -p $PROJECT_ID -l us-central1 gs://$BUCKET_NAME

# Grant bucket access
gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com:objectAdmin gs://$BUCKET_NAME

# Attach to Cloud Run service
gcloud run services update video-pipeline-backend \
  --service-account ${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com \
  --region us-central1 \
  --project $PROJECT_ID

# Set environment variables (in GitHub Secrets or Cloud Run)
# GCP_PROJECT_ID: knavishmantis
# GCP_BUCKET_NAME: knavishmantis-video-pipeline
# GCP_KEY_FILE: (not needed with service account)
```

## Next Steps

After setting up the service account and bucket, we need to update `backend/src/services/gcpStorage.ts` to use Application Default Credentials when `GCP_KEY_FILE` is not set.

