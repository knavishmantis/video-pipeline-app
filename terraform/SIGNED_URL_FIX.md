# Fix for Signed URL Permission Error

## Problem

When generating signed URLs for GCS files, you may see this error:

```
Permission 'iam.serviceAccounts.signBlob' denied on resource (or it may not exist).
```

This happens because the Cloud Run service account doesn't have permission to sign blobs on its own behalf.

## Solution

Grant the service account the `roles/iam.serviceAccountTokenCreator` role, which includes the `iam.serviceAccounts.signBlob` permission.

## Quick Fix (Immediate)

Run the provided script:

```bash
cd terraform
./fix-signed-url-permissions.sh knavishmantis prod
```

Or manually with gcloud:

```bash
PROJECT_ID="knavishmantis"
ENVIRONMENT="prod"  # or "dev"
SERVICE_ACCOUNT="video-pipeline-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts add-iam-policy-binding \
  "${SERVICE_ACCOUNT}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project="${PROJECT_ID}"
```

## Long-term Fix (Terraform)

The terraform configuration has been updated to include this permission. However, **a service account cannot grant itself this permission** - it must be granted by a user with admin permissions.

To apply via Terraform:

1. Ensure you have `roles/iam.serviceAccountAdmin` or `roles/owner` on the project
2. Run `terraform apply` - the new IAM binding will be created

If Terraform fails with permission errors, use the manual gcloud command above instead.

## Verification

After applying the fix, test by:

1. Uploading a file through the app
2. Checking that download URLs are generated successfully
3. Verifying no more "Permission denied" errors in logs

## Notes

- This permission is required for generating signed URLs when using Application Default Credentials
- The permission may take a few minutes to propagate after being granted
- This is a one-time setup per environment (dev/prod)

