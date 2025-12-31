# Terraform GCP Infrastructure

This Terraform configuration provisions the GCP resources needed for the video pipeline app.

## Resources Created

- **Storage Bucket**: For storing video files, clips, audio, and final videos
- **Service Account**: For application authentication with GCP
- **IAM Bindings**: Grants necessary permissions to the service account
- **Service Account Key**: For local development (saved as JSON file)

## Prerequisites

1. **GCP Project** created
2. **Terraform** installed (>= 1.0)
3. **Google Cloud SDK** installed and authenticated:
   ```bash
   gcloud auth application-default login
   ```

## Setup

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Create Dev Environment

```bash
terraform workspace new dev
terraform workspace select dev

terraform apply -var="project_id=your-gcp-project-id" -var="environment=dev"
```

This will:
- Create a storage bucket: `your-project-id-video-pipeline-dev`
- Create a service account: `video-pipeline-dev@your-project-id.iam.gserviceaccount.com`
- Generate a service account key file

### 3. Create Prod Environment

```bash
terraform workspace new prod
terraform workspace select prod

terraform apply -var="project_id=your-gcp-project-id" -var="environment=prod"
```

### 4. Save Service Account Keys

After running `terraform apply`, save the service account key:

```bash
# For dev
terraform output -raw service_account_key_private_key | base64 -d > ../backend/gcp-key-dev.json

# For prod (switch workspace first)
terraform workspace select prod
terraform output -raw service_account_key_private_key | base64 -d > ../backend/gcp-key-prod.json
```

The key is base64 encoded, so we decode it before saving.

## Environment Variables

Update your `.env` files:

**backend/.env.dev**
```env
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-project-id-video-pipeline-dev
GCP_KEY_FILE=./gcp-key-dev.json
```

**backend/.env.prod**
```env
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-project-id-video-pipeline-prod
GCP_KEY_FILE=./gcp-key-prod.json
```

## Destroying Resources

⚠️ **Warning**: This will delete all files in the bucket!

```bash
terraform destroy -var="project_id=your-gcp-project-id" -var="environment=dev"
```

## Workspace Management

Terraform workspaces allow you to manage dev and prod separately:

```bash
# List workspaces
terraform workspace list

# Switch workspace
terraform workspace select dev
terraform workspace select prod

# Show current workspace
terraform workspace show
```

## Outputs

After applying, you can view outputs:

```bash
terraform output
```

Key outputs:
- `bucket_name`: The storage bucket name
- `service_account_email`: Service account email
- `service_account_key_path`: Suggested path for key file

