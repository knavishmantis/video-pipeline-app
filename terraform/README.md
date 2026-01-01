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

## Remote State Setup

This configuration uses **remote state** stored in a GCS bucket. This allows:
- State sharing across team members
- State locking to prevent concurrent modifications
- State versioning and history
- Better security than local state files

### Initial Setup (One-time)

1. **Create the state bucket** (run once):
   ```bash
   gsutil mb -p your-gcp-project-id -c STANDARD -l us-central1 gs://your-project-terraform-state
   gsutil versioning set on gs://your-project-terraform-state
   ```

2. **Configure the backend** in `backend.tf`:
   ```hcl
   terraform {
     backend "gcs" {
       bucket = "your-project-terraform-state"
       prefix = "terraform/state"
     }
   }
   ```

3. **Initialize Terraform** with remote state:
   ```bash
   terraform init
   ```
   
   If you have existing local state, Terraform will ask if you want to migrate it:
   ```bash
   terraform init -migrate-state
   ```

### State Organization

The remote state uses a prefix pattern to organize state files:
- Dev state: `terraform/state/default.tfstate` (or use workspaces)
- Prod state: Use Terraform workspaces (see below)

### Using Workspaces with Remote State

Workspaces allow separate state files for dev/prod:

## Setup

### 1. Initialize Terraform (with Remote State)

After configuring `backend.tf`:

```bash
cd terraform
terraform init
```

If migrating from local state:
```bash
terraform init -migrate-state
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
- Store state in: `gs://your-state-bucket/terraform/state/dev/default.tfstate`

### 3. Create Prod Environment

```bash
terraform workspace new prod
terraform workspace select prod

terraform apply -var="project_id=your-gcp-project-id" -var="environment=prod"
```

State will be stored in: `gs://your-state-bucket/terraform/state/prod/default.tfstate`

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

Terraform workspaces allow you to manage dev and prod separately with separate state files:

```bash
# List workspaces
terraform workspace list

# Switch workspace
terraform workspace select dev
terraform workspace select prod

# Show current workspace
terraform workspace show

# Create new workspace
terraform workspace new <name>
```

Each workspace maintains its own state file in the remote GCS bucket:
- Dev: `terraform/state/dev/default.tfstate`
- Prod: `terraform/state/prod/default.tfstate`

## State Management

### Viewing State

State is stored remotely in GCS. To view:
```bash
terraform state list
terraform state show <resource>
```

### State Locking

Terraform automatically locks state during operations when using GCS backend. If a lock is stuck:
```bash
# View lock info
terraform force-unlock <lock-id>
```

### Backing Up State

State is automatically versioned in GCS (if versioning is enabled). You can also:
```bash
# Pull state locally for backup
terraform state pull > state-backup.json
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

