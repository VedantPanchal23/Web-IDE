// Load environment variables FIRST
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend root directory
dotenv.config({ path: join(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { connectDatabase } from './utils/database.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';

// Import services
import terminalService from './services/terminal.service.js';
import dockerService from './services/docker.service.js';
import fileWatcherService from './services/fileWatcher.service.js';

// Import models
import { File } from './models/File.js';

// Import routes
import authRoutes from './controllers/auth.controller.js';
import projectRoutes from './controllers/projects.controller.js';
import fileRoutes from './controllers/files.controller.js';
import executionRoutes from './controllers/execution.controller.js';
import syncRoutes from './controllers/sync.controller.js';
import lspRoutes from './controllers/lsp.controller.js';
import searchRoutes from './controllers/search.controller.js';
import gitRoutes from './controllers/git.controller.js';
import aiRoutes from './controllers/ai.controller.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:']
      }
    }
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  })
);

app.use(compression());
app.use(limiter);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// HTML Preview endpoint - serve HTML files directly
app.get('/api/v1/preview/:userId/:projectId', async (req, res) => {
  logger.info('Preview endpoint hit!', { 
    params: req.params, 
    query: req.query,
    url: req.url 
  });
  
  try {
    const { userId, projectId } = req.params;
    const fileName = req.query.file; // Get filename from query parameter
    
    if (!fileName) {
      logger.warn('Missing file parameter');
      return res.status(400).send('Missing file parameter');
    }
    
    const path = await import('path');
    
    // First, let's see what files exist for this project
    const allFiles = await File.find({ project: projectId }).select('name path type').lean();
    logger.info('All files in project', { 
      projectId, 
      fileCount: allFiles.length,
      files: allFiles.map(f => ({ name: f.name, path: f.path, type: f.type }))
    });
    
    // Try multiple path variations
    const pathVariations = [
      fileName,                           // hello.html
      `/${fileName}`,                     // /hello.html
      fileName.replace(/^\//, ''),        // Remove leading slash
      path.basename(fileName)             // Just filename without any path
    ];
    
    logger.info('Trying path variations', { pathVariations });
    
    let file = null;
    for (const pathVar of pathVariations) {
      file = await File.findOne({
        path: pathVar,
        project: projectId,
        type: 'file'
      });
      if (file) {
        logger.info('Found file with path variation', { usedPath: pathVar });
        break;
      }
    }
    
    if (!file) {
      logger.warn('File not found in database', { 
        fileName, 
        projectId, 
        userId,
        triedPaths: pathVariations,
        availableFiles: allFiles.map(f => f.path)
      });
      return res.status(404).send(`File not found. Available files: ${allFiles.map(f => f.path).join(', ')}`);
    }
    
    // Get file content
    const content = file.content || '';
    const ext = path.extname(fileName).toLowerCase();
    
    logger.info('Serving file', { fileName, contentLength: content.length, ext });
    
    // Set content type based on extension
    const contentTypes = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.xml': 'application/xml'
    };
    
    res.setHeader('Content-Type', contentTypes[ext] || 'text/plain');
    res.send(content);
  } catch (error) {
    logger.error('Preview error', { error: error.message, stack: error.stack });
    res.status(500).send('Error loading file');
  }
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/execution', executionRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/lsp', lspRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/git', gitRoutes);
app.use('/api/v1/ai', aiRoutes);

// WebSocket handling for terminals, LSP, and file watching
io.on('connection', socket => {
  logger.info('Client connected', { socketId: socket.id });

  // File watcher registration
  socket.on('file-watcher:register', async ({ projectId, workspacePath, containerId }) => {
    try {
      logger.info('📝 File watcher registration request', { 
        socketId: socket.id, 
        projectId, 
        workspacePath, 
        containerId,
        hasContainerId: !!containerId 
      });
      
      // Register client for file events
      fileWatcherService.registerClient(projectId, socket);
      
      // Start watching if not already watching
      const status = fileWatcherService.getStatus();
      const isWatching = status.projects.includes(projectId);
      if (!isWatching) {
        await fileWatcherService.startWatching(projectId, workspacePath, {
          persistent: true,
          ignoreInitial: true
        });
        logger.info('File watcher started', { projectId, workspacePath });
      }
      
      // Start container sync if containerId is provided
      if (containerId) {
        logger.info('🔄 Starting container sync...', { projectId, containerId });
        await fileWatcherService.startContainerSync(projectId, containerId, 5000); // Sync every 5 seconds
        logger.info('✅ Container sync started', { projectId, containerId });
      } else {
        logger.warn('⚠️  No containerId provided, container sync will NOT run!', { projectId });
      }
      
      socket.emit('file-watcher:registered', { 
        success: true, 
        projectId,
        message: 'File watcher registered successfully' 
      });
    } catch (error) {
      logger.error('File watcher registration failed', { error: error.message, projectId });
      socket.emit('file-watcher:error', { 
        success: false, 
        error: error.message 
      });
    }
  });

  // File watcher unregistration
  socket.on('file-watcher:unregister', ({ projectId }) => {
    try {
      logger.info('File watcher unregistration request', { socketId: socket.id, projectId });
      fileWatcherService.unregisterClient(projectId, socket);
      
      // Check if there are any remaining clients for this project
      const status = fileWatcherService.getStatus();
      const projectClients = status.clientConnections.find(c => c.projectId === projectId);
      const clientCount = projectClients ? projectClients.clientCount : 0;
      
      if (clientCount === 0) {
        fileWatcherService.stopWatching(projectId);
        logger.info('File watcher stopped (no remaining clients)', { projectId });
      }
      
      socket.emit('file-watcher:unregistered', { 
        success: true, 
        projectId 
      });
    } catch (error) {
      logger.error('File watcher unregistration failed', { error: error.message, projectId });
    }
  });

  // Manual container sync trigger
  socket.on('file-watcher:sync-container', async ({ projectId, containerId }) => {
    try {
      logger.info('Manual container sync requested', { socketId: socket.id, projectId, containerId });
      
      if (!containerId) {
        // Try to get container ID from terminal service
        const terminalServiceModule = await import('./services/terminal.service.js');
        const terminalService = terminalServiceModule.default;
        const userTerminals = terminalService.getUserTerminals(socket.userId || socket.request.user?.id);
        const projectTerminal = userTerminals.find(t => t.projectId === projectId);
        if (projectTerminal && projectTerminal.container) {
          containerId = projectTerminal.container.id;
        }
      }

      if (containerId) {
        await fileWatcherService.syncContainerFilesystem(projectId, containerId);
        socket.emit('file-watcher:sync-complete', { success: true, projectId });
        logger.info('Manual container sync completed', { projectId, containerId });
      } else {
        socket.emit('file-watcher:sync-complete', { 
          success: false, 
          error: 'No container ID found' 
        });
      }
    } catch (error) {
      logger.error('Manual container sync failed', { error: error.message, projectId });
      socket.emit('file-watcher:sync-complete', { 
        success: false, 
        error: error.message 
      });
    }
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
    
    // Cleanup file watcher registrations
    const status = fileWatcherService.getStatus();
    if (status && status.projects) {
      for (const projectId of status.projects) {
        fileWatcherService.unregisterClient(projectId, socket);
      }
    }
  });

  // Terminal WebSocket handlers will be implemented in separate modules
  socket.on('terminal:input', data => {
    // Handle terminal input
    logger.debug('Terminal input received', { socketId: socket.id, data });
  });

  socket.on('lsp:message', data => {
    // Handle LSP messages
    logger.debug('LSP message received', { socketId: socket.id, data });
  });
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Check Docker health
    const dockerHealth = await dockerService.healthCheck();
    if (dockerHealth.status === 'healthy') {
      logger.info('🐳 Docker service is healthy');
    } else {
      logger.warn('⚠️ Docker service is not healthy', { error: dockerHealth.error });
    }

    // Initialize terminal service
    terminalService.initializeWebSocketServer(server);

    // Log file watcher service status
    logger.info('👁️ File Watcher Service initialized');

    server.listen(PORT, () => {
      logger.info(`🚀 AI-IDE Backend Server running on port ${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api/v1`);
      logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
      logger.info(`💻 Terminal WebSocket: ws://localhost:${PORT}/terminal`);
      logger.info(`👁️ File Watcher WebSocket: ws://localhost:${PORT}/socket.io (events: file-watcher:*)`);

      if (process.env.NODE_ENV === 'development') {
        logger.info('🔧 Development mode enabled');
        logger.info(`📁 CORS Origins: ${process.env.CORS_ORIGINS || 'http://localhost:3000'}`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop all file watchers
  const status = fileWatcherService.getStatus();
  if (status && status.projects) {
    for (const projectId of status.projects) {
      fileWatcherService.stopWatching(projectId);
    }
    logger.info('File watchers stopped');
  }
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Stop all file watchers
  const status = fileWatcherService.getStatus();
  if (status && status.projects) {
    for (const projectId of status.projects) {
      fileWatcherService.stopWatching(projectId);
    }
    logger.info('File watchers stopped');
  }
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at Promise', { reason, promise });
  process.exit(1);
});

startServer();

export { app, io };
