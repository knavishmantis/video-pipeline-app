# Remote state backend configuration
# IMPORTANT: Replace the bucket name with your actual state bucket name
# 
# To set up:
# 1. Create a GCS bucket for state manually:
#    gsutil mb -p <project-id> -c STANDARD -l us-central1 gs://<bucket-name>
#    gsutil versioning set on gs://<bucket-name>
# 2. Update the bucket name below
# 3. Run: terraform init

terraform {
  backend "gcs" {
    bucket = "video-pipeline-app-state"
    prefix = "terraform/state"
  }
}

