# GCP Cost Estimate

## Current Configuration

### Shared Database Setup
- **Cloud SQL Instance**: ONE shared `db-f1-micro` instance (PostgreSQL 15) - **FREE**
  - Contains two separate databases: `video_pipeline_dev` and `video_pipeline_prod`
  - Only one free instance per billing account, so we share it
- **Storage**: 10GB disk (enough for metadata; videos stored in Cloud Storage)

### Dev Environment
- **Database**: `video_pipeline_dev` (in shared instance)
- **Storage Bucket**: Standard storage for video files
- **Service Account**: Free

### Prod Environment (when created)
- **Database**: `video_pipeline_prod` (in shared instance)
- **Storage Bucket**: Standard storage for video files
- **Service Account**: Free
- **Backend Hosting**: Cloud Run (~$0-10/month)
- **Frontend Hosting**: Vercel/Cloudflare Pages (FREE)

## Cost Breakdown

### Cloud SQL Costs

#### Dev Environment (`db-f1-micro`)
- **Cost**: **$0/month** (FREE)
  - Covered by GCP's Always Free tier
  - Shared-core instance (0.6GB RAM)
  - 10GB SSD storage included
  - Suitable for development/testing

#### Prod Environment (`db-f1-micro` or `db-g1-small`)
- **Option 1 (db-f1-micro)**: **$0/month** (FREE)
  - Same as dev, shared-core
  - 10GB SSD storage included
  - Suitable for low-medium traffic
- **Option 2 (db-g1-small)**: ~$25/month (if you need more power)
  - 1 vCPU, 1.7GB RAM
  - 10GB SSD storage included
- **Backups**: Included (first 50GB free)
- **Total**: **$0-25/month** (vs $70-90 with previous config)

### Cloud Storage Costs

#### Storage (Standard Class)
- **First 5GB**: FREE (Always Free tier)
- **5GB - 1TB**: $0.020 per GB/month
- **1TB - 10TB**: $0.019 per GB/month

**Example estimates:**
- **Dev** (light usage, ~50GB): ~$1/month
- **Prod** (moderate usage, ~500GB): ~$10/month
- **Prod** (heavy usage, ~2TB): ~$38/month

#### Operations
- **Class A** (writes, list): $0.05 per 10,000 operations
- **Class B** (reads): $0.004 per 10,000 operations
- **Free tier**: 5,000 Class A + 50,000 Class B per month

**Typical usage**: ~$1-5/month for operations

### Network Egress
- **First 1GB/month**: FREE
- **1GB - 10TB**: $0.12 per GB
- **10TB+**: $0.08 per GB

**Typical usage**: ~$5-20/month (depends on video downloads)

## Monthly Cost Estimates

### Dev Environment
- Cloud SQL: **$0** (free tier)
- Storage (50GB): **$1**
- Operations: **$0-1**
- Network: **$0-2**
- **Total**: **~$2-4/month**

### Prod Environment
- Cloud SQL: **$0-25** (db-f1-micro free, or db-g1-small if needed)
- Storage (10GB metadata + videos): **$1-10**
- Operations: **$0-2**
- Network: **$0-5**
- Backend (Cloud Run): **$0-10**
- Frontend (Vercel): **$0** (free)
- **Total**: **~$1-52/month**

### Both Environments Combined
- **Total**: **~$2-56/month**

## Cost Optimization Tips

1. **Use Cloud SQL Free Tier for Dev**
   - ✅ Already configured (`db-f1-micro`)
   - Saves ~$50-70/month

2. **Storage Lifecycle Rules**
   - ✅ Already configured (delete after 365 days)
   - Reduces long-term storage costs

3. **Consider Cloud SQL Proxy**
   - Reduces network egress costs
   - More secure than public IP

4. **Storage Class Optimization**
   - Use Nearline/Coldline for old videos
   - Can reduce storage costs by 50-70%

5. **Monitor Usage**
   - Set up billing alerts
   - Review monthly usage reports

## GCP Free Tier Benefits

You get these **every month for free**:
- 5GB Cloud Storage
- 5,000 Class A operations
- 50,000 Class B operations
- 1GB network egress
- Cloud SQL `db-f1-micro` instance

## Important Notes

1. **"Enterprise" Confusion**: `db-f1-micro` is the **free/shared-core** tier, not enterprise. Enterprise features are optional add-ons.

2. **Billing**: GCP charges are pay-as-you-go. You only pay for what you use.

3. **Free Credits**: New GCP accounts get $300 free credits for 90 days.

4. **Cost Monitoring**: Set up billing alerts in GCP Console to avoid surprises.

## Estimated Annual Costs

- **Dev only**: ~$12-25/year
- **Dev + Prod**: ~$24-672/year (much lower with optimized config!)
- **With Cloud Run + Vercel**: ~$24-300/year

## Next Steps

1. Monitor actual usage after first month
2. Set billing alerts at $50, $100, $200 thresholds
3. Review and optimize based on actual usage patterns
4. Consider reserved instances for prod (can save 20-30%)

