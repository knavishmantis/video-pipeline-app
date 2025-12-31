# GCP Dev/Prod Setup Guide

This guide explains how to set up separate GCP storage buckets for development and production environments.

## Overview

The app uses environment variables to determine which GCP bucket to use. You can have separate buckets for dev and prod, or use the same bucket for both (not recommended for production).

## Terraform Setup

The Terraform configuration in `terraform/main.tf` creates separate buckets based on the `environment` variable:

- **Dev bucket**: `{project_id}-video-pipeline-dev`
- **Prod bucket**: `{project_id}-video-pipeline-prod`

### Creating Dev Bucket

```bash
cd terraform
terraform init
terraform plan -var="project_id=your-gcp-project-id" -var="environment=dev"
terraform apply -var="project_id=your-gcp-project-id" -var="environment=dev"
```

After applying, save the service account key:
```bash
terraform output -raw service_account_key_private_key | base64 -d > ../backend/gcp-key-dev.json
```

### Creating Prod Bucket

```bash
terraform plan -var="project_id=your-gcp-project-id" -var="environment=prod"
terraform apply -var="project_id=your-gcp-project-id" -var="environment=prod"
```

Save the prod service account key:
```bash
terraform output -raw service_account_key_private_key | base64 -d > ../backend/gcp-key-prod.json
```

## Environment Variables

### Development (Local Testing)

Create or update `backend/.env`:

```env
# GCP Configuration for Dev
GCP_PROJECT_ID=your-gcp-project-id
GCP_BUCKET_NAME=your-gcp-project-id-video-pipeline-dev
GCP_KEY_FILE=./gcp-key-dev.json
```

### Production

For production, set these environment variables (via your hosting platform):

```env
# GCP Configuration for Prod
GCP_PROJECT_ID=your-gcp-project-id
GCP_BUCKET_NAME=your-gcp-project-id-video-pipeline-prod
GCP_KEY_FILE=./gcp-key-prod.json
```

## How It Works

1. **Bucket Selection**: The app reads `GCP_BUCKET_NAME` from environment variables
2. **Service Account**: Uses the key file specified in `GCP_KEY_FILE` to authenticate
3. **File Organization**: Files are stored in paths like:
   - `shorts/{shortId}/{fileType}/{timestamp}-{filename}`
   - `users/{userId}/profile_picture/{timestamp}-{filename}`

## Verifying Which Bucket You're Using

### Check Backend Logs

When the backend starts, it will attempt to connect to GCP. If configured correctly, file uploads will work. If not, you'll see errors.

### Check Environment Variables

```bash
# In backend directory
cat .env | grep GCP
```

### Test Upload

Try uploading a file through the app. If it succeeds, check the GCP Console to see which bucket the file was uploaded to.

## Best Practices

1. **Separate Buckets**: Always use separate buckets for dev and prod
2. **Key Files**: Never commit `gcp-key-*.json` files to git (they're in `.gitignore`)
3. **Environment Variables**: Use different `.env` files or environment variable management for dev vs prod
4. **Bucket Naming**: The Terraform setup automatically prefixes bucket names with the environment

## Troubleshooting

### "GCP_BUCKET_NAME environment variable is required"

Make sure your `backend/.env` file has `GCP_BUCKET_NAME` set.

### "GCP_KEY_FILE and GCP_PROJECT_ID environment variables are required"

Ensure both `GCP_PROJECT_ID` and `GCP_KEY_FILE` are set in your `.env` file.

### Files not uploading

1. Check that the service account key file exists at the path specified in `GCP_KEY_FILE`
2. Verify the service account has the correct permissions (should have `storage.objectAdmin` role)
3. Check that the bucket name matches exactly (including the `-dev` or `-prod` suffix)

## Switching Between Dev and Prod

To switch between environments locally:

1. Update `backend/.env` with the appropriate values
2. Restart the backend server
3. The app will now use the specified bucket

