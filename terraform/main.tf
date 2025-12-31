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

# Helper: Save key to file (run this after apply)
# terraform output -raw service_account_key_private_key | base64 -d > ../backend/gcp-key-{env}.json

