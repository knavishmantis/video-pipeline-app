# Migrating to Shared Database Instance

## Current Situation

You have an existing Cloud SQL instance: `video-pipeline-dev`

## Migration Options

### Option 1: Rename Existing Instance (Recommended - No Downtime)

Since GCP doesn't allow renaming instances directly, we'll:
1. Update Terraform to use your existing instance name
2. Import it into Terraform state
3. Keep using it as the shared instance

**Pros**: No data migration, no downtime
**Cons**: Instance name stays as `video-pipeline-dev` (but it's shared)

### Option 2: Create New Shared Instance (Clean Slate)

1. Create new `video-pipeline-shared` instance
2. Export data from old instance
3. Import to new instance
4. Update app configs
5. Delete old instance

**Pros**: Clean naming
**Cons**: Requires data migration, some downtime

## Recommended: Option 1 (Simplest)

Since you already have `video-pipeline-dev` running, let's just use it as the shared instance.

### Steps

1. **Update Terraform to use existing instance name:**
   - Change instance name from `video-pipeline-shared` to `video-pipeline-dev`
   - This way it matches what you already have

2. **Import existing instance into Terraform:**
   ```bash
   cd terraform
   terraform import -var="project_id=knavishmantis" -var="environment=dev" \
     google_sql_database_instance.shared[0] \
     knavishmantis:us-central1:video-pipeline-dev
   ```

3. **Import existing database:**
   ```bash
   terraform import -var="project_id=knavishmantis" -var="environment=dev" \
     google_sql_database.main \
     knavishmantis:us-central1:video-pipeline-dev:video_pipeline_dev
   ```

4. **Import existing user (if needed):**
   ```bash
   terraform import -var="project_id=knavishmantis" -var="environment=dev" \
     google_sql_user.app_user \
     knavishmantis:us-central1:video-pipeline-dev:video_pipeline_dev
   ```

5. **Verify state:**
   ```bash
   terraform plan -var="project_id=knavishmantis" -var="environment=dev"
   ```
   Should show no changes (or minimal changes)

6. **Apply to sync any differences:**
   ```bash
   terraform apply -var="project_id=knavishmantis" -var="environment=dev"
   ```

7. **Now create prod database in same instance:**
   ```bash
   terraform apply -var="project_id=knavishmantis" -var="environment=prod"
   ```

## Alternative: Option 2 (If You Want Clean Naming)

If you prefer the instance to be named `video-pipeline-shared`:

1. **Create new shared instance:**
   ```bash
   cd terraform
   terraform apply -var="project_id=knavishmantis" -var="environment=dev"
   ```
   This creates `video-pipeline-shared` instance

2. **Export data from old instance:**
   ```bash
   gcloud sql export sql video-pipeline-dev \
     gs://YOUR_BUCKET/backup.sql \
     --database=video_pipeline_dev \
     --project=knavishmantis
   ```

3. **Import to new instance:**
   ```bash
   gcloud sql import sql video-pipeline-shared \
     gs://YOUR_BUCKET/backup.sql \
     --database=video_pipeline_dev \
     --project=knavishmantis
   ```

4. **Update your app's DATABASE_URL** to point to new instance

5. **Test the app** to ensure everything works

6. **Delete old instance:**
   ```bash
   gcloud sql instances delete video-pipeline-dev --project=knavishmantis
   ```

## Quick Migration Script

I'll update Terraform to use your existing instance name, then you can import it.

