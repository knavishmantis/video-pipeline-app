#!/bin/bash
# Bootstrap script to create the GCS bucket for Terraform state
# Run this once before initializing Terraform with remote state

set -e

PROJECT_ID="${1:-}"
BUCKET_NAME="${2:-}"

if [ -z "$PROJECT_ID" ] || [ -z "$BUCKET_NAME" ]; then
  echo "Usage: ./bootstrap-state.sh <project-id> <state-bucket-name>"
  echo ""
  echo "Example:"
  echo "  ./bootstrap-state.sh my-gcp-project my-project-terraform-state"
  exit 1
fi

echo "Creating GCS bucket for Terraform state: $BUCKET_NAME"
echo "Project: $PROJECT_ID"
echo ""

# Create the bucket
gsutil mb -p "$PROJECT_ID" -c STANDARD -l us-central1 "gs://$BUCKET_NAME" || {
  echo "Bucket might already exist, continuing..."
}

# Enable versioning (recommended for state files)
echo "Enabling versioning on state bucket..."
gsutil versioning set on "gs://$BUCKET_NAME"

# Enable object versioning for safety
echo "State bucket created successfully!"
echo ""
echo "Next steps:"
echo "1. Update terraform/backend.tf with the bucket name: $BUCKET_NAME"
echo "2. Run: cd terraform && terraform init"
echo "3. Migrate existing state (if any): terraform init -migrate-state"

