# 📁 File Management System

## Overview
Comprehensive file and folder management with tree view, CRUD operations, drag-and-drop, and real-time file watching for auto-refresh.

---

## ✨ Key Features

### 1. **File Explorer**
- Tree view navigation
- Expandable folders
- File type icons
- Context menu actions
- Drag & drop support

### 2. **File Operations**
- Create files and folders
- Rename files/folders
- Delete with confirmation
- Move/Copy files
- File upload

### 3. **File Watching**
- Auto-detect file changes
- Real-time editor refresh
- External editor sync
- 300ms debounce
- Smart conflict resolution

### 4. **File Search**
- Quick file search
- Filter by name
- Filter by extension
- Recent files list

---

## 🎯 Usage

### Basic Operations
```bash
# Create new file
Right-click in Explorer → New File
Enter filename → Press Enter

# Create new folder
Right-click → New Folder
Enter folder name → Press Enter

# Rename
Right-click file → Rename
Edit name → Press Enter

# Delete
Right-click file → Delete
Confirm deletion

# Open file
Click file in explorer
Or double-click to open in new tab
```

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| New File | Ctrl+N |
| Save File | Ctrl+S |
| Close File | Ctrl+W |
| Delete | Delete key |
| Rename | F2 |
| Search Files | Ctrl+P |

---

## 🔧 Technical Details

### Components
```
frontend/src/components/FileExplorer.jsx     # Tree view UI
frontend/src/services/fileService.js         # API client
backend/src/controllers/file.controller.js   # REST endpoints
backend/src/services/fileWatcher.service.js  # File monitoring
backend/src/lib/localFileService.js          # File operations
```

### API Endpoints
```javascript
GET    /api/v1/files/tree/:projectId        # Get file tree
POST   /api/v1/files/:projectId             # Create file/folder
GET    /api/v1/files/:projectId/:path       # Read file
PUT    /api/v1/files/:projectId/:path       # Update file
DELETE /api/v1/files/:projectId/:path       # Delete file
POST   /api/v1/files/:projectId/rename      # Rename file
POST   /api/v1/files/:projectId/move        # Move file
```

---

## 🚀 Features in Detail

### 1. File Tree Structure
```json
{
  "name": "my-project",
  "type": "directory",
  "path": "/",
  "children": [
    {
      "name": "src",
      "type": "directory",
      "path": "/src",
      "children": [
        {
          "name": "main.py",
          "type": "file",
          "path": "/src/main.py",
          "size": 1024,
          "modified": "2025-11-09T10:30:00Z"
        }
      ]
    },
    {
      "name": "README.md",
      "type": "file",
      "path": "/README.md",
      "size": 2048,
      "modified": "2025-11-09T09:15:00Z"
    }
  ]
}
```

### 2. File Watcher
```javascript
// Monitor directory
const watcher = chokidar.watch(projectPath, {
  ignored: [
    /(^|[\/\\])\../,   // Hidden files
    /node_modules/,     // Dependencies
    /__pycache__/,      // Python cache
    /.git/             // Git folder
  ],
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 300,  // Wait 300ms after last change
    pollInterval: 100
  }
});

// Events
watcher
  .on('add', path => {
    console.log(`File added: ${path}`);
    notifyClients({ type: 'add', path });
  })
  .on('change', path => {
    console.log(`File changed: ${path}`);
    notifyClients({ type: 'change', path });
  })
  .on('unlink', path => {
    console.log(`File deleted: ${path}`);
    notifyClients({ type: 'delete', path });
  });
```

### 3. Context Menu Actions
```javascript
const contextMenuItems = [
  { label: 'New File', icon: '📄', action: 'newFile' },
  { label: 'New Folder', icon: '📁', action: 'newFolder' },
  { label: 'Rename', icon: '✏️', action: 'rename' },
  { label: 'Delete', icon: '🗑️', action: 'delete' },
  { label: 'Copy Path', icon: '📋', action: 'copyPath' },
  { label: 'Download', icon: '⬇️', action: 'download' }
];
```

---

## ⚙️ Configuration

### Ignored Files
```javascript
// backend/src/services/fileWatcher.service.js
const ignoredPatterns = [
  '**/node_modules/**',
  '**/__pycache__/**',
  '**/.git/**',
  '**/.vscode/**',
  '**/*.pyc',
  '**/.DS_Store',
  '**/Thumbs.db'
];
```

### File Size Limits
```javascript
// Maximum file size for reading
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Maximum upload size
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
```

### Debounce Settings
```javascript
// Wait time before triggering watch event
const DEBOUNCE_DELAY = 300; // milliseconds
```

---

## 📊 File Operations Flow

### Create File
```
User Input → Validate Name → Check Conflicts → 
Create File → Update Tree → Notify Clients → 
Sync to Drive (if enabled)
```

### Update File
```
Editor Change → Debounce (300ms) → Save to Disk → 
Update Container → Notify Watcher → Sync to Drive
```

### Delete File
```
User Confirms → Delete from Disk → Remove from Tree → 
Stop Container Watch → Notify Clients → Sync to Drive
```

---

## 🎨 File Type Icons

| Extension | Icon | Color |
|-----------|------|-------|
| `.py` | 🐍 | Blue |
| `.js` / `.jsx` | ⚛️ | Yellow |
| `.java` | ☕ | Orange |
| `.cpp` / `.c` | 🔧 | Blue |
| `.html` | 🌐 | Red |
| `.css` | 🎨 | Blue |
| `.json` | 📋 | Green |
| `.md` | 📝 | Gray |
| Directory | 📁 | Yellow |

---

## 🔄 File Synchronization

### Auto-Refresh
```javascript
// Editor component
useEffect(() => {
  const refreshInterval = setInterval(() => {
    if (hasExternalChanges) {
      reloadFileContent();
    }
  }, 1000); // Check every second

  return () => clearInterval(refreshInterval);
}, []);
```

### Conflict Resolution
```javascript
if (fileModifiedExternally && hasUnsavedChanges) {
  showConflictDialog({
    options: [
      'Keep my changes',
      'Use file version',
      'Show diff'
    ]
  });
}
```

---

## 📦 Storage Structure

### Local Storage
```
backend/
  workspace/
    project-123/
      src/
        main.py
        utils.py
      tests/
        test_main.py
      README.md
```

### Metadata
```json
{
  "projectId": "project-123",
  "name": "My Project",
  "created": "2025-11-01T10:00:00Z",
  "modified": "2025-11-09T14:30:00Z",
  "files": 15,
  "size": 52428800,
  "language": "python"
}
```

---

## 🐛 Troubleshooting

### Issue: Files not appearing
**Solution**:
```bash
# Refresh file tree
Click refresh icon in File Explorer

# Check file permissions
ls -la backend/workspace/project-id/

# Restart backend
cd backend
npm run dev
```

### Issue: File watcher not working
**Solution**:
```bash
# Check chokidar is installed
npm list chokidar

# Increase file watch limit (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Issue: Cannot delete file
**Solution**:
- Close file in editor first
- Check file is not in use by container
- Verify file permissions
- Try renaming first, then delete

---

## 📖 References

- [chokidar Documentation](https://github.com/paulmillr/chokidar)
- [Node.js fs API](https://nodejs.org/api/fs.html)
- [File System Watch API](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemWatcher)
