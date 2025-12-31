# Video Pipeline App

A scalable video production pipeline management system for YouTube Shorts.

## Quick Start

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Setup database (SQLite for local dev)
cd backend
echo "DATABASE_URL=sqlite://./dev.db" >> .env
echo "JWT_SECRET=dev-secret" >> .env
echo "FRONTEND_URL=http://localhost:3000" >> .env

# Initialize database
npm run migrate

# Create admin account (Google OAuth - no password needed)
npm run setup-admin

# Start servers (2 terminals)
npm run dev                    # Terminal 1: Backend
cd ../frontend && npm run dev   # Terminal 2: Frontend
```

Open http://localhost:3000 and sign in with Google OAuth.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Storage**: Google Cloud Storage (GCP)
- **Auth**: Google OAuth + JWT

## Documentation

- **[Setup Guide](docs/SETUP.md)** - Complete setup instructions
- **[Quick Start](docs/QUICK_START.md)** - Fast setup reference
- **[Local Testing](docs/LOCAL_TESTING.md)** - Testing without GCP
- **[GCP Setup](docs/GCP_SETUP.md)** - Configure Google Cloud Storage
- **[Google OAuth](docs/GOOGLE_OAUTH_SETUP.md)** - OAuth configuration
- **[Deployment](docs/DEPLOYMENT.md)** - Production deployment guide
- **[Architecture](docs/ARCHITECTURE.md)** - System design and patterns

## Features

- ✅ Google OAuth authentication
- ✅ Role-based access (admin, script_writer, clipper, editor)
- ✅ Short management with status tracking
- ✅ Assignment system with due dates
- ✅ File uploads to GCP Storage
- ✅ Payment tracking (admin only)
- ✅ Profile completion requirements

## Project Structure

```
video-pipeline-app/
├── backend/     # Express API server
├── frontend/    # React application
├── shared/      # Shared TypeScript types
├── terraform/   # GCP infrastructure
└── docs/        # Documentation
```

## Development

- **Maintainability First**: Clean code, clear separation of concerns
- **Functional over Beautiful**: UI works, can be polished later
- **Extensible**: Easy to add features like auto-uploads
