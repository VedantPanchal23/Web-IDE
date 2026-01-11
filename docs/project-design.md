# Web-based IDE - Project Design

## 🏗️ System Architecture Overview

**Document Version:** 1.0  
**Date:** October 1, 2025  
**Architecture Pattern:** Modular Microservices with Local-First Design

## 📐 High-Level Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │ Runner/Executor │
│                 │    │                 │    │                 │
│ React + Vite    │◄──►│ Node.js + Express│◄──►│ Docker Containers│
│ Monaco Editor   │    │ REST + WebSocket│    │ Language Runtimes│
│ xterm.js        │    │ Authentication  │    │ Sandboxed Env   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   LSP Manager   │    │ File Storage    │    │Launcher/Controller│
│                 │    │                 │    │                 │
│ Language Servers│    │ Google Drive    │    │ Container Orchestr│
│ WebSocket Proxy │    │ Local Cache     │    │ Resource Mgmt   │
│ JSON-RPC        │    │ Sync Engine     │    │ PTY Management  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow Architecture

1. **User Opens Project** → Frontend requests file listing from Backend → Backend ensures local cache (pulls from Drive if needed) → Backend spawns language servers and runner containers as needed
2. **User Saves File** → Backend writes to local cache then syncs to Google Drive in background → Sync status shown in UI
3. **Code Execution** → Frontend triggers execution → Backend spawns Docker container → Output streams back via WebSocket
4. **Language Intelligence** → Editor sends LSP requests → Backend proxies to language servers → Results returned via WebSocket

## 🎨 Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── Editor/
│   │   ├── MonacoEditor.jsx      # Main code editor
│   │   ├── TabManager.jsx        # File tabs management
│   │   └── StatusBar.jsx         # Editor status indicators
│   ├── Explorer/
│   │   ├── FileTree.jsx          # Project file explorer
│   │   ├── FileContextMenu.jsx   # Right-click actions
│   │   └── SyncStatus.jsx        # Drive sync indicators
│   ├── Terminal/
│   │   ├── XTerminal.jsx         # xterm.js integration
│   │   ├── TerminalTabs.jsx      # Multiple terminal sessions
│   │   └── TerminalControls.jsx  # Terminal toolbar
│   ├── Runner/
│   │   ├── ExecutionPanel.jsx    # Code execution controls
│   │   ├── LanguageSelector.jsx  # Runtime selection
│   │   └── ResourceMonitor.jsx   # Container resource usage
│   └── Auth/
│       ├── GoogleAuth.jsx        # OAuth integration
│       ├── LoginForm.jsx         # Authentication UI
│       └── UserProfile.jsx       # User account info
├── services/
│   ├── api.js                    # REST API client
│   ├── websocket.js              # WebSocket management
│   ├── auth.js                   # Authentication service
│   └── drive.js                  # Google Drive integration
├── hooks/
│   ├── useAuth.js               # Authentication state
│   ├── useWebSocket.js          # WebSocket connection
│   ├── useFileTree.js           # File operations
│   └── useTerminal.js           # Terminal management
├── context/
│   ├── AuthContext.jsx          # Global auth state
│   ├── ProjectContext.jsx       # Project state
│   └── SettingsContext.jsx      # User preferences
└── utils/
    ├── constants.js             # App constants
    ├── helpers.js               # Utility functions
    └── types.js                 # JavaScript type definitions
```

### State Management

**Authentication State:**
- User profile and tokens
- OAuth flow status
- Session persistence

**Project State:**
- Current project metadata
- Open files and tabs
- Unsaved changes tracking

**Editor State:**
- Monaco editor instances
- Cursor positions and selections
- Editor preferences

**Terminal State:**
- Active terminal sessions
- Command history
- Output buffers

## 🔧 Backend Architecture

### Service Layer Structure

```
src/
├── controllers/
│   ├── auth.controller.js        # Google OAuth endpoints
│   ├── projects.controller.js    # Project CRUD operations
│   ├── files.controller.js       # File operations
│   ├── runner.controller.js      # Container management
│   └── sync.controller.js        # Drive sync operations
├── services/
│   ├── auth.service.js           # OAuth token management
│   ├── drive.service.js          # Google Drive API client
│   ├── runner.service.js         # Docker container service
│   ├── lsp.service.js            # Language server management
│   └── sync.service.js           # File synchronization
├── lib/
│   ├── drive/
│   │   ├── DriveAdapter.js       # Drive API abstraction
│   │   ├── FileMapper.js         # File metadata mapping
│   │   └── ConflictResolver.js   # Sync conflict resolution
│   ├── runner/
│   │   ├── DockerManager.js      # Docker operations
│   │   ├── ContainerPool.js      # Container lifecycle
│   │   └── ResourceLimiter.js    # CPU/memory constraints
│   ├── lsp/
│   │   ├── LSPProxy.js           # Language server proxy
│   │   ├── ServerManager.js      # LSP lifecycle management
│   │   └── MessageRouter.js      # JSON-RPC routing
│   ├── pty/
│   │   ├── PTYManager.js         # Terminal session management
│   │   ├── WebSocketHandler.js   # Terminal WebSocket proxy
│   │   └── CommandProcessor.js   # Command execution
│   └── sync/
│       ├── SyncEngine.js         # Core sync logic
│       ├── ConflictDetector.js   # Change detection
│       └── QueueManager.js       # Upload/download queues
├── middleware/
│   ├── auth.middleware.js        # JWT/session validation
│   ├── cors.middleware.js        # Cross-origin setup
│   ├── rateLimit.middleware.js   # API rate limiting
│   └── validation.middleware.js  # Request validation
├── models/
│   ├── Project.model.js          # Project schema
│   ├── File.model.js             # File metadata schema
│   ├── Session.model.js          # User session schema
│   └── Runner.model.js           # Container metadata schema
└── utils/
    ├── logger.js                 # Structured logging
    ├── config.js                 # Environment configuration
    └── database.js               # MongoDB connection
```

## 📊 Data Models & Schema

### Core Entities

```javascript
// Project Entity Schema
const ProjectSchema = {
  id: 'string',                     // UUID
  name: 'string',                   // Project display name
  description: 'string',            // Optional description
  driveFolderId: 'string',          // Google Drive folder ID (nullable)
  localPath: 'string',              // Local cache directory path
  createdAt: 'Date',                // Creation timestamp
  updatedAt: 'Date',                // Last modification
  lastSyncedAt: 'Date',             // Last successful sync (nullable)
  syncStatus: ['synced', 'pending', 'error'], // Status options
  settings: 'ProjectSettings',      // Project-specific settings
  owner: 'string'                   // User ID from OAuth
};

// File Metadata Entity Schema
const FileMetadataSchema = {
  id: 'string',                    // UUID
  projectId: 'string',             // Reference to project
  path: 'string',                  // Relative path within project
  name: 'string',                  // File name
  size: 'number',                  // File size in bytes
  hash: 'string',                  // SHA-256 hash for change detection
  mtime: 'Date',                   // Last modified timestamp
  driveFileId: 'string',           // Google Drive file ID (nullable)
  syncStatus: ['synced', 'pending', 'conflict', 'error'], // Status options
  conflictData: 'ConflictInfo',    // Conflict resolution data (optional)
  isDirectory: 'boolean',          // Directory flag
  permissions: 'FilePermissions'   // Access permissions
};

// User Session Entity Schema
const SessionSchema = {
  sessionId: 'string',             // UUID
  userId: 'string',                // User identifier from OAuth
  email: 'string',                 // User email
  tokenRef: 'string',              // Encrypted token reference
  workspaceId: 'string',           // Current project ID
  createdAt: 'Date',               // Session start time
  lastActivity: 'Date',            // Last user activity
  settings: 'UserSettings',        // User preferences
  activeContainers: ['string']     // Running container IDs array
};

// Container/Runner Entity Schema
const RunnerMetadataSchema = {
  containerId: 'string',           // Docker container ID
  workspaceId: 'string',           // Associated project ID
  language: ['python', 'node', 'java', 'cpp'], // Supported languages
  image: 'string',                 // Docker image used
  createdAt: 'Date',               // Container creation time
  status: ['starting', 'running', 'stopped', 'error'], // Status options
  limits: 'ResourceLimits',        // CPU/memory constraints
  ports: ['PortMapping'],          // Exposed ports array
  environment: 'object',           // Environment variables object
  lastActivity: 'Date'             // Last execution time
};

// Supporting Schemas
const ResourceLimitsSchema = {
  memoryMB: 'number',              // Memory limit in MB
  cpus: 'number',                  // CPU limit (fractional)
  pidsLimit: 'number',             // Process limit
  timeoutMinutes: 'number',        // Execution timeout
  networkAccess: 'boolean'         // Internet access flag
};

const ConflictInfoSchema = {
  localHash: 'string',             // Local file hash
  remoteHash: 'string',            // Remote file hash
  commonAncestorHash: 'string',    // Base hash for 3-way merge (optional)
  conflictType: ['modify-modify', 'delete-modify', 'rename-rename'],
  detectedAt: 'Date',              // Conflict detection time
  resolutionOptions: ['string']    // Available resolution strategies array
};
```

### Database Schema (MongoDB)

```javascript
// Projects Collection
{
  _id: ObjectId,
  id: String,                    // UUID (indexed)
  name: String,
  driveFolderId: String,         // Indexed for Drive lookups
  localPath: String,
  createdAt: Date,
  lastSyncedAt: Date,
  owner: String,                 // Indexed for user queries
  settings: {
    defaultLanguage: String,
    autoSave: Boolean,
    syncInterval: Number
  }
}

// FileMetadata Collection
{
  _id: ObjectId,
  id: String,                    // UUID (indexed)
  projectId: String,             // Indexed, references Projects
  path: String,                  // Indexed for path queries
  hash: String,
  driveFileId: String,           // Indexed for Drive sync
  syncStatus: String,            // Indexed for sync queries
  mtime: Date
}

// Sessions Collection (TTL for auto-cleanup)
{
  _id: ObjectId,
  sessionId: String,             // UUID (indexed)
  userId: String,                // Indexed
  workspaceId: String,
  createdAt: Date,
  lastActivity: Date,            // TTL index for session cleanup
  tokenRef: String               // Encrypted
}

// Runners Collection (TTL for cleanup)
{
  _id: ObjectId,
  containerId: String,           // Indexed
  workspaceId: String,           // Indexed
  status: String,
  createdAt: Date,               // TTL index for container cleanup
  limits: {
    memoryMB: Number,
    cpus: Number
  }
}
```

## 🔌 API Design & Specifications

### REST API Endpoints

```yaml
# Authentication Endpoints
POST /api/v1/auth/google
  Description: Initiate Google OAuth flow
  Response: { authUrl: string, state: string }

GET /api/v1/auth/google/callback?code=...&state=...
  Description: Handle OAuth callback
  Response: { token: string, user: UserProfile }

POST /api/v1/auth/refresh
  Description: Refresh authentication token
  Headers: Authorization: Bearer <token>
  Response: { token: string, expiresIn: number }

# Project Management
GET /api/v1/projects
  Description: List user projects
  Headers: Authorization: Bearer <token>
  Response: { projects: Project[] }

POST /api/v1/projects
  Description: Create new project
  Body: { name: string, description?: string }
  Response: { project: Project }

GET /api/v1/projects/:id
  Description: Get project details
  Response: { project: Project }

DELETE /api/v1/projects/:id
  Description: Delete project
  Response: { success: boolean }

# File Operations
GET /api/v1/projects/:id/files
  Description: List project files
  Query: ?path=/optional/subdir
  Response: { files: FileMetadata[] }

GET /api/v1/projects/:id/files/*path
  Description: Read file content
  Response: { content: string, metadata: FileMetadata }

PUT /api/v1/projects/:id/files/*path
  Description: Write file content
  Body: { content: string }
  Response: { metadata: FileMetadata }

DELETE /api/v1/projects/:id/files/*path
  Description: Delete file
  Response: { success: boolean }

# Runner Management
POST /api/v1/runner/:projectId/start
  Description: Start execution container
  Body: { language: string, limits?: ResourceLimits }
  Response: { containerId: string, status: string }

POST /api/v1/runner/:projectId/stop
  Description: Stop container
  Response: { success: boolean }

GET /api/v1/runner/:projectId/status
  Description: Get container status
  Response: { containers: RunnerMetadata[] }

# Sync Operations
GET /api/v1/sync/status/:projectId
  Description: Get sync status and conflicts
  Response: { 
    status: string, 
    conflicts: ConflictInfo[],
    pendingFiles: number 
  }

POST /api/v1/sync/resolve/:projectId
  Description: Resolve sync conflicts
  Body: { 
    fileId: string, 
    resolution: 'keep-local' | 'keep-remote' | 'merge' 
  }
  Response: { success: boolean }
```

### WebSocket API Specifications

```yaml
# Terminal WebSocket
WS /api/v1/pty/:containerId
  Events:
    - input: { data: string }      # Terminal input
    - resize: { cols: number, rows: number }  # Terminal resize
    - output: { data: string }     # Terminal output
    - exit: { code: number }       # Process exit

# LSP WebSocket  
WS /api/v1/lsp/:projectId/:language
  Events:
    - initialize: LSPInitializeParams
    - request: { id: string, method: string, params: any }
    - response: { id: string, result?: any, error?: any }
    - notification: { method: string, params: any }

# File Sync WebSocket
WS /api/v1/sync/:projectId
  Events:
    - file-changed: { path: string, changeType: 'create' | 'update' | 'delete' }
    - sync-progress: { file: string, progress: number }
    - conflict-detected: { file: string, conflict: ConflictInfo }
    - sync-complete: { filesUpdated: number }
```

## 🐳 Container Architecture

### Docker Images Structure

```dockerfile
# Python Runner Base Image
FROM python:3.11-slim
RUN useradd -m -u 1000 coderunner
WORKDIR /workspace
USER coderunner
COPY requirements.txt .
RUN pip install -r requirements.txt
CMD ["/bin/bash"]

# Node.js Runner Base Image  
FROM node:18-alpine
RUN adduser -D -u 1000 coderunner
WORKDIR /workspace
USER coderunner
COPY package.json .
RUN npm install
CMD ["/bin/sh"]

# Java Runner Base Image
FROM openjdk:17-slim
RUN useradd -m -u 1000 coderunner
WORKDIR /workspace
USER coderunner
CMD ["/bin/bash"]
```

### Container Security Configuration

```yaml
# Docker Run Configuration
Security:
  - user: "1000:1000"           # Non-root user
  - read-only: true             # Read-only root filesystem
  - no-new-privileges: true     # Prevent privilege escalation
  - security-opt:
    - "no-new-privileges"
    - "seccomp=default"
  
Resource Limits:
  - memory: "512m"              # Memory limit
  - cpus: "0.5"                 # CPU limit  
  - pids-limit: 100             # Process limit
  - ulimits:
    - nofile: 1024:1024         # File descriptor limit

Network:
  - network: "none"             # No network by default
  - Or custom bridge for controlled access

Mounts:
  - "/workspace:/workspace:rw"  # Project files (writable)
  - "/tmp:/tmp:rw"             # Temporary space
  - Read-only mounts for system files
```

## 🔐 Security Architecture

### Authentication Flow

```
1. User clicks "Login with Google"
2. Frontend redirects to Google OAuth consent screen
3. User authorizes application with drive.file scope
4. Google redirects back with authorization code
5. Backend exchanges code for access/refresh tokens
6. Backend stores encrypted refresh token locally
7. Backend returns JWT session token to frontend
8. Frontend stores JWT in httpOnly cookie
9. All API requests include JWT for authentication
```

### Token Security

- **Storage:** Refresh tokens encrypted with AES-256 using environment key
- **Rotation:** Access tokens refreshed automatically before expiration
- **Scope:** Minimal Google Drive scope (drive.file only)
- **Session:** JWT tokens with 24-hour expiration
- **Revocation:** Support for token revocation and logout

### Container Security Layers

```
Layer 1: Docker Isolation
- Separate user namespaces
- Resource constraints (cgroups)
- Read-only root filesystem
- No privileged access

Layer 2: Network Security  
- No internet access by default
- Isolated container networks
- Firewall rules for port restrictions

Layer 3: File System Security
- Limited mount points
- No access to host filesystem
- Temporary storage only in /tmp
- Project files in controlled /workspace

Layer 4: Process Security
- Non-root user execution
- Process limits (PID constraints)
- No new privileges flag
- Seccomp filtering
```

### Data Security

- **Encryption at Rest:** Local cache files encrypted with user-specific key
- **Encryption in Transit:** HTTPS for all API calls, WSS for WebSockets
- **Input Validation:** All user inputs sanitized and validated
- **Path Security:** Prevention of directory traversal attacks
- **Content Security:** File type validation and size limits

## 🔄 File Synchronization Design

### Sync Engine Architecture

```javascript
class SyncEngine {
  // Core sync operations
  async syncProject(projectId) {
    // Returns SyncResult object
  }
  
  async detectConflicts(projectId) {
    // Returns array of ConflictInfo objects
  }
  
  async resolveConflict(fileId, strategy) {
    // Resolves conflict using specified strategy
  }
  
  // Background sync management
  startBackgroundSync(projectId) {
    // Start background sync for project
  }
  
  stopBackgroundSync(projectId) {
    // Stop background sync for project
  }
  
  getSyncStatus(projectId) {
    // Returns SyncStatus object
  }
}

// Sync Strategies Constants
const ResolutionStrategy = {
  KEEP_LOCAL: 'keep-local',
  KEEP_REMOTE: 'keep-remote', 
  THREE_WAY_MERGE: 'merge',
  MANUAL_MERGE: 'manual'
};
```

### Conflict Resolution Workflow

```
1. File Change Detection
   ├── Local file modified (hash change detected)
   ├── Remote file modified (Drive API webhook/polling)
   └── Compare timestamps and hashes

2. Conflict Analysis  
   ├── Identify conflict type (modify-modify, delete-modify, etc.)
   ├── Determine common ancestor (if available)
   └── Generate resolution options

3. User Notification
   ├── Show conflict dialog in UI
   ├── Present diff view for changes
   └── Offer resolution strategies

4. Conflict Resolution
   ├── Apply chosen strategy
   ├── Update local cache
   ├── Sync resolved version to Drive
   └── Update metadata and status
```

### Sync Status States

```javascript
const SyncStatus = {
  SYNCED: 'synced',           // Local matches remote
  PENDING: 'pending',         // Changes queued for upload
  SYNCING: 'syncing',         // Sync in progress
  CONFLICT: 'conflict',       // Manual resolution needed
  ERROR: 'error',             // Sync failed
  OFFLINE: 'offline'          // No network connection
};
```

## 📡 LSP Integration Design

### Language Server Architecture

```javascript
// LSP Server Manager
class LSPManager {
  constructor() {
    this.servers = new Map(); // Map<string, LanguageServer>
  }
  
  async startServer(projectId, language) {
    // Start language server for project and language
  }
  
  async stopServer(projectId, language) {
    // Stop language server for project and language
  }
  
  async proxyMessage(projectId, language, message) {
    // Proxy LSP message and return response
  }
  
  getServerStatus(projectId) {
    // Returns array of ServerStatus objects
  }
}

// Supported Languages Configuration
const LSP_CONFIGS = {
  python: {
    command: 'pyright-langserver',
    args: ['--stdio'],
    initializationOptions: {}
  },
  javascript: {
    command: 'typescript-language-server', // Note: Still use TS server as it supports JS
    args: ['--stdio'],
    initializationOptions: {
      preferences: {
        allowIncompleteCompletions: false,
        allowRenameOfImportPath: false,
        allowTextChangesInNewFiles: false,
        displayPartsForJSDoc: true,
        generateReturnInDocTemplate: true,
        includeAutomaticOptionalChainCompletions: true,
        includeCompletionsForModuleExports: true,
        quotePreference: 'auto'
      }
    }
  }
};
```

### LSP Message Flow

```
1. Editor Request (Frontend)
   ├── User triggers completion (Ctrl+Space)
   ├── Monaco sends completion request
   └── Frontend formats LSP message

2. WebSocket Proxy (Backend)
   ├── Receives LSP message via WebSocket
   ├── Routes to appropriate language server
   └── Maintains request/response correlation

3. Language Server Processing
   ├── LSP server analyzes code context
   ├── Generates completion suggestions
   └── Returns LSP response

4. Response Delivery  
   ├── Backend forwards response via WebSocket
   ├── Frontend receives and processes response
   └── Monaco displays completions to user
```

## 🔧 Development & Deployment Architecture

### Local Development Setup

```yaml
Development Environment:
  Prerequisites:
    - Node.js 18+ (LTS)
    - Docker Desktop
    - Git
    - Python 3.8+ (for language servers)
    
  Project Structure:
    /ai-ide/
    ├── frontend/           # React application  
    ├── backend/            # Node.js API server
    ├── runner-images/      # Docker configurations
    ├── docs/              # Project documentation
    └── docker-compose.dev.yml

  Development Commands:
    - `yarn install`       # Install dependencies
    - `yarn dev`          # Start development servers
    - `docker-compose up` # Start all services
    - `yarn test`         # Run test suites
```

### Production Deployment

```yaml
Deployment Options:
  1. Render.com:
    - Docker-based deployment
    - Automatic SSL certificates  
    - Environment variable management
    - GitHub integration for CI/CD
    
  2. Railway.app:
    - Git-based deployment
    - Built-in PostgreSQL/Redis
    - Custom domains support
    - Easy scaling options
    
  3. Self-hosted:
    - VPS with Docker Compose
    - Nginx reverse proxy
    - Let's Encrypt SSL
    - Manual updates required

Environment Configuration:
  Required Variables:
    - GOOGLE_CLIENT_ID
    - GOOGLE_CLIENT_SECRET  
    - JWT_SECRET
    - MONGODB_URI
    - ENCRYPTION_KEY
    - NODE_ENV=production
```

### Monitoring & Observability

```javascript
// Logging Strategy
const logger = {
  info: (message, metadata = {}) => {
    // Log info level message with metadata
  },
  warn: (message, metadata = {}) => {
    // Log warning level message with metadata
  },
  error: (error, metadata = {}) => {
    // Log error level message with metadata
  },
  debug: (message, metadata = {}) => {
    // Log debug level message with metadata
  }
};

// Metrics Collection
const metrics = {
  containerStartTime: (language, duration) => {
    // Record container start time metric
  },
  fileOperationTime: (operation, duration) => {
    // Record file operation duration
  },
  syncOperationSuccess: (projectId) => {
    // Record successful sync operation
  },
  apiRequestDuration: (endpoint, duration) => {
    // Record API request duration
  }
};

// Health Checks
GET /health
Response: {
  status: 'healthy' | 'unhealthy',
  timestamp: Date,
  services: {
    database: 'up' | 'down',
    docker: 'up' | 'down',
    googleDrive: 'up' | 'down'
  }
}
```

---

**Document Version:** 1.0  
**Last Updated:** October 1, 2025  
**Architecture Review:** Scheduled for Sprint 2