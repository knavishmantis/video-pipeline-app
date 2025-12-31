# Google OAuth Setup

## Backend Configuration

Add to `backend/.env`:
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

## Frontend Configuration

Add to `frontend/.env`:
```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

## Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Application type: **Web application**
6. Authorized JavaScript origins:
   - `http://localhost:3000` (dev)
   - `https://yourdomain.com` (prod)
7. Authorized redirect URIs:
   - `http://localhost:3000` (dev)
   - `https://yourdomain.com` (prod)
8. Copy the **Client ID** to both `.env` files

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

