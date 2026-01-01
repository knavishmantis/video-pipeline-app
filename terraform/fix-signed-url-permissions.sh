#!/bin/bash
# Script to fix signed URL permissions for the service account
# This grants the service account permission to sign blobs (required for generating signed URLs)

set -e

PROJECT_ID="${1:-knavishmantis}"
ENVIRONMENT="${2:-prod}"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 <project-id> [environment]"
  echo "Example: $0 knavishmantis prod"
  exit 1
fi

SERVICE_ACCOUNT_EMAIL="video-pipeline-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Granting iam.serviceAccounts.signBlob permission to ${SERVICE_ACCOUNT_EMAIL}..."

# Grant the service account permission to sign blobs on its own behalf
gcloud iam service-accounts add-iam-policy-binding \
  "${SERVICE_ACCOUNT_EMAIL}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project="${PROJECT_ID}"

echo "✅ Permission granted successfully!"
echo ""
echo "The service account can now generate signed URLs for GCS files."
echo "You may need to wait a few minutes for the permission to propagate."

