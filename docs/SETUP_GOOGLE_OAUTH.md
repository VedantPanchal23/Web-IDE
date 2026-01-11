# Google OAuth Setup Guide

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

## Step 2: Enable Required APIs

Go to "APIs & Services" > "Library" and enable:
- **Google Drive API**
- **Google+ API** (for user profile info)

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. If prompted, configure OAuth consent screen:
   - User Type: External (for testing)
   - App name: AI-IDE
   - User support email: your email
   - Developer contact: your email
4. Application type: **Web application**
5. Name: AI-IDE Web Client
6. Authorized JavaScript origins:
   ```
   http://localhost:3001
   http://localhost:3002
   ```
7. Authorized redirect URIs:
   ```
   http://localhost:3001/api/v1/auth/google/callback
   ```

## Step 4: Update Environment Variables

Copy your Client ID and Client Secret, then update your `.env` file:

```bash
# Replace these with your actual credentials from Google Cloud Console
GOOGLE_CLIENT_ID=your-actual-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/google/callback
```

## Step 5: Test Setup

1. Restart your backend server
2. Try logging in through the web interface
3. You should be redirected to Google for authentication
4. After successful authentication, you'll be able to create/edit files

## OAuth Scopes Used by the App

The application requests these Google Drive scopes:
- `https://www.googleapis.com/auth/drive.file` - Access files created by the app
- `https://www.googleapis.com/auth/userinfo.profile` - User profile info
- `https://www.googleapis.com/auth/userinfo.email` - User email

## Troubleshooting

- **"Error 400: redirect_uri_mismatch"** - Make sure the redirect URI in Google Console exactly matches what's in your `.env`
- **"Access blocked"** - Add your email to test users in OAuth consent screen
- **"Invalid client"** - Double-check your Client ID and Secret