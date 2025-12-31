# Quick Deployment Checklist

Use this as a quick reference while deploying. See detailed guides for each step.

## Pre-Deployment

- [ ] GCP project created and billing enabled
- [ ] Required APIs enabled
- [ ] Terraform infrastructure deployed
- [ ] Database migrations run
- [ ] Admin user created

## Domain Setup

- [ ] Domain purchased/ready
- [ ] Backend deployed (to get Cloud Run URL)
- [ ] Domain mapped to Cloud Run services
- [ ] DNS records added to registrar
- [ ] DNS propagation verified (5-30 min wait)

## GitHub Secrets

- [ ] `GCP_PROJECT_ID` - Your GCP project ID
- [ ] `GCP_SA_KEY` - Full JSON from service account key
- [ ] `GCP_REGION` - Your region (e.g., `us-central1`)
- [ ] `VITE_API_URL` - Backend API URL (e.g., `https://api.yourdomain.com/api`)

## GCP Secrets Manager

- [ ] `db-connection` - Database connection string
- [ ] `jwt-secret` - Secure JWT secret (32+ chars)
- [ ] `gcp-key` - Base64 encoded service account key
- [ ] `frontend-url` - Frontend URL (e.g., `https://yourdomain.com`)

## Favicon

- [ ] Favicon files created (or placeholder)
- [ ] Files placed in `frontend/public/`
- [ ] `index.html` updated (already done)

## First Deployment

- [ ] Push to main/master branch
- [ ] Monitor GitHub Actions workflow
- [ ] Check for errors in workflow logs
- [ ] Verify backend health: `https://api.yourdomain.com/health`
- [ ] Verify frontend loads: `https://yourdomain.com`

## Post-Deployment

- [ ] Test login
- [ ] Test file uploads
- [ ] Test all major features
- [ ] Set up budget alerts
- [ ] Monitor logs
- [ ] Document any issues

## Quick Commands Reference

```bash
# Get backend URL
gcloud run services describe video-pipeline-backend \
  --region us-central1 \
  --format='value(status.url)'

# Check domain mapping
gcloud run domain-mappings list --region us-central1

# View logs
gcloud run services logs read video-pipeline-backend --region us-central1

# Update environment variable
gcloud run services update video-pipeline-backend \
  --region us-central1 \
  --update-env-vars KEY=value
```

## Troubleshooting

- **Domain not working**: Check DNS propagation, verify domain mapping
- **Deployment fails**: Check GitHub Actions logs, verify secrets
- **Database connection**: Check Cloud SQL instance, verify connection string
- **CORS errors**: Verify FRONTEND_URL matches actual frontend URL

## Detailed Guides

- **Full walkthrough**: `docs/PRODUCTION_DEPLOYMENT_WALKTHROUGH.md`
- **GitHub secrets**: `docs/GITHUB_SECRETS_SETUP.md`
- **Favicon setup**: `docs/FAVICON_SETUP.md`
- **Cost optimization**: `docs/GCP_COST_OPTIMIZATION.md`

