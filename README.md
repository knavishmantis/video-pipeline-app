# Video Production Management Platform

A fullstack workflow automation tool for coordinating YouTube Shorts production across distributed teams.

**Live Impact:** Produced 28 shorts with 1.7M+ cumulative views

## Overview

This platform manages the entire video production pipeline from script creation to final delivery, coordinating work between script writers, video clippers, and editors while automating payments and quality control.

## Tech Stack

- **Frontend:** React, TypeScript, Material-UI
- **Backend:** Express.js, Node.js, TypeScript
- **Database:** Google Cloud SQL (MySQL)
- **Infrastructure:** Terraform, GitHub Actions CI/CD
- **Auth:** Google OAuth 2.0
- **AI:** GCP Vertex AI for script evaluation

## Key Features

### 1. Kanban Workflow Management
Visual board tracking scripts, clips, and edited videos through production stages with drag-and-drop interface.

<img width="1919" height="962" alt="image" src="https://github.com/user-attachments/assets/685e7b1d-4fee-49f3-b932-f6f73d162a9e" />

### 2. AI-Powered Script Grading
Custom Vertex AI integration evaluates script quality based on defined criteria, providing automated feedback to improve content.

<img width="1918" height="964" alt="image" src="https://github.com/user-attachments/assets/12c9432d-2004-4354-a808-0d838cf8da84" />

### 3. Automated Payment Tracking
Calculates contractor payments based on completed deliverables and configured rates.

(Numbers blacked out for privacy)
<img width="1914" height="954" alt="2026-02-09_17-04" src="https://github.com/user-attachments/assets/b7106d26-9490-46ec-ad77-6fe36774af0f" />

### 4. Competitive Script Analysis
Interactive training tool for identifying high-performing content patterns. Presents competitor scripts with a percentile slider to calibrate judgment of what makes successful content—enabling reverse engineering of viral script structures.

<img width="1918" height="962" alt="image" src="https://github.com/user-attachments/assets/723f0559-a578-4a57-a165-cd61c7761389" />

## Architecture

- **Monorepo** structure with separate frontend/backend
- **RESTful API** with Express.js
- **Cloud-native** deployment on GCP
- **IaC** with Terraform for reproducible infrastructure
- **CI/CD** via GitHub Actions for automated deployments

## Deployment

Infrastructure managed via Terraform with separate dev/prod environments. Automated deployments on merge to main via GitHub Actions.

---

**Built to solve a real production workflow problem - coordinating remote contractors while maintaining quality and tracking finances.**
