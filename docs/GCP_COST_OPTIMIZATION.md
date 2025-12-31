# GCP Cost Optimization Guide

## Current Setup Cost Analysis

### Monthly Cost Breakdown (Low Traffic Scenario)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **Cloud SQL** | db-f1-micro (shared) | **$0** (FREE tier) |
| **Cloud Storage** | 100GB | ~$2.00 |
| **Cloud Run (Backend)** | 0-10 instances, 512MB | $0-3 (within free tier) |
| **Cloud Run (Frontend)** | 0-5 instances, 128MB | $0-2 (within free tier) |
| **Network Egress** | <10GB/month | ~$1.00 |
| **Total** | | **$0-8/month** |

### Monthly Cost Breakdown (Medium Traffic Scenario)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **Cloud SQL** | db-f1-micro (shared) | **$0** (FREE tier) |
| **Cloud Storage** | 500GB | ~$10.00 |
| **Cloud Run (Backend)** | 1-20 instances, 512MB | ~$10-20 |
| **Cloud Run (Frontend)** | 1-10 instances, 128MB | ~$5-10 |
| **Network Egress** | 50GB/month | ~$5.00 |
| **Total** | | **$30-45/month** |

## Free Tier Limits

### Cloud Run Free Tier (Per Month)
- **2 million requests**
- **360,000 GB-seconds** (memory × time)
- **180,000 vCPU-seconds**

**Example**: 
- 100,000 requests/month
- Average 512MB memory
- Average 1 second execution
- = 100,000 × 0.5GB × 1s = 50,000 GB-seconds ✅ (within free tier)

### Cloud SQL Free Tier
- **1 db-f1-micro instance** per billing account
- **Shared instance** for dev/prod ✅ (already optimized)

### Cloud Storage
- **No free tier**, but very cheap:
  - Storage: $0.020/GB/month
  - Operations: $0.05 per 10,000 operations

## Cost Optimization Strategies

### 1. Cloud Run Optimization

#### Current Settings (Recommended)
```yaml
--memory 512Mi        # Backend: enough for Node.js
--memory 128Mi        # Frontend: minimal for static files
--cpu 1               # 1 vCPU per instance
--min-instances 0     # Scale to zero (saves ~$10-30/month)
--max-instances 10    # Backend: reasonable limit
--max-instances 5     # Frontend: reasonable limit
--timeout 300         # Backend: 5 minutes for large uploads
--timeout 60          # Frontend: 1 minute
```

#### Cost Savings
- **Min instances = 0**: Saves $10-30/month (no idle costs)
- **Right-sized memory**: Saves ~20% vs over-provisioning
- **Concurrency**: Cloud Run handles multiple requests per instance (default: 80)

### 2. Frontend Hosting Alternatives

#### Option A: Cloud Run (Current)
- **Cost**: $0-5/month (within free tier for low traffic)
- **Pros**: Easy deployment, automatic HTTPS
- **Cons**: Slight cost after free tier

#### Option B: Cloud Storage Static Hosting (FREE)
- **Cost**: $0 (only pay for storage, ~$0.01/month)
- **Setup**: 
  ```bash
  gsutil mb gs://your-project-frontend
  gsutil web set -m index.html -e index.html gs://your-project-frontend
  gsutil -m rsync -r dist/ gs://your-project-frontend/
  ```
- **Pros**: FREE, fast, CDN-ready
- **Cons**: No server-side rendering, need Cloud CDN for custom domain

#### Option C: Cloud CDN + Cloud Storage
- **Cost**: ~$0.01-0.08/GB (cheaper than Cloud Run for static)
- **Setup**: Enable CDN on Cloud Storage bucket
- **Pros**: Fast, cheap, custom domain support
- **Cons**: Slight setup complexity

**Recommendation**: Use **Cloud Storage static hosting** for frontend (FREE)

### 3. Database Optimization

#### Current Setup (Already Optimized)
- ✅ Shared instance for dev/prod
- ✅ db-f1-micro (FREE tier)
- ✅ 10GB disk (enough for metadata)

#### Additional Optimizations
- **Connection pooling**: Reduces connection overhead
- **Query optimization**: Use indexes, avoid N+1 queries
- **Read replicas**: Only if needed (adds cost)

### 4. Storage Optimization

#### Current Lifecycle Rules
```hcl
lifecycle_rule {
  condition {
    age = 365  # Delete files older than 1 year
  }
  action {
    type = "Delete"
  }
}
```

#### Additional Optimizations
- **Storage classes**: Use `NEARLINE` or `COLDLINE` for old files
  - Nearline: $0.010/GB/month (vs $0.020 for standard)
  - Coldline: $0.004/GB/month (for files accessed <1x/month)
- **Compression**: Compress files before upload (saves storage)
- **Cleanup**: Delete temporary files after processing

### 5. Network Optimization

#### Reduce Egress Costs
- **Cloud CDN**: Cache static assets (reduces egress)
- **Same region**: Keep services in same region
- **Compression**: Enable gzip/brotli compression

### 6. Monitoring & Budget Alerts

#### Set Up Budget
```bash
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Video Pipeline Budget" \
  --budget-amount=50USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

#### Monitor Costs
- **GCP Console**: Billing → Reports
- **Cloud Monitoring**: Set up cost alerts
- **Cost breakdown**: Review monthly by service

## Recommended Production Setup (Minimal Cost)

### Architecture
```
Frontend: Cloud Storage (static hosting) - FREE
Backend: Cloud Run (serverless) - $0-5/month
Database: Cloud SQL (shared, db-f1-micro) - FREE
Storage: Cloud Storage - $2-10/month
CDN: Cloud CDN (optional) - $0-2/month
```

### Estimated Total: **$2-17/month**

### Configuration
```yaml
# Backend Cloud Run
memory: 512Mi
cpu: 1
min-instances: 0
max-instances: 10
concurrency: 80
timeout: 300s

# Frontend (Cloud Storage)
bucket: your-project-frontend
storage-class: STANDARD
lifecycle: delete after 365 days
cdn: enabled (optional)
```

## Cost Comparison: Cloud Run vs Alternatives

| Option | Monthly Cost | Pros | Cons |
|--------|-------------|------|------|
| **Cloud Run** | $0-20 | Serverless, auto-scaling | Slight cost after free tier |
| **Cloud Functions** | $0-15 | Cheaper for low traffic | Less flexible |
| **App Engine** | $0-25 | Managed, easy | More expensive |
| **Compute Engine (VM)** | $10-50 | Full control | Manual scaling, always-on cost |
| **Kubernetes (GKE)** | $70+ | Scalable | Complex, expensive |

**Winner**: Cloud Run (best balance of cost and flexibility)

## Cost Monitoring Dashboard

### Key Metrics to Track
1. **Cloud Run**: Requests, instance hours, memory-seconds
2. **Cloud SQL**: CPU utilization, connections
3. **Cloud Storage**: Storage size, operations
4. **Network**: Egress bytes

### Set Up Alerts
```bash
# Alert when costs exceed $20/month
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Cost Alert" \
  --budget-amount=20USD \
  --threshold-rule=percent=100
```

## Cost Optimization Checklist

- [x] Use shared Cloud SQL instance (FREE tier)
- [x] Set min-instances = 0 on Cloud Run
- [ ] Use Cloud Storage for frontend (FREE alternative)
- [ ] Enable Cloud CDN for static assets
- [ ] Set up storage lifecycle rules
- [ ] Configure budget alerts
- [ ] Monitor costs weekly
- [ ] Right-size memory/CPU
- [ ] Use connection pooling
- [ ] Optimize database queries

## Expected Costs by Traffic Level

| Traffic Level | Requests/Month | Estimated Cost |
|--------------|----------------|----------------|
| **Low** | <100k | $0-5/month |
| **Medium** | 100k-1M | $5-20/month |
| **High** | 1M-10M | $20-50/month |
| **Very High** | >10M | $50-100/month |

## Additional Savings Tips

1. **Reserved Capacity**: Not applicable (Cloud Run is pay-per-use)
2. **Sustained Use Discounts**: Automatic (Cloud Run)
3. **Committed Use**: Not available for Cloud Run
4. **Preemptible Instances**: Not applicable (Cloud Run)
5. **Regional Discounts**: Use same region for all services

## Summary

**Current optimized setup**: **$0-8/month** for low traffic
**With Cloud Storage frontend**: **$2-5/month** for low traffic

The setup is already well-optimized for cost. Main savings would come from:
1. Using Cloud Storage for frontend (saves $2-5/month)
2. Monitoring and optimizing based on actual usage
3. Setting up budget alerts to prevent surprises

