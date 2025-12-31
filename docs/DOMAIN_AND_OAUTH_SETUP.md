# Domain & Google OAuth Setup Guide

Quick guide to set up your custom domain and Google OAuth for production.

## Part 1: Domain Setup

### Step 1: Get Your Cloud Run URLs

After deployment, you'll have:
- **Backend**: `https://video-pipeline-backend-292092121064.us-central1.run.app`
- **Frontend**: `https://video-pipeline-frontend-292092121064.us-central1.run.app`

### Step 2: Map Domain to Cloud Run

```bash
# Set your domain
export DOMAIN="knavishproductions.com"  # Your domain
export REGION="us-central1"
export PROJECT_ID="knavishmantis"

# Map backend (api subdomain)
gcloud run domain-mappings create \
  --service video-pipeline-backend \
  --domain api.$DOMAIN \
  --region $REGION \
  --project $PROJECT_ID

# Map frontend (root domain)
gcloud run domain-mappings create \
  --service video-pipeline-frontend \
  --domain $DOMAIN \
  --region $REGION \
  --project $PROJECT_ID
```

### Step 3: Get DNS Records

After running the commands above, you'll get DNS records like:

```
Type: CNAME
Name: api
Value: ghs.googlehosted.com

Type: CNAME
Name: @ (or root)
Value: ghs.googlehosted.com
```

**Or you might get A records** - use whatever Cloud Run provides.

### Step 4: Add DNS Records to Your Registrar

1. Go to your domain registrar (where you bought `knavishproductions.com`)
2. Find DNS settings / DNS management
3. Add the CNAME/A records provided by Cloud Run
4. **Wait 5-30 minutes** for DNS propagation

### Step 5: Verify Domain

```bash
# Check domain mapping status
gcloud run domain-mappings list --region $REGION

# Test (after DNS propagates)
curl https://api.$DOMAIN/health
curl https://$DOMAIN
```

## Part 2: Google OAuth Setup

### Step 1: Create New OAuth 2.0 Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
4. If prompted, configure OAuth consent screen first:
   - **User Type**: External (unless you have Google Workspace)
   - **App name**: Video Pipeline
   - **User support email**: Your email
   - **Developer contact**: Your email
   - **Scopes**: Add `email`, `profile`, `openid`
   - **Test users**: Add your email (for testing)

5. Create OAuth Client ID:
   - **Application type**: Web application
   - **Name**: Video Pipeline Production
   - **Authorized JavaScript origins**:
     ```
     https://knavishproductions.com
     https://www.knavishproductions.com
     ```
   - **Authorized redirect URIs**:
     ```
     https://knavishproductions.com
     https://www.knavishproductions.com
     https://api.knavishproductions.com/api/auth/google/callback
     ```

### Step 2: Get Client ID

After creating, you'll get:
- **Client ID**: `123456789-abc...xyz.apps.googleusercontent.com`
- **Client Secret**: `GOCSPX-...` (save this, but you won't need it for frontend)

### Step 3: Update GitHub Secrets

1. Go to GitHub → Your repo → **Settings** → **Secrets and variables** → **Actions**
2. Add/Update these secrets:

| Secret Name | Value | Example |
|------------|-------|---------|
| `VITE_GOOGLE_CLIENT_ID` | Your OAuth Client ID | `123456789-abc...xyz.apps.googleusercontent.com` |
| `VITE_API_URL` | Your backend API URL | `https://api.knavishproductions.com/api` |
| `FRONTEND_URL` | Your frontend URL | `https://knavishproductions.com` |

### Step 4: Update Backend Environment

The backend needs the Google Client ID too. Update Cloud Run:

```bash
gcloud run services update video-pipeline-backend \
  --region $REGION \
  --update-env-vars GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
  --project $PROJECT_ID
```

Or add it to GitHub Secrets as `GOOGLE_CLIENT_ID` and update the workflow to pass it.

### Step 5: Update Workflow (if needed)

If `GOOGLE_CLIENT_ID` isn't being passed to Cloud Run, update `.github/workflows/deploy.yml`:

```yaml
--set-env-vars NODE_ENV=production,...,GOOGLE_CLIENT_ID=${{ secrets.GOOGLE_CLIENT_ID }} \
```

## Part 3: Update Existing Secrets

After domain is set up, update these GitHub secrets:

1. **`VITE_API_URL`**: `https://api.knavishproductions.com/api`
2. **`FRONTEND_URL`**: `https://knavishproductions.com`
3. **`VITE_GOOGLE_CLIENT_ID`**: Your new OAuth Client ID

## Part 4: Testing

### Test Domain

```bash
# Backend health check
curl https://api.knavishproductions.com/health

# Frontend
curl https://knavishproductions.com
```

### Test OAuth

1. Visit `https://knavishproductions.com`
2. Click "Sign in with Google"
3. Should redirect to Google login
4. After login, should redirect back to your app

## Troubleshooting

### Domain Not Working

```bash
# Check DNS propagation
dig api.knavishproductions.com
nslookup api.knavishproductions.com

# Check domain mapping
gcloud run domain-mappings describe api.knavishproductions.com --region $REGION
```

### OAuth Not Working

1. **Check redirect URI matches exactly** (including trailing slashes)
2. **Verify Client ID is correct** in both frontend and backend
3. **Check browser console** for OAuth errors
4. **Verify domain is authorized** in Google Console

### Common Issues

- **"redirect_uri_mismatch"**: Check authorized redirect URIs in Google Console
- **"invalid_client"**: Client ID is wrong or not set
- **CORS errors**: Make sure `FRONTEND_URL` matches your actual domain

## Quick Checklist

- [ ] Domain purchased (`knavishproductions.com`)
- [ ] Cloud Run services deployed
- [ ] Domain mappings created
- [ ] DNS records added to registrar
- [ ] DNS propagated (wait 5-30 min)
- [ ] OAuth Client ID created
- [ ] OAuth authorized domains/redirects configured
- [ ] GitHub secrets updated
- [ ] Backend environment variables updated
- [ ] Test login works

## Notes

- **DNS propagation** can take 5-30 minutes (sometimes up to 48 hours)
- **OAuth changes** can take a few minutes to propagate
- **Test in incognito** to avoid cached credentials
- **Keep old OAuth Client ID** for dev environment if needed

