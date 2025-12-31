# Setup Instructions

## Prerequisites

1. **Node.js 18+** installed
2. **PostgreSQL** database (or SQLite for development)
3. **GCP Account** (optional for initial testing, required for file uploads)
   - Use Terraform to provision resources (see `../terraform/README.md`)
   - Or manually create Storage bucket and service account

## Step 1: Backend Setup

```bash
cd backend
npm install
```

### Configure Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/video_pipeline
# Or for SQLite: DATABASE_URL=sqlite://./dev.db

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# GCP Storage (Optional - leave empty for testing without uploads)
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-bucket-name
GCP_KEY_FILE=./gcp-key-dev.json  # Use gcp-key-prod.json for production

# CORS
FRONTEND_URL=http://localhost:3000
```

### GCP Setup (Optional for File Uploads)

**Option 1: Use Terraform (Recommended)**
```bash
cd terraform
terraform init
terraform workspace new dev
terraform apply -var="project_id=your-project-id" -var="environment=dev"
terraform output -raw service_account_key_base64 | base64 -d > ../backend/gcp-key-dev.json
```

**Option 2: Manual Setup**
1. Create GCP Storage bucket
2. Create service account with Storage permissions
3. Download service account key JSON
4. Place in `backend/` directory as `gcp-key-dev.json`

**Note**: Without GCP setup, you can still test all features except file uploads.

### Initialize Database

```bash
npm run migrate
```

This will create all necessary tables.

### Start Backend Server

```bash
npm run dev
```

The backend will run on `http://localhost:3001`

## Step 2: Frontend Setup

```bash
cd frontend
npm install
```

### Configure Environment (Optional)

Create a `.env` file in the `frontend` directory if you need to override the API URL:

```env
VITE_API_URL=http://localhost:3001/api
```

### Start Frontend Development Server

```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Step 3: Create Your First User

You'll need to create an admin user. You can do this by:

1. Using the registration endpoint directly (you may want to temporarily remove auth requirements)
2. Or manually inserting into the database:

```sql
INSERT INTO users (email, name, password_hash, role)
VALUES ('admin@example.com', 'Admin User', '$2a$10$...', 'admin');
```

For password hashing, you can use a tool like `bcrypt` or create a simple script.

## Project Structure Overview

```
video-pipeline-app/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Auth middleware
│   │   ├── services/     # GCP Storage service
│   │   └── db/           # Database setup & migrations
│   └── package.json
├── frontend/             # React application
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── contexts/     # React contexts (Auth)
│   │   └── services/     # API client
│   └── package.json
├── shared/               # Shared TypeScript types
└── docs/        # Documentation
```

## Key Features Implemented

✅ User authentication with JWT
✅ Role-based access control (admin, script_writer, clipper, editor)
✅ Short management (create, update, track status)
✅ Assignment system with due dates
✅ File upload to GCP Storage (clips, audio, final videos)
✅ Payment tracking (admin only)
✅ User profiles with Discord, PayPal, Google links
✅ Filtering by assigned items
✅ Status tracking throughout pipeline

## Next Steps

1. **Create your first admin user** (see Step 3)
2. **Log in** and start creating shorts
3. **Add users** for each role (script writers, clippers, editors)
4. **Assign shorts** to team members
5. **Track payments** as work is completed

## Future Enhancements

- Auto-upload to YouTube (when ready)
- Email notifications for assignments
- Analytics dashboard
- Batch operations
- Template system for scripts

## Troubleshooting

### Database Connection Issues
- Verify your `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check database credentials

### GCP Storage Issues
- Verify `GCP_KEY_FILE` path is correct
- Ensure service account has Storage permissions
- Check bucket name is correct

### CORS Issues
- Verify `FRONTEND_URL` in backend `.env` matches your frontend URL
- Check browser console for specific CORS errors

