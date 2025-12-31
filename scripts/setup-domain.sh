#!/bin/bash
# Domain mapping script for knavishproductions.com

set -e

DOMAIN="knavishproductions.com"
REGION="us-central1"
PROJECT_ID="knavishmantis"

echo "Setting up domain mappings for $DOMAIN..."
echo ""

# Map backend to api subdomain
echo "1. Mapping backend to api.$DOMAIN..."
gcloud run domain-mappings create \
  --service video-pipeline-backend \
  --domain api.$DOMAIN \
  --region $REGION \
  --project $PROJECT_ID

echo ""
echo "2. Mapping frontend to $DOMAIN..."
gcloud run domain-mappings create \
  --service video-pipeline-frontend \
  --domain $DOMAIN \
  --region $REGION \
  --project $PROJECT_ID

echo ""
echo "3. Getting DNS records..."
echo ""
echo "=== DNS Records to Add to Your Registrar ==="
echo ""

# Get the DNS records
gcloud run domain-mappings describe api.$DOMAIN --region $REGION --project $PROJECT_ID --format="value(status.resourceRecords)"

echo ""
echo "=== Next Steps ==="
echo "1. Add the DNS records above to your domain registrar"
echo "2. Wait 5-30 minutes for DNS propagation"
echo "3. Verify with: curl https://api.$DOMAIN/health"
echo "4. Verify with: curl https://$DOMAIN"
echo ""

