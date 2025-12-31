# Cloud SQL Setup for Dev Environment

The dev environment now uses **Cloud SQL (PostgreSQL)** instead of SQLite for persistent data storage.

## What Was Created

Terraform provisions:
- **Cloud SQL Instance**: `video-pipeline-dev` (PostgreSQL 15)
- **Database**: `video_pipeline_dev`
- **Database User**: `video_pipeline_dev`
- **Password**: Generated automatically (stored in Terraform state)

## Getting Connection Details

After Terraform apply completes, get the connection details:

```bash
cd terraform
terraform output database_public_ip
terraform output database_name
terraform output database_user
terraform output -raw database_password
```

## Updating backend/.env

Once the Cloud SQL instance is created, update `backend/.env`:

```bash
cd terraform
DB_IP=$(terraform output -raw database_public_ip)
DB_NAME=$(terraform output -raw database_name)
DB_USER=$(terraform output -raw database_user)
DB_PASSWORD=$(terraform output -raw database_password)

# Update backend/.env
cd ../backend
sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://'$DB_USER':'$DB_PASSWORD'@'$DB_IP':5432/'$DB_NAME'|' .env
```

Or manually set:
```env
DATABASE_URL=postgresql://video_pipeline_dev:PASSWORD@IP_ADDRESS:5432/video_pipeline_dev
```

## Running Migrations

After updating `.env`, run migrations:

```bash
cd backend
npm run migrate
npm run setup-admin
```

## Connecting from Local Machine

The Cloud SQL instance is configured with:
- **Public IP**: Enabled (for dev access)
- **Authorized Networks**: `0.0.0.0/0` (allows all IPs for dev)

For production, you should:
- Use private IP
- Restrict authorized networks
- Use Cloud SQL Proxy for secure connections

## Cloud SQL Proxy (Alternative - More Secure)

For a more secure connection, use Cloud SQL Proxy:

1. Install the proxy:
   ```bash
   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
   chmod +x cloud-sql-proxy
   ```

2. Get connection name:
   ```bash
   cd terraform
   terraform output -raw database_connection_name
   ```

3. Run the proxy:
   ```bash
   ./cloud-sql-proxy --port 5432 CONNECTION_NAME
   ```

4. Update `.env`:
   ```env
   DATABASE_URL=postgresql://video_pipeline_dev:PASSWORD@localhost:5432/video_pipeline_dev
   ```

## Troubleshooting

**Connection refused:**
- Check that the Cloud SQL instance is running
- Verify the IP address in `.env` matches `terraform output database_public_ip`
- Ensure your IP is authorized (dev allows all IPs)

**Authentication failed:**
- Verify username and password from Terraform outputs
- Check that the database user was created successfully

**Instance not found:**
- Wait for Terraform apply to complete (can take 5-10 minutes)
- Check GCP Console for instance status

