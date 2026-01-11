# 🚀 AI-IDE - Professional Web-Based Development Environment

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-%3E%3D20.10-blue)](https://www.docker.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Path3010%2FAI--IDE-blue?logo=github)](https://github.com/Path3010/AI-IDE)

> A powerful, local-first web IDE with AI assistance, cloud synchronization, and secure code execution. Built for developers who demand professional tools with enterprise-grade security.

---

## ✨ Key Features

### 🎨 **Advanced Code Editor**
- Monaco Editor (VS Code's editor) with full IntelliSense
- Multi-language syntax highlighting (Python, JavaScript, Java, C++, and more)
- Split editor support for side-by-side coding
- Real-time file watching and auto-refresh
- 28+ language support

### 🤖 **AI Code Assistant**
- **Powered by Groq** - Fast, free LLM integration
- Intelligent code completion with inline suggestions
- Context-aware code explanation and documentation
- AI-driven refactoring suggestions
- Interactive chat for coding help

### 💻 **Integrated Terminal**
- Browser-based terminal with full ANSI support
- Auto-detect programming languages from file extensions
- One-click code execution with live output
- Multiple terminal sessions support
- Real-time WebSocket streaming

### 🐳 **Universal Code Execution**
- Single Docker container for all languages (Python, Node.js, Java, C++)
- Secure sandboxing with resource limits
- Isolated execution environment
- Automatic dependency management
- File watching and hot reload

### ☁️ **Google Drive Integration**
- Seamless project storage and synchronization
- OAuth2 authentication
- Automatic backup and versioning
- Offline-first with background sync
- Share projects with collaborators

### 🔒 **Enterprise Security**
- Container isolation for code execution
- Non-root user execution
- Resource limits (CPU, memory, time)
- Encrypted token storage
- Rate limiting and DDoS protection

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │   Monaco   │  │   xterm.js │  │  AI Chat   │  │   Drive    │  │
│  │   Editor   │  │  Terminal  │  │ Assistant  │  │   Sync     │ │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │
│         React + Vite + WebSocket + REST API                      │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────┴──────────────────────────────────────┐
│                       Backend Layer (Node.js)                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │    Auth    │  │    File    │  │     AI     │  │  Execution │  │
│  │  Service   │  │  Service   │  │  Service   │  │  Service   │  │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │
│         Express + MongoDB + Google APIs + WebSocket              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────┴──────────────────────────────────────┐
│                    Execution Layer (Docker)                      │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │         Universal Container (Alpine Linux)               │    │
│  │  Python 3.11  │  Node.js 18  │  Java 17  │  G++ 12       │    │
│  │  Isolated Execution │  Resource Limits │  Security       │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

<table>
<tr>
<td width="50%">

### **Frontend**
- **Framework:** React + Vite
- **Editor:** Monaco Editor (VS Code)
- **Terminal:** xterm.js + xterm-addon-fit
- **Styling:** Modern CSS3
- **State Management:** React Context API
- **HTTP Client:** Axios
- **WebSocket:** Native WebSocket API

</td>
<td width="50%">

### **Backend**
- **Runtime:** Node.js 
- **Framework:** Express.js 
- **Database:** MongoDB 
- **Authentication:** Google OAuth2
- **Storage:** Google Drive API v3
- **AI Engine:** Groq API (llama-3.3-70b)
- **Real-time:** WebSocket (ws)

</td>
</tr>
<tr>
<td width="50%">

### **Infrastructure**
- **Containerization:** Docker 24+
- **Orchestration:** Docker Compose
- **Base Image:** Alpine Linux 3.18
- **Languages:** Python 3.11, Node 18, Java 17, GCC 12

</td>
<td width="50%">

### **Security**
- **Isolation:** Docker containers
- **Encryption:** bcrypt + crypto
- **Rate Limiting:** express-rate-limit
- **CORS:** Configured domains
- **Helmet:** Security headers

</td>
</tr>
</table>

---

## � Quick Start Guide

### Prerequisites

Ensure you have the following installed:

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | ≥18.0.0 LTS | Backend & Frontend runtime |
| **Docker Desktop** | ≥20.10 | Code execution containers |
| **Git** | Latest | Version control |
| **MongoDB** | ≥6.0 (optional) | Database (or use MongoDB Atlas) |

### Installation Steps

#### 1️⃣ Clone Repository
```bash
git clone https://github.com/Path3010/AI-IDE.git
cd AI-IDE
```

#### 2️⃣ Configure Environment
```bash
# Backend configuration
cd backend
cp .env.example .env

```

#### 3️⃣ Build Docker Image
```bash
# Windows
scripts\build-runners.bat

# Linux/Mac
chmod +x scripts/build-runners.sh
./scripts/build-runners.sh
```

#### 4️⃣ Start Services
```bash
# Development mode (recommended)
cd backend
npm install
nodemon

# In a new terminal
cd frontend
npm install
npm run dev
```

#### 5️⃣ Access Application
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/health

### Quick Setup Script (Windows)
```cmd
scripts\setup-tools.bat
scripts\start-dev.bat
```

---

## 📁 Project Structure

```
AI-IDE/
├── 📂 frontend/                    # React application
│   ├── src/
│   │   ├── components/            # UI components
│   │   │   ├── EnhancedMonacoEditor.jsx   # Code editor
│   │   │   ├── Terminal.jsx               # Integrated terminal
│   │   │   ├── AIAssistant.jsx            # AI chat interface
│   │   │   ├── FileExplorer.jsx           # File tree
│   │   │   └── SplitEditor.jsx            # Split view editor
│   │   ├── services/              # API clients
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── context/               # Global state
│   │   └── App.jsx                # Main application
│   └── package.json
│
├── 📂 backend/                     # Node.js API server
│   ├── src/
│   │   ├── controllers/           # Route handlers
│   │   │   ├── auth.controller.js         # Authentication
│   │   │   ├── execution.controller.js    # Code execution
│   │   │   ├── file.controller.js         # File operations
│   │   │   └── ai.controller.js           # AI features
│   │   ├── services/              # Business logic
│   │   │   ├── execution.service.js       # Docker management
│   │   │   ├── fileWatcher.service.js     # File monitoring
│   │   │   └── ai.service.js              # Groq integration
│   │   ├── lib/                   # Core libraries
│   │   │   ├── containerManager.js        # Container lifecycle
│   │   │   ├── terminalManager.js         # WebSocket terminals
│   │   │   └── driveService.js            # Google Drive API
│   │   ├── middleware/            # Express middleware
│   │   ├── models/                # MongoDB schemas
│   │   └── index.js               # Server entry point
│   └── package.json
│
├── 📂 runner-images/               # Docker configurations
│   └── universal/                 # Universal runtime
│       ├── Dockerfile             # Multi-language container
│       └── entrypoint.sh          # Container startup
│
├── 📂 scripts/                     # Automation scripts
│   ├── build-runners.bat          # Build Docker images (Windows)
│   ├── build-runners.sh           # Build Docker images (Linux/Mac)
│   ├── start-dev.bat              # Start development
│   └── diagnose-issues.bat        # System diagnostics
│
├── 📂 docs/                        # Documentation
│   ├── features/                  # Feature guides
│   ├── project-requirements.md    # Requirements specification
│   ├── project-design.md          # System design
│   └── SETUP_GOOGLE_OAUTH.md      # OAuth setup guide
│
├── 📂 infra/                       # Infrastructure
│   ├── docker-compose.dev.yml     # Development compose
│   └── mongodb/                   # Database setup
│
├── .gitignore                      # Git ignore rules
├── package.json                    # Root package config
├── README.md                       # This file
└── LICENSE                         # MIT License
```

---

## 🧪 Development & Testing

### Frontend Development
```bash
cd frontend
npm install
npm run dev          # Start Vite dev server (localhost:3000)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Backend Development
```bash
cd backend
npm install
npm run dev          # Start with nodemon (localhost:3001)
npm run start        # Production server
npm test             # Run tests
npm run lint         # Run ESLint
```

### Docker Operations
```bash
# Build universal runner
docker build -t ai-ide-universal-runner runner-images/universal/

# Test container
docker run --rm ai-ide-universal-runner python3 --version

# Check running containers
docker ps

# View logs
docker logs <container_id>

# Clean up
docker system prune -a
```

### Testing Commands
```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 🔐 Security Features

| Feature | Implementation | Status |
|---------|---------------|--------|
| **Container Isolation** | Docker sandboxing | ✅ Active |
| **Resource Limits** | CPU/Memory/Time constraints | ✅ Active |
| **Non-root Execution** | Unprivileged user (coderunner) | ✅ Active |
| **Network Isolation** | No internet access in containers | ✅ Active |
| **Token Encryption** | bcrypt + crypto for OAuth tokens | ✅ Active |
| **Rate Limiting** | 100 requests/15min per IP | ✅ Active |
| **CORS Protection** | Whitelist allowed origins | ✅ Active |
| **Security Headers** | Helmet.js middleware | ✅ Active |
| **Input Validation** | Sanitization & validation | ✅ Active |
| **Audit Logging** | All actions logged | ✅ Active |

### Container Security Configuration
```dockerfile
# Non-root user
USER coderunner

# Resource limits
--memory=512m
--cpus=1.0
--pids-limit=100

# Network isolation
--network=none

# Read-only root filesystem
--read-only

# Security options
--security-opt=no-new-privileges
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && npm test

# E2E tests
npm run test:e2e
```

---

## 📚 Documentation

### Feature Documentation
- **[Code Editor](docs/features/EDITOR.md)** - Monaco editor, syntax highlighting, IntelliSense
- **[Terminal](docs/features/TERMINAL.md)** - Integrated terminal, WebSocket, auto-detection
- **[AI Assistant](docs/features/AI_ASSISTANT.md)** - Groq integration, code completion, chat
- **[Code Execution](docs/features/EXECUTION.md)** - Docker containers, universal runtime
- **[File Management](docs/features/FILES.md)** - File explorer, CRUD operations, file watching
- **[Google Drive](docs/features/DRIVE_SYNC.md)** - OAuth, sync, offline support
- **[Authentication](docs/features/AUTH.md)** - JWT, session management, security

### Project Documentation
- **[Requirements](docs/project-requirements.md)** - Functional and technical requirements
- **[Design](docs/project-design.md)** - System architecture and API specifications
- **[Work Plan](docs/project-work.md)** - Sprint breakdown and implementation plan
- **[OAuth Setup](docs/SETUP_GOOGLE_OAUTH.md)** - Google Cloud Console configuration

---

## 🎯 Usage Examples

### Creating a New Project
```javascript
// From the IDE interface:
1. Click "New Project" in File Explorer
2. Enter project name
3. Choose template (Python, Node.js, Java, C++)
4. Start coding!
```

### Running Code
```python
# Write your code in the editor
print("Hello from AI-IDE!")

# Click the "Run" button or use:
# - Ctrl+Enter (Windows/Linux)
# - Cmd+Enter (Mac)

# Output appears in the integrated terminal
```

### Using AI Assistant
```javascript
// 1. Inline completion
function calculateSum(   // Wait 800ms, AI suggests completion

// 2. Chat assistant
// Click AI icon → Ask: "Explain async/await in JavaScript"

// 3. Code explanation
// Select code → Right-click → "Explain Code"

// 4. Refactoring
// Select code → Right-click → "Get Refactoring Suggestions"
```

### File Synchronization
```bash
# All changes auto-sync to Google Drive
# Status indicator shows sync progress
# Offline changes sync when connection restored
```

---

## 🚀 Deployment

### Production Build
```bash
# Build frontend
cd frontend
npm run build
# Output: frontend/dist/

# Build backend (if needed)
cd backend
npm run build 
```

### Docker Compose Production
```bash
# Start all services
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Cloud Platforms

#### **Render**
```yaml
# render.yaml
services:
  - type: web
    name: ai-ide-backend
    env: docker
    dockerfilePath: ./backend/Dockerfile
    
  - type: web
    name: ai-ide-frontend
    env: docker
    dockerfilePath: ./frontend/Dockerfile
```

#### **Railway**
```bash
# Deploy with Railway CLI
railway init
railway up
```

#### **Self-Hosted VPS**
```bash
# Clone repository
git clone https://github.com/Path3010/AI-IDE.git

# Setup environment
cd AI-IDE
cp backend/.env.example backend/.env
# Edit .env with production credentials

# Start with Docker Compose
docker-compose up -d

# Setup NGINX reverse proxy (optional)
sudo apt install nginx
# Configure NGINX for https://yourdomain.com
```

### Environment Variables (Production)
```env
# Backend (.env)
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://...
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GROQ_API_KEY=your_groq_key
SESSION_SECRET=strong_random_secret
FRONTEND_URL=https://yourdomain.com

# Frontend (build time)
VITE_API_URL=https://api.yourdomain.com
```

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Getting Started
1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create** a feature branch: `git checkout -b feature/your-feature-name`
4. **Make** your changes following our coding standards
5. **Test** your changes thoroughly
6. **Commit** with clear messages: `git commit -m "Add: feature description"`
7. **Push** to your fork: `git push origin feature/your-feature-name`
8. **Open** a Pull Request with detailed description

### Coding Standards
- **Style Guide**: Follow ESLint + Prettier configurations
- **Naming**: Use camelCase for variables, PascalCase for components
- **Comments**: Document complex logic with JSDoc
- **Testing**: Write unit tests for new features
- **Commits**: Use conventional commit messages (feat:, fix:, docs:)

### Pull Request Guidelines
- Keep PRs focused on a single feature/fix
- Include tests for new functionality
- Update documentation as needed
- Ensure all CI checks pass
- Respond to review feedback promptly

### Areas Needing Help
- 🐛 Bug fixes and testing
- 📖 Documentation improvements
- 🌐 Internationalization (i18n)
- ♿ Accessibility enhancements
- 🎨 UI/UX improvements
- ⚡ Performance optimizations

## 🙏 Acknowledgments

- **Monaco Editor** - VS Code's editor in the browser
- **xterm.js** - Terminal emulator for the web
- **Docker** - Container platform for secure execution
- **Google Drive API** - Cloud storage integration
- **Open Source Community** - For amazing tools and libraries

### Contributors
Special thanks to all contributors who have helped build and improve AI-IDE!

---

## 📊 Performance Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Initial Load Time | < 2s | ✅ |
| Code Execution | < 500ms | ✅ |
| AI Response Time | < 2s | ✅ |
| File Sync Latency | < 1s | ✅ |
| Container Startup | < 1s | ✅ |

---

## 🗺️ Roadmap

### Future Enhancements
- Real-time collaboration
- Git integration
- Debugger support
- Plugin system
- Mobile support

---

## 📞 Support & Contact

- **📖 Documentation**: [docs/](docs/) folder
- **🐛 Issues**: [GitHub Issues](https://github.com/Path3010/AI-IDE/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/Path3010/AI-IDE/discussions)

---

<div align="center">

### ⭐ Star us on GitHub!

**Built with ❤️ by developers, for developers**

*Empowering coders with AI-powered development tools*

[Report Bug](https://github.com/Path3010/AI-IDE/issues) • [Request Feature](https://github.com/Path3010/AI-IDE/issues) • [Documentation](docs/)

</div>