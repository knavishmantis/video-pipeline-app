# Google OAuth Setup

## Quick Setup

### Step 1: Get Google OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Go to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
5. If prompted, configure OAuth consent screen first:
   - User Type: **External** (for testing)
   - App name: **Video Pipeline**
   - Support email: your email
   - Developer contact: your email
   - Click **Save and Continue** through the steps
6. Back to Credentials:
   - Application type: **Web application**
   - Name: **Video Pipeline Dev**
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000`
   - Click **Create**
7. Copy the **Client ID** (looks like: `123456789-abc.apps.googleusercontent.com`)

### Step 2: Configure Frontend

Create `frontend/.env`:
```bash
cd frontend
echo "VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com" > .env
```

Replace `your-client-id-here` with the actual Client ID from Step 1.

### Step 3: Configure Backend

Add to `backend/.env`:
```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

### Step 4: Restart Servers

```bash
# Stop both servers (Ctrl+C)
# Then restart:

# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Step 5: Test

1. Open http://localhost:3000
2. You should see the Google sign-in button
3. Click it and sign in with your Google account

## Production Configuration

For production, update the OAuth client:
- Authorized JavaScript origins: `https://yourdomain.com`
- Authorized redirect URIs: `https://yourdomain.com`

## Usage

- Users can click "Sign in with Google" button
- Admin (quinncaverly@gmail.com) can sign in immediately
- Other users must be created by admin first
- Password is optional - users can use Google OAuth only

## Setup Admin (No Password Required)

```bash
cd backend
npm run setup-admin  # No password needed!
```

The admin account will be created with Google OAuth only.

