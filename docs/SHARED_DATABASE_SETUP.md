# Shared Database Setup

## Overview

**Only ONE `db-f1-micro` Cloud SQL instance is free per GCP billing account.**

To stay within the free tier, we use a **single shared Cloud SQL instance** with **separate databases** for dev and prod.

## Architecture

```
Single Cloud SQL Instance: "video-pipeline-shared"
├── Database: "video_pipeline_dev" (for development)
└── Database: "video_pipeline_prod" (for production)
```

## Setup Steps

### 1. Create the Shared Instance (Dev Environment)

First, create the shared instance when setting up dev:

```bash
cd terraform
terraform init
terraform apply -var="project_id=knavishmantis" -var="environment=dev" -auto-approve
```

This creates:
- ✅ Cloud SQL instance: `video-pipeline-shared` (FREE)
- ✅ Database: `video_pipeline_dev`
- ✅ User: `video_pipeline_dev`
- ✅ Storage bucket: `knavishmantis-video-pipeline-dev`

### 2. Add Prod Database to Shared Instance

After dev is set up, add the prod database to the same instance:

```bash
terraform apply -var="project_id=knavishmantis" -var="environment=prod" -auto-approve
```

This creates:
- ✅ Database: `video_pipeline_prod` (in the same instance)
- ✅ User: `video_pipeline_prod`
- ✅ Storage bucket: `knavishmantis-video-pipeline-prod`

**Note**: The instance itself is not recreated - Terraform uses a data source to reference the existing instance.

## Connection Strings

### Dev Environment
```
postgresql://video_pipeline_dev:PASSWORD@PUBLIC_IP:5432/video_pipeline_dev
```

### Prod Environment
```
postgresql://video_pipeline_prod:PASSWORD@PUBLIC_IP:5432/video_pipeline_prod
```

Both use the **same instance IP address** but different databases.

## Benefits

1. **Cost**: Only one free instance (saves ~$25-70/month)
2. **Simplicity**: Single instance to manage
3. **Isolation**: Separate databases prevent data mixing
4. **Performance**: Shared instance is fine for low-medium traffic

## Important Notes

1. **Instance Creation**: The instance is only created when `environment=dev`. If you run prod first, it will fail because the instance doesn't exist yet.

2. **Order Matters**: Always create dev first, then prod.

3. **Data Isolation**: Dev and prod data are completely separate (different databases).

4. **Backups**: Backups are per-instance, so both databases are backed up together.

5. **If You Need Separate Instances**: If you later need separate instances (e.g., for security/compliance), you can:
   - Keep dev on free tier
   - Upgrade prod to `db-g1-small` (~$25/month) or higher

## Troubleshooting

### Error: "Instance not found"
- **Cause**: Running prod before dev
- **Fix**: Run `terraform apply` with `environment=dev` first

### Error: "Instance already exists"
- **Cause**: Instance was created manually or in a different Terraform state
- **Fix**: Use `terraform import` to import the existing instance, or use a data source

### Want Separate Instances?
If you need separate instances (e.g., for compliance), update `terraform/main.tf`:
- Change instance name back to `video-pipeline-${var.environment}`
- Remove the `count` and data source logic
- Note: Only one will be free, the other will cost ~$25-70/month

