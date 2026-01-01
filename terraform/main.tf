variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be 'dev' or 'prod'."
  }
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required GCP APIs
resource "google_project_service" "artifact_registry" {
  project = var.project_id
  service = "artifactregistry.googleapis.com"
  
  disable_on_destroy = false
}

resource "google_project_service" "cloud_run" {
  project = var.project_id
  service = "run.googleapis.com"
  
  disable_on_destroy = false
}

resource "google_project_service" "cloud_build" {
  project = var.project_id
  service = "cloudbuild.googleapis.com"
  
  disable_on_destroy = false
}

resource "google_project_service" "container_registry" {
  project = var.project_id
  service = "containerregistry.googleapis.com"
  
  disable_on_destroy = false
}

# Artifact Registry repository for Docker images
# Using a standard repository name (gcr.io is a special format that auto-creates)
# We'll create a proper Artifact Registry repository
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "docker-repo"
  description   = "Docker repository for video pipeline app"
  format        = "DOCKER"
}


# Grant GitHub Actions permission to create repositories (for gcr.io auto-creation)
# This is needed because gcr.io format auto-creates repositories
resource "google_project_iam_member" "github_actions_artifact_registry_admin" {
  project = var.project_id
  role    = "roles/artifactregistry.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# Service Account for the application
resource "google_service_account" "app_service_account" {
  account_id   = "video-pipeline-${var.environment}"
  display_name = "Video Pipeline App Service Account (${var.environment})"
  description  = "Service account for video pipeline application"
}

# Storage Bucket for video files
resource "google_storage_bucket" "video_storage" {
  name          = "${var.project_id}-video-pipeline-${var.environment}"
  location      = var.region
  force_destroy = var.environment == "dev" ? true : false

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 365 # Delete files older than 1 year
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = var.environment == "dev" ? ["http://localhost:3000"] : ["https://yourdomain.com"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# IAM binding: Service account can write to bucket
resource "google_storage_bucket_iam_member" "service_account_write" {
  bucket = google_storage_bucket.video_storage.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app_service_account.email}"
}

# IAM binding: Service account can read from bucket
resource "google_storage_bucket_iam_member" "service_account_read" {
  bucket = google_storage_bucket.video_storage.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.app_service_account.email}"
}

# Service Account Key (for local development)
resource "google_service_account_key" "app_key" {
  service_account_id = google_service_account.app_service_account.id
}

# Shared Cloud SQL Instance (PostgreSQL) - Only ONE instance for both dev and prod
# Only create when environment is "dev" (first time setup)
# For "prod", we'll use a data source to reference the existing instance
resource "google_sql_database_instance" "shared" {
  count            = var.environment == "dev" ? 1 : 0 # Only create once (with dev)
  name             = "video-pipeline-shared"          # Shared instance for both dev and prod
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = "db-f1-micro" # FREE tier - only one free instance per billing account
    availability_type = "ZONAL"       # No high availability needed - saves ~20% cost

    disk_size = 10 # 10GB is enough for both dev and prod (just metadata, not videos)
    disk_type = "PD_SSD"

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7 # 7 days is enough
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled    = true
      private_network = null
      authorized_networks {
        # Allow all IPs (you can restrict this for prod)
        name  = "app-access"
        value = "0.0.0.0/0"
      }
    }

    database_flags {
      name  = "max_connections"
      value = "100" # Plenty for this use case
    }
  }

  deletion_protection = false # Set to true manually for prod if needed

  # Prevent Terraform from trying to update settings that might conflict
  lifecycle {
    ignore_changes = [
      settings[0].disk_size,
      settings[0].tier,
    ]
  }
}

# Data source to reference the shared instance (only for prod)
# This allows prod to reference the instance created by dev
# For dev, we create the instance directly, so this data source isn't needed
data "google_sql_database_instance" "shared" {
  count = var.environment == "prod" ? 1 : 0
  name  = "video-pipeline-shared"
}

# Use the created instance (dev) or data source (prod)
locals {
  sql_instance_name            = var.environment == "dev" ? google_sql_database_instance.shared[0].name : data.google_sql_database_instance.shared[0].name
  sql_instance_connection_name = var.environment == "dev" ? google_sql_database_instance.shared[0].connection_name : data.google_sql_database_instance.shared[0].connection_name
  sql_instance_public_ip       = var.environment == "dev" ? google_sql_database_instance.shared[0].public_ip_address : data.google_sql_database_instance.shared[0].public_ip_address
}

# Database - separate database for each environment within the shared instance
resource "google_sql_database" "main" {
  name     = "video_pipeline_${var.environment}"
  instance = local.sql_instance_name
}

# Database User - separate user for each environment (optional, can share user too)
resource "google_sql_user" "app_user" {
  name     = "video_pipeline_${var.environment}"
  instance = local.sql_instance_name
  password = random_password.db_password.result
}

# Random password for database user
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# GitHub Actions Service Account (for CI/CD)
resource "google_service_account" "github_actions" {
  account_id   = "github-actions"
  display_name = "GitHub Actions CI/CD"
  description  = "Service account for GitHub Actions to deploy to Cloud Run"
}

# Grant permissions to GitHub Actions service account
resource "google_project_iam_member" "github_actions_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_iam_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_artifact_registry_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# Service Account Key for GitHub Actions
resource "google_service_account_key" "github_actions_key" {
  service_account_id = google_service_account.github_actions.id
}

# Outputs
output "bucket_name" {
  description = "Name of the GCP Storage bucket"
  value       = google_storage_bucket.video_storage.name
}

output "service_account_email" {
  description = "Email of the service account"
  value       = google_service_account.app_service_account.email
}

output "service_account_key_private_key" {
  description = "Private key for the service account (base64 encoded JSON)"
  value       = google_service_account_key.app_key.private_key
  sensitive   = true
}

output "database_instance_name" {
  description = "Name of the Cloud SQL instance (shared for dev and prod)"
  value       = local.sql_instance_name
}

output "database_name" {
  description = "Name of the database"
  value       = google_sql_database.main.name
}

output "database_user" {
  description = "Database user name"
  value       = google_sql_user.app_user.name
}

output "database_password" {
  description = "Database password (sensitive)"
  value       = random_password.db_password.result
  sensitive   = true
}

output "database_connection_name" {
  description = "Cloud SQL connection name for Cloud SQL Proxy"
  value       = local.sql_instance_connection_name
}

output "database_public_ip" {
  description = "Public IP address of the Cloud SQL instance"
  value       = local.sql_instance_public_ip
}

output "github_actions_service_account_email" {
  description = "Email of the GitHub Actions service account"
  value       = google_service_account.github_actions.email
}

output "github_actions_key_private_key" {
  description = "Private key for GitHub Actions service account (base64 encoded JSON)"
  value       = google_service_account_key.github_actions_key.private_key
  sensitive   = true
}

# Helper: Save keys to files (run this after apply)
# terraform output -raw service_account_key_private_key | base64 -d > ../backend/gcp-key-{env}.json
# terraform output -raw github_actions_key_private_key | base64 -d > ../github-actions-key.json

