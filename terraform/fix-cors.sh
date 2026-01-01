#!/bin/bash
# Script to fix CORS configuration for the GCS bucket
# This allows downloads from the frontend domain

set -e

PROJECT_ID="${1:-knavishmantis}"
ENVIRONMENT="${2:-prod}"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 <project-id> [environment]"
  echo "Example: $0 knavishmantis prod"
  exit 1
fi

BUCKET_NAME="${PROJECT_ID}-video-pipeline-${ENVIRONMENT}"

echo "Updating CORS configuration for bucket: ${BUCKET_NAME}..."

# Create a temporary CORS config file
cat > /tmp/cors-config.json <<EOF
[
  {
    "origin": ["https://knavishproductions.com", "https://www.knavishproductions.com"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["*"],
    "maxAgeSeconds": 3600
  }
]
EOF

# Apply CORS configuration
gsutil cors set /tmp/cors-config.json gs://${BUCKET_NAME}

# Clean up
rm /tmp/cors-config.json

echo "✅ CORS configuration updated successfully!"
echo ""
echo "The bucket now allows downloads from:"
echo "  - https://knavishproductions.com"
echo "  - https://www.knavishproductions.com"

