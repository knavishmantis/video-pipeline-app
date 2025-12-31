# Production Deployment Walkthrough

Complete step-by-step guide to deploy your app to GCP with a custom domain.

## Prerequisites Checklist

- [ ] GCP account with billing enabled
- [ ] Domain name (e.g., `yourdomain.com`)
- [ ] GitHub repository
- [ ] Terraform installed (for infrastructure)
- [ ] Google Cloud SDK (`gcloud`) installed

## Step 1: Set Up GCP Project

### 1.1 Create GCP Project

```bash
# Set your project ID (must be globally unique)
export PROJECT_ID="your-project-id"  # e.g., "video-pipeline-prod-2024"
export REGION="us-central1"  # or your preferred region

# Create the project
gcloud projects create $PROJECT_ID --name="Video Pipeline Production"

# Set as active project
gcloud config set project $PROJECT_ID

# Enable billing (replace BILLING_ACCOUNT_ID with your billing account)
gcloud billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

### 1.2 Enable Required APIs

```bash
# Enable required GCP APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage-component.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com
```

## Step 2: Set Up Infrastructure with Terraform

### 2.1 Configure Terraform Backend

```bash
cd terraform

# Create state bucket
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://${PROJECT_ID}-terraform-state
gsutil versioning set on gs://${PROJECT_ID}-terraform-state

# Update backend.tf (or create it)
cat > backend.tf << EOF
terraform {
  backend "gcs" {
    bucket = "${PROJECT_ID}-terraform-state"
    prefix = "terraform/state"
  }
}
EOF
```

### 2.2 Create Production Environment

```bash
# Initialize Terraform
terraform init

# Create prod workspace
terraform workspace new prod
terraform workspace select prod

# Apply infrastructure
terraform apply \
  -var="project_id=$PROJECT_ID" \
  -var="environment=prod" \
  -var="region=$REGION"
```

### 2.3 Save Service Account Key

```bash
# Save the service account key
terraform output -raw service_account_key_private_key | base64 -d > ../backend/gcp-key-prod.json

# Get database connection info
echo "Database IP: $(terraform output -raw database_public_ip)"
echo "Database Name: $(terraform output -raw database_name)"
echo "Database User: $(terraform output -raw database_user)"
echo "Database Password: $(terraform output -raw database_password)"
```

## Step 3: Set Up Database

### 3.1 Run Migrations

```bash
cd ../backend

# Set environment variables
export DATABASE_URL="postgresql://$(terraform -chdir=../terraform output -raw database_user):$(terraform -chdir=../terraform output -raw database_password)@$(terraform -chdir=../terraform output -raw database_public_ip):5432/$(terraform -chdir=../terraform output -raw database_name)"

# Run migrations
npm run migrate
```

### 3.2 Create Admin User

```bash
# Set up admin user
npm run setup-admin quinncaverly@gmail.com
```

## Step 4: Set Up GCP Secrets Manager

### 4.1 Create Secrets

```bash
# Database connection string
echo "$DATABASE_URL" | gcloud secrets create db-connection --data-file=-

# JWT Secret (generate a secure random string)
openssl rand -base64 32 | gcloud secrets create jwt-secret --data-file=-

# GCP Service Account Key (base64 encoded)
cat gcp-key-prod.json | base64 | gcloud secrets create gcp-key --data-file=-

# Frontend URL (will update after domain setup)
echo "https://yourdomain.com" | gcloud secrets create frontend-url --data-file=-
```

### 4.2 Grant Cloud Run Access to Secrets

```bash
# Get Cloud Run service account email
export CLOUD_RUN_SA="$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

# Grant secret accessor role
gcloud secrets add-iam-policy-binding db-connection \
  --member="serviceAccount:$CLOUD_RUN_SA" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:$CLOUD_RUN_SA" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding gcp-key \
  --member="serviceAccount:$CLOUD_RUN_SA" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 5: Set Up Custom Domain

### 5.1 Get Your Domain Ready

You'll need:
- Domain registrar access (e.g., Google Domains, Namecheap, GoDaddy)
- Ability to modify DNS records

### 5.2 Deploy Backend First (Temporary)

We'll deploy backend first to get the Cloud Run URL, then set up the domain.

```bash
# Build and deploy backend manually first (or wait for GitHub Actions)
# This gives us the Cloud Run URL
```

### 5.3 Map Domain to Cloud Run

#### Option A: Using Cloud Run Domain Mapping (Recommended)

```bash
# Map API subdomain
gcloud run domain-mappings create \
  --service video-pipeline-backend \
  --domain api.yourdomain.com \
  --region $REGION

# Map frontend domain
gcloud run domain-mappings create \
  --service video-pipeline-frontend \
  --domain yourdomain.com \
  --region $REGION
```

**This will give you DNS records to add to your domain registrar.**

#### Option B: Using Cloud Load Balancer (More Complex, Better for Multiple Regions)

```bash
# Create a global load balancer
# (More complex setup, see GCP docs)
```

### 5.4 Update DNS Records

Go to your domain registrar and add the DNS records provided by Cloud Run:

**Example DNS Records:**
```
Type: CNAME
Name: api
Value: ghs.googlehosted.com

Type: CNAME  
Name: @ (or root)
Value: ghs.googlehosted.com
```

**Wait 5-30 minutes** for DNS propagation.

### 5.5 Verify Domain

```bash
# Check domain mapping status
gcloud run domain-mappings describe api.yourdomain.com --region $REGION

# Test the domain
curl https://api.yourdomain.com/health
```

## Step 6: Set Up GitHub Actions Secrets

### 6.1 Create Service Account for CI/CD

```bash
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
```

### 6.2 Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

**Required Secrets:**

| Secret Name | Value | How to Get |
|------------|-------|------------|
| `GCP_PROJECT_ID` | `your-project-id` | Your GCP project ID |
| `GCP_SA_KEY` | Contents of `github-actions-key.json` | Copy entire JSON file content |
| `GCP_REGION` | `us-central1` | Your GCP region |
| `VITE_API_URL` | `https://api.yourdomain.com/api` | Your backend API URL |

**Example:**
```bash
# Copy the key content
cat github-actions-key.json
# Copy the entire JSON output and paste into GitHub secret GCP_SA_KEY
```

### 6.3 Update GitHub Actions Workflow (if needed)

The workflow should already be set up, but verify `.github/workflows/deploy.yml` has:

```yaml
env:
  GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  GCP_REGION: ${{ secrets.GCP_REGION || 'us-central1' }}
```

## Step 7: Create Favicon

### 7.1 Generate Favicon Files

You can use online tools or create manually:

**Option A: Online Tool (Easiest)**
1. Go to https://realfavicongenerator.net/
2. Upload your logo/image
3. Download the generated files
4. Place in `frontend/public/` directory

**Option B: Manual Creation**

```bash
cd frontend/public

# Create a simple favicon.ico (if you have ImageMagick)
convert -size 32x32 xc:blue favicon.ico

# Or use an online converter to create:
# - favicon.ico (16x16, 32x32, 48x48)
# - apple-touch-icon.png (180x180)
# - android-chrome-192x192.png
# - android-chrome-512x512.png
```

### 7.2 Update HTML

Update `frontend/index.html`:

```html
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Video Pipeline</title>
</head>
```

### 7.3 Create site.webmanifest (Optional)

Create `frontend/public/site.webmanifest`:

```json
{
  "name": "Video Pipeline",
  "short_name": "Video Pipeline",
  "icons": [
    {
      "src": "/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "theme_color": "#ffffff",
  "background_color": "#ffffff",
  "display": "standalone"
}
```

## Step 8: Update Environment Configuration

### 8.1 Update Frontend API URL

In your GitHub secret `VITE_API_URL`, set it to:
```
https://api.yourdomain.com/api
```

### 8.2 Update Backend CORS

The backend will use the `FRONTEND_URL` secret. Update it:

```bash
# Update the secret
echo "https://yourdomain.com" | gcloud secrets versions add frontend-url --data-file=-
```

Or set it in Cloud Run directly:

```bash
gcloud run services update video-pipeline-backend \
  --region $REGION \
  --update-env-vars FRONTEND_URL=https://yourdomain.com
```

## Step 9: Deploy via GitHub Actions

### 9.1 Push to Main Branch

```bash
# Commit all changes
git add .
git commit -m "Production deployment setup"
git push origin main
```

### 9.2 Monitor Deployment

1. Go to GitHub → **Actions** tab
2. Watch the deployment workflow
3. Check for any errors

### 9.3 Verify Deployment

```bash
# Check backend health
curl https://api.yourdomain.com/health

# Check frontend
curl https://yourdomain.com
```

## Step 10: Post-Deployment Checklist

### 10.1 Verify Everything Works

- [ ] Backend health check: `https://api.yourdomain.com/health`
- [ ] Frontend loads: `https://yourdomain.com`
- [ ] Login works
- [ ] File uploads work
- [ ] Database connections work

### 10.2 Set Up Monitoring

```bash
# Create budget alert
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Video Pipeline Budget" \
  --budget-amount=50USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

### 10.3 Set Up Logging

Logs are automatically available in:
- **Cloud Run Logs**: GCP Console → Cloud Run → Logs
- **Application Logs**: Check `combined.log` and `error.log` files

### 10.4 Security Hardening

```bash
# Enable deletion protection on database (optional)
gcloud sql instances patch video-pipeline-shared \
  --deletion-protection \
  --project=$PROJECT_ID

# Restrict database access (update authorized networks)
gcloud sql instances patch video-pipeline-shared \
  --authorized-networks=YOUR_IP/32 \
  --project=$PROJECT_ID
```

## Troubleshooting

### Domain Not Working

```bash
# Check domain mapping status
gcloud run domain-mappings list --region $REGION

# Check DNS propagation
dig api.yourdomain.com
nslookup api.yourdomain.com
```

### Deployment Fails

```bash
# Check Cloud Run logs
gcloud run services logs read video-pipeline-backend --region $REGION --limit 50

# Check build logs in GitHub Actions
```

### Database Connection Issues

```bash
# Test connection
psql "postgresql://user:pass@IP:5432/dbname"

# Check Cloud SQL instance status
gcloud sql instances describe video-pipeline-shared
```

### Secrets Not Working

```bash
# Verify secret exists
gcloud secrets list

# Test secret access
gcloud secrets versions access latest --secret="jwt-secret"

# Check IAM permissions
gcloud projects get-iam-policy $PROJECT_ID
```

## Cost Monitoring

```bash
# View current costs
gcloud billing accounts list
gcloud billing projects describe $PROJECT_ID

# Set up cost alerts (see Step 10.2)
```

## Quick Reference

### Important URLs
- **Backend API**: `https://api.yourdomain.com`
- **Frontend**: `https://yourdomain.com`
- **Health Check**: `https://api.yourdomain.com/health`
- **GCP Console**: https://console.cloud.google.com

### Important Commands

```bash
# View Cloud Run services
gcloud run services list --region $REGION

# View logs
gcloud run services logs read SERVICE_NAME --region $REGION

# Update environment variables
gcloud run services update SERVICE_NAME \
  --region $REGION \
  --update-env-vars KEY=value

# View secrets
gcloud secrets list
gcloud secrets versions access latest --secret=SECRET_NAME
```

## Next Steps

1. ✅ Complete Steps 1-9
2. ✅ Test all functionality
3. ✅ Set up monitoring and alerts
4. ✅ Document any custom configurations
5. ✅ Train team on deployment process

---

**Need Help?** Check the logs first, then review the troubleshooting section above.

