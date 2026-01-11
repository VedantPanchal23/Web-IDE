# Backend Setup Instructions

## Prerequisites
- Node.js 16+ installed  
- MongoDB installed and running (or MongoDB Atlas connection)
- Docker installed (for secure code execution)

## Backend Setup

1. **Install Dependencies:**
```bash
cd backend
npm install
```

2. **Environment Configuration:**
```bash
cp ../.env.example .env
```

Edit `.env` file with your configuration:
```bash
# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/ai-ide
MONGODB_TEST_URI=mongodb://localhost:27017/ai-ide-test

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Google Drive API
GOOGLE_DRIVE_API_KEY=your-google-drive-api-key

# Security
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Docker (for secure execution)
DOCKER_PYTHON_IMAGE=ai-ide-python
DOCKER_NODE_IMAGE=ai-ide-node
EXECUTION_TIMEOUT=30000
```

3. **Start Development Server:**
```bash
npm run dev
```

## Docker Universal Runner Image Setup

1. **Create Universal Runner Image (Python + Node.js + Java + C++):**
```bash
cd c:\Users\vedan\Desktop\PROJ
scripts\build-runners.bat
```

Or manually:
```bash
cd runner-images/universal
docker build -t ai-ide-universal-runner .
```

2. **Verify Image:**
```bash
docker images ai-ide-universal-runner
docker run --rm ai-ide-universal-runner bash -c "python3 --version && node --version && java --version && g++ --version"
```

## Development Commands

- `npm run dev` - Start development server with nodemon
- `npm run start` - Start production server
- `npm run test` - Run tests (when implemented)
- `npm run lint` - Run ESLint (when configured)

## API Endpoints
After starting the server, available endpoints:

- `GET /health` - Health check
- `POST /api/v1/auth/*` - Authentication endpoints
- `GET|POST|PUT|DELETE /api/v1/projects/*` - Project management
- `GET|PUT|DELETE /api/v1/files/*` - File operations
- `POST /api/v1/execution/*` - Code execution
- `POST /api/v1/sync/*` - Google Drive sync
- `POST /api/v1/lsp/*` - Language Server Protocol

## WebSocket Events
- `connection` / `disconnect` - Client connection management
- `terminal:input` - Terminal input from client
- `lsp:message` - LSP communication

## Next Steps
1. Run `npm install` in backend directory
2. Configure `.env` file
3. Start MongoDB service
4. Run `npm run dev`
5. Test endpoints at http://localhost:3001/health