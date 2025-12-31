# Cloud Run Cost Estimate

## Current Configuration

### Backend Service
- **Memory:** 512 MiB (0.5 GiB)
- **CPU:** 1 vCPU
- **Min Instances:** 0 (scales to zero)
- **Max Instances:** 10
- **Timeout:** 300 seconds

### Frontend Service
- **Memory:** 128 MiB (0.125 GiB)
- **CPU:** 1 vCPU
- **Min Instances:** 0 (scales to zero)
- **Max Instances:** 5
- **Timeout:** 60 seconds

## Cloud Run Pricing (us-central1)

- **CPU:** $0.000024 per vCPU-second
- **Memory:** $0.00000250 per GiB-second
- **Requests:** $0.40 per million requests
- **Network Egress:** $0.12 per GB (first 10 TB)

## Free Tier (per month, per region)

- **CPU:** 180,000 vCPU-seconds
- **Memory:** 360,000 GiB-seconds
- **Requests:** 2 million requests

## Cost Scenarios

### Scenario 1: Low Traffic (Personal/Small Team)
**Assumptions:**
- 10,000 requests/month to backend
- 50,000 requests/month to frontend (static files)
- Average request duration: 500ms
- Average response size: 5 KB

**Backend:**
- CPU: 10,000 × 0.5s × 1 vCPU = 5,000 vCPU-seconds (FREE - within 180k limit)
- Memory: 10,000 × 0.5s × 0.5 GiB = 2,500 GiB-seconds (FREE - within 360k limit)
- Requests: 10,000 (FREE - within 2M limit)
- Network: 10,000 × 5 KB = 50 MB (FREE - first 1 GB/month free)

**Frontend:**
- CPU: 50,000 × 0.1s × 1 vCPU = 5,000 vCPU-seconds (FREE)
- Memory: 50,000 × 0.1s × 0.125 GiB = 625 GiB-seconds (FREE)
- Requests: 50,000 (FREE)
- Network: 50,000 × 5 KB = 250 MB (FREE)

**Total: $0/month** ✅

### Scenario 2: Moderate Traffic (Small Business)
**Assumptions:**
- 100,000 requests/month to backend
- 500,000 requests/month to frontend
- Average request duration: 500ms
- Average response size: 10 KB

**Backend:**
- CPU: 100,000 × 0.5s × 1 vCPU = 50,000 vCPU-seconds (FREE)
- Memory: 100,000 × 0.5s × 0.5 GiB = 25,000 GiB-seconds (FREE)
- Requests: 100,000 (FREE)
- Network: 100,000 × 10 KB = 1 GB (FREE - first 1 GB/month free)

**Frontend:**
- CPU: 500,000 × 0.1s × 1 vCPU = 50,000 vCPU-seconds (FREE)
- Memory: 500,000 × 0.1s × 0.125 GiB = 6,250 GiB-seconds (FREE)
- Requests: 500,000 (FREE)
- Network: 500,000 × 10 KB = 5 GB
  - First 1 GB: FREE
  - Remaining 4 GB: 4 × $0.12 = **$0.48**

**Total: ~$0.50/month** ✅

### Scenario 3: High Traffic (Growing Business)
**Assumptions:**
- 1,000,000 requests/month to backend
- 5,000,000 requests/month to frontend
- Average request duration: 500ms
- Average response size: 15 KB

**Backend:**
- CPU: 1,000,000 × 0.5s × 1 vCPU = 500,000 vCPU-seconds
  - Free tier: 180,000
  - Billable: 320,000 × $0.000024 = **$7.68**
- Memory: 1,000,000 × 0.5s × 0.5 GiB = 250,000 GiB-seconds (FREE)
- Requests: 1,000,000 (FREE)
- Network: 1,000,000 × 15 KB = 15 GB
  - First 1 GB: FREE
  - Remaining 14 GB: 14 × $0.12 = **$1.68**

**Frontend:**
- CPU: 5,000,000 × 0.1s × 1 vCPU = 500,000 vCPU-seconds
  - Free tier: 180,000
  - Billable: 320,000 × $0.000024 = **$7.68**
- Memory: 5,000,000 × 0.1s × 0.125 GiB = 62,500 GiB-seconds (FREE)
- Requests: 5,000,000
  - Free tier: 2,000,000
  - Billable: 3,000,000 × ($0.40 / 1,000,000) = **$1.20**
- Network: 5,000,000 × 15 KB = 75 GB
  - First 1 GB: FREE
  - Remaining 74 GB: 74 × $0.12 = **$8.88**

**Total: ~$27.12/month**

### Scenario 4: Very High Traffic (Popular App)
**Assumptions:**
- 10,000,000 requests/month to backend
- 50,000,000 requests/month to frontend
- Average request duration: 500ms
- Average response size: 20 KB

**Backend:**
- CPU: 10,000,000 × 0.5s × 1 vCPU = 5,000,000 vCPU-seconds
  - Free tier: 180,000
  - Billable: 4,820,000 × $0.000024 = **$115.68**
- Memory: 10,000,000 × 0.5s × 0.5 GiB = 2,500,000 GiB-seconds
  - Free tier: 360,000
  - Billable: 2,140,000 × $0.00000250 = **$5.35**
- Requests: 10,000,000
  - Free tier: 2,000,000
  - Billable: 8,000,000 × ($0.40 / 1,000,000) = **$3.20**
- Network: 10,000,000 × 20 KB = 200 GB
  - First 1 GB: FREE
  - Remaining 199 GB: 199 × $0.12 = **$23.88**

**Frontend:**
- CPU: 50,000,000 × 0.1s × 1 vCPU = 5,000,000 vCPU-seconds
  - Free tier: 180,000
  - Billable: 4,820,000 × $0.000024 = **$115.68**
- Memory: 50,000,000 × 0.1s × 0.125 GiB = 625,000 GiB-seconds
  - Free tier: 360,000
  - Billable: 265,000 × $0.00000250 = **$0.66**
- Requests: 50,000,000
  - Free tier: 2,000,000
  - Billable: 48,000,000 × ($0.40 / 1,000,000) = **$19.20**
- Network: 50,000,000 × 20 KB = 1,000 GB (1 TB)
  - First 1 GB: FREE
  - Remaining 999 GB: 999 × $0.12 = **$119.88**

**Total: ~$303.93/month**

## Cost Optimization Tips

1. **Reduce Memory Allocation:**
   - Backend: 512 MiB is reasonable, but could try 256 MiB if CPU-bound
   - Frontend: 128 MiB is already minimal for nginx

2. **Optimize Response Times:**
   - Faster responses = less CPU/memory time = lower costs
   - Use caching where possible
   - Optimize database queries

3. **Reduce Response Sizes:**
   - Compress responses (gzip)
   - Minimize JSON payloads
   - Use CDN for static assets (reduces Cloud Run egress)

4. **Consider Min Instances:**
   - Currently set to 0 (scales to zero)
   - Setting min-instances > 0 eliminates cold starts but costs more
   - Only set if you need guaranteed availability

5. **Use Cloud CDN:**
   - Frontend static files served via CDN = less Cloud Run egress
   - CDN costs ~$0.08/GB (cheaper than Cloud Run egress)

## Realistic Estimate for Your App

Based on a video pipeline app with moderate usage:

**Expected Monthly Cost: $5-15/month**

This assumes:
- 50,000-200,000 requests/month
- Mix of API calls and file uploads
- Some video file downloads
- Most traffic within free tier limits

## Additional Costs to Consider

- **Cloud SQL:** ~$7-10/month (db-f1-micro, shared instance)
- **Cloud Storage:** ~$0.02/GB/month (for video files)
- **Artifact Registry:** FREE (first 500 MB storage, 1 GB egress/month)
- **Total Infrastructure:** ~$12-25/month for low-moderate traffic

## Summary

✅ **Very affordable for small to medium traffic**
✅ **Free tier covers most personal/small business use cases**
✅ **Scales automatically - pay only for what you use**
✅ **No upfront costs or commitments**

For most use cases, you'll stay well under $20/month total (including database and storage).

