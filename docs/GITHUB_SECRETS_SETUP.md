# GitHub Actions Secrets Setup Guide

## Step-by-Step Instructions

### Step 1: Create GCP Service Account for CI/CD

Run these commands in your terminal (replace `YOUR_PROJECT_ID` with your actual GCP project ID):

```bash
export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="us-central1"  # or your preferred region

# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD" \
  --project=$PROJECT_ID

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com \
  --project=$PROJECT_ID

# Display the key (you'll copy this)
cat github-actions-key.json
```

**⚠️ Important**: Keep this key file secure! Don't commit it to git.

### Step 2: Add Secrets to GitHub

1. **Go to your GitHub repository**
2. Click **Settings** (top right of repo)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret** for each secret below

### Step 3: Required Secrets

Add these secrets one by one:

#### 1. `GCP_PROJECT_ID`
- **Name**: `GCP_PROJECT_ID`
- **Value**: Your GCP project ID (e.g., `video-pipeline-prod-2024`)
- **How to get**: From Step 1, or run `gcloud config get-value project`

#### 2. `GCP_SA_KEY`
- **Name**: `GCP_SA_KEY`
- **Value**: The **entire contents** of `github-actions-key.json`
  - Open the file you created in Step 1
  - Copy **everything** (including `{` and `}`)
  - It should look like:
    ```json
    {
      "type": "service_account",
      "project_id": "...",
      "private_key_id": "...",
      "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      ...
    }
    ```
- **Important**: Copy the entire JSON, including all newlines

#### 3. `GCP_REGION`
- **Name**: `GCP_REGION`
- **Value**: Your GCP region (e.g., `us-central1`)
- **Default**: `us-central1` if not set

#### 4. `VITE_API_URL`
- **Name**: `VITE_API_URL`
- **Value**: Your backend API URL
  - **Before domain setup**: `https://video-pipeline-backend-xxxxx.run.app/api`
  - **After domain setup**: `https://api.yourdomain.com/api`
- **How to get backend URL**:
  ```bash
  # Get the Cloud Run service URL
  gcloud run services describe video-pipeline-backend \
    --region us-central1 \
    --format='value(status.url)'
  ```
  Then append `/api` to the URL

### Step 4: Verify Secrets

After adding all secrets, verify they're set:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see all 4 secrets listed
3. **⚠️ Note**: You can't view the values after saving (for security)

### Step 5: Test the Workflow

1. **Push to main branch**:
   ```bash
   git add .
   git commit -m "Test deployment"
   git push origin main
   ```

2. **Check GitHub Actions**:
   - Go to your repo → **Actions** tab
   - Click on the running workflow
   - Watch for any errors

3. **Common Issues**:
   - **"Permission denied"**: Check service account permissions
   - **"Secret not found"**: Verify secret names match exactly
   - **"Invalid JSON"**: Check `GCP_SA_KEY` is complete JSON

## Secret Reference Table

| Secret Name | Required | Example Value | Notes |
|------------|----------|---------------|-------|
| `GCP_PROJECT_ID` | ✅ Yes | `video-pipeline-prod-2024` | Your GCP project ID |
| `GCP_SA_KEY` | ✅ Yes | `{ "type": "service_account", ... }` | Full JSON from service account key |
| `GCP_REGION` | ⚠️ Optional | `us-central1` | Defaults to `us-central1` if not set |
| `VITE_API_URL` | ✅ Yes | `https://api.yourdomain.com/api` | Backend API URL with `/api` suffix |

## Security Best Practices

1. **Never commit secrets** to git
2. **Rotate keys periodically** (every 90 days recommended)
3. **Use least privilege** - only grant necessary permissions
4. **Monitor usage** - check GCP audit logs regularly
5. **Delete unused keys** - remove old service account keys

## Updating Secrets

### Update a Secret Value

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click the secret name
3. Click **Update**
4. Paste new value
5. Click **Update secret**

### Rotate Service Account Key

```bash
# Create new key
gcloud iam service-accounts keys create github-actions-key-new.json \
  --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com

# Update GitHub secret with new key
# (Copy contents and update GCP_SA_KEY secret in GitHub)

# Delete old key (after verifying new one works)
gcloud iam service-accounts keys list \
  --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com
# Then delete the old key ID
```

## Troubleshooting

### "Authentication failed"
- Check `GCP_SA_KEY` is complete JSON
- Verify service account has correct permissions
- Check project ID matches

### "Permission denied"
- Verify service account has `roles/run.admin`
- Check service account email is correct
- Ensure IAM bindings are applied

### "Secret not found"
- Check secret name matches exactly (case-sensitive)
- Verify you're looking at the right repository
- Check you're in **Actions** secrets, not **Dependabot** secrets

### "Invalid region"
- Verify `GCP_REGION` matches your Cloud Run region
- Check region is valid: `gcloud run regions list`

## Quick Checklist

- [ ] Service account created
- [ ] Permissions granted
- [ ] Key file downloaded
- [ ] `GCP_PROJECT_ID` secret added
- [ ] `GCP_SA_KEY` secret added (full JSON)
- [ ] `GCP_REGION` secret added (optional)
- [ ] `VITE_API_URL` secret added
- [ ] Tested workflow run
- [ ] Deployment successful

## Next Steps

After secrets are set up:
1. ✅ Push to main branch to trigger deployment
2. ✅ Monitor GitHub Actions workflow
3. ✅ Verify deployment in GCP Console
4. ✅ Test the deployed application

