# ☁️ Google Drive Integration

## Overview
Seamless cloud storage integration using Google Drive API v3 with OAuth2 authentication, automatic background sync, and offline-first architecture.

---

## ✨ Key Features

### 1. **OAuth2 Authentication**
- Secure Google Sign-In
- Minimal permission scopes
- Token refresh automation
- Session persistence

### 2. **Automatic Sync**
- Background synchronization
- Conflict detection
- Manual sync trigger
- Sync status indicators

### 3. **Offline-First**
- Local storage priority
- Work without internet
- Queue sync operations
- Auto-sync on reconnect

### 4. **Project Management**
- Create projects in Drive
- List all Drive projects
- Download projects locally
- Share projects (future)

---

## 🎯 Usage

### Initial Setup
```javascript
// 1. Click "Login with Google"
// 2. Authorize AI-IDE
// 3. Select permissions:
//    - See and download Drive files
//    - Create and edit Drive files
// 4. Complete authentication
```

### Create Project in Drive
```bash
# From UI
1. Click "New Project"
2. Enter project name
3. Choose "Save to Google Drive"
4. Project created and synced
```

### Sync Operations
```bash
# Auto sync (default)
- Saves trigger automatic sync
- 5-second debounce
- Background operation

# Manual sync
Click sync icon → "Sync Now"
Status: Syncing... → Synced ✓

# Check sync status
Green checkmark: Synced
Orange spinner: Syncing
Red X: Sync failed
```

---

## 🔧 Technical Details

### OAuth2 Configuration
```javascript
// backend/.env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

// Scopes
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];
```

### API Integration
```javascript
// Components
backend/src/lib/driveService.js           # Google Drive API wrapper
backend/src/controllers/drive.controller.js # REST endpoints
backend/src/middleware/auth.middleware.js # JWT authentication
frontend/src/services/authService.js      # OAuth client
```

### Endpoints
```javascript
GET  /auth/google                    # Initiate OAuth flow
GET  /auth/google/callback           # OAuth callback
POST /auth/logout                    # Sign out
GET  /api/v1/drive/projects          # List Drive projects
POST /api/v1/drive/projects          # Create project
GET  /api/v1/drive/projects/:id      # Get project files
PUT  /api/v1/drive/sync/:projectId   # Sync project
```

---

## 🚀 Features in Detail

### 1. Authentication Flow
```
┌─────────────────┐
│ Click Login     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Redirect to     │
│ Google OAuth    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ User Authorizes │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Callback with   │
│ Auth Code       │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Exchange for    │
│ Access Token    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Store Token +   │
│ Create Session  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ User Logged In  │
└─────────────────┘
```

### 2. File Sync Logic
```javascript
async function syncFile(localPath, driveFileId) {
  // 1. Get local file metadata
  const localMeta = await getLocalFileMeta(localPath);
  
  // 2. Get Drive file metadata
  const driveMeta = await getDriveFileMeta(driveFileId);
  
  // 3. Compare modification times
  if (localMeta.modified > driveMeta.modified) {
    // Local is newer - upload to Drive
    await uploadToDrive(localPath, driveFileId);
  } else if (driveMeta.modified > localMeta.modified) {
    // Drive is newer - download locally
    await downloadFromDrive(driveFileId, localPath);
  }
  
  // 4. Update sync status
  updateSyncStatus(localPath, 'synced');
}
```

### 3. Conflict Resolution
```javascript
if (hasConflict) {
  showDialog({
    title: 'Sync Conflict',
    message: 'File was modified in both locations',
    options: [
      {
        label: 'Keep Local Version',
        action: () => uploadToDrive()
      },
      {
        label: 'Use Drive Version',
        action: () => downloadFromDrive()
      },
      {
        label: 'Keep Both',
        action: () => createCopy()
      }
    ]
  });
}
```

---

## ⚙️ Configuration

### Setup Google Cloud Console
```bash
# 1. Go to https://console.cloud.google.com
# 2. Create new project
# 3. Enable Google Drive API
# 4. Create OAuth 2.0 credentials
# 5. Add authorized redirect URIs:
#    - http://localhost:3001/auth/google/callback
#    - https://yourdomain.com/auth/google/callback
# 6. Copy Client ID and Client Secret to .env
```

### Environment Variables
```env
# backend/.env
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# Session management
SESSION_SECRET=your_random_secret_key_here
JWT_SECRET=another_random_secret
```

### Sync Settings
```javascript
// Sync interval
const SYNC_INTERVAL = 60000; // 1 minute

// Debounce delay
const SYNC_DEBOUNCE = 5000; // 5 seconds after last change

// Max retries
const MAX_RETRY_ATTEMPTS = 3;
```

---

## 📊 Sync Status States

| State | Icon | Meaning |
|-------|------|---------|
| **Synced** | ✅ | All changes uploaded |
| **Syncing** | 🔄 | Upload in progress |
| **Modified** | ⚠️ | Local changes pending |
| **Error** | ❌ | Sync failed |
| **Offline** | 📴 | No internet connection |
| **Conflict** | ⚡ | Manual resolution needed |

---

## 🔒 Security & Privacy

### Token Storage
```javascript
// Encrypted token storage
const encryptedToken = crypto.encrypt(accessToken, SECRET_KEY);
await db.tokens.save({
  userId,
  token: encryptedToken,
  expires: Date.now() + 3600000 // 1 hour
});

// Token refresh
if (isTokenExpired(token)) {
  const newToken = await refreshAccessToken(refreshToken);
  updateStoredToken(newToken);
}
```

### Permission Scopes
```javascript
// Minimal scopes requested
drive.file      // Only access files created by app
userinfo.email  // Get user email
userinfo.profile // Get user name

// NOT requesting:
drive.readonly  // Don't need full Drive access
drive          // Don't need all files access
```

---

## 📦 Drive Storage Structure

### Folder Organization
```
Google Drive/
└── AI-IDE Projects/
    ├── My Python Project/
    │   ├── src/
    │   │   └── main.py
    │   ├── tests/
    │   └── README.md
    │
    └── Web App/
        ├── index.html
        ├── style.css
        └── script.js
```

### Metadata
```json
{
  "name": "My Python Project",
  "id": "1abc-xyz789",
  "mimeType": "application/vnd.google-apps.folder",
  "createdTime": "2025-11-01T10:00:00Z",
  "modifiedTime": "2025-11-09T14:30:00Z",
  "size": 52428800,
  "properties": {
    "appId": "ai-ide",
    "projectType": "python",
    "version": "1.0"
  }
}
```

---

## 🐛 Troubleshooting

### Issue: Cannot login with Google
**Solution**:
```bash
# Check OAuth credentials
cat backend/.env | grep GOOGLE

# Verify redirect URI in Google Console
# Must match exactly: http://localhost:3001/auth/google/callback

# Check backend logs
cd backend
npm run dev
# Look for OAuth errors
```

### Issue: Sync not working
**Solution**:
```bash
# Check internet connection
curl https://www.googleapis.com/drive/v3/about

# Refresh access token
Click "Logout" → "Login with Google" again

# Check Drive API quota
# Go to Google Cloud Console → APIs → Quotas
```

### Issue: Token expired
**Solution**:
```javascript
// Automatic token refresh should handle this
// If not, re-authenticate:
1. Logout
2. Clear browser cookies
3. Login again
```

---

## 📖 References

- [Google Drive API v3](https://developers.google.com/drive/api/v3/about-sdk)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google API Node.js Client](https://github.com/googleapis/google-api-nodejs-client)
- [Setup Guide](../SETUP_GOOGLE_OAUTH.md)
