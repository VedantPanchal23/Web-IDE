import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import dockerService from './docker.service.js';
import fileWatcherService from './fileWatcher.service.js';
import sessionManager from '../lib/terminal/SessionManager.js';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../models/Project.js';
import { File } from '../models/File.js';
import { User } from '../models/User.js';
import { driveFileService } from './driveFile.service.js';

class TerminalService {
  constructor() {
    this.terminals = new Map(); // Track active terminals
    this.projectContainers = new Map(); // Track containers per user+project: "userId:projectId" -> container
    // Increase limit for development, use environment variable or default to 10
    this.maxTerminalsPerUser = parseInt(process.env.MAX_TERMINALS_PER_USER) || 10;
    
    // Start periodic cleanup task
    this.startPeriodicCleanup();
  }

  /**
   * Start periodic cleanup of stale terminals and unused containers
   */
  startPeriodicCleanup() {
    // Run cleanup every 5 minutes
    setInterval(async () => {
      try {
        await this.cleanupStaleTerminals();
        await this.cleanupUnusedContainers();
        sessionManager.cleanupExpiredSessions();
      } catch (error) {
        logger.error('Periodic cleanup error', { error: error.message });
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Cleanup containers that have no active terminals
   * GitHub Codespaces keeps containers alive even with no terminals,
   * but we'll clean up after 30 minutes of inactivity
   */
  async cleanupUnusedContainers() {
    const CONTAINER_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();

    for (const [containerKey, container] of this.projectContainers.entries()) {
      // Check if any active terminals are using this container
      const activeTerminals = Array.from(this.terminals.values()).filter(
        t => t.container.id === container.id
      );

      if (activeTerminals.length === 0) {
        // No active terminals, check last activity
        const lastActivity = container.lastActivity || container.createdAt || now;
        const idleTime = now - lastActivity;

        if (idleTime > CONTAINER_IDLE_TIMEOUT) {
          logger.info('🧹 Cleaning up idle container', {
            containerKey,
            containerId: container.id,
            idleMinutes: Math.floor(idleTime / 60000)
          });

          try {
            await dockerService.cleanupContainer(container.id);
            this.projectContainers.delete(containerKey);
          } catch (error) {
            logger.error('Failed to cleanup unused container', {
              containerKey,
              containerId: container.id,
              error: error.message
            });
          }
        }
      } else {
        // Update last activity time
        container.lastActivity = now;
        this.projectContainers.set(containerKey, container);
      }
    }
  }

  /**
   * Setup project workspace - initialize workspace with project files
   */
  async setupProjectWorkspace(container, userId, projectId) {
    try {
      logger.info('🔧 Setting up project workspace', { userId, projectId, containerId: container.id });

      // CRITICAL: Clear workspace first to ensure clean state
      logger.info('🧹 Clearing workspace for fresh sync', { projectId });
      const clearCommands = [
        'cd /workspace',
        'rm -rf *',  // Remove all files
        'find . -maxdepth 1 -name ".*" ! -name "." ! -name ".." -exec rm -rf {} + 2>/dev/null || true', // Safely remove hidden files
        'mkdir -p /workspace'
      ];

      for (const cmd of clearCommands) {
        try {
          await dockerService.executeCommand(container.id, cmd);
        } catch (cmdError) {
          // Silently ignore expected errors (like when no hidden files exist)
          logger.debug('Clear command completed', { cmd });
        }
      }

      // Load project files from Google Drive if not default project
      if (projectId && projectId !== 'default') {
        try {
          logger.info('📥 Loading project files from Google Drive', { projectId });
          await this.loadProjectFiles(container, userId, projectId);
          logger.info('✅ Project files loaded successfully', { projectId });
        } catch (fileError) {
          logger.error('❌ Failed to load project files', { 
            projectId, 
            error: fileError.message,
            stack: fileError.stack
          });
          // If loading fails, create a basic workspace
          await dockerService.executeCommand(container.id, 'echo "# Error loading project files" > /workspace/ERROR.txt');
        }
      } else {
        // For default project, create a welcome file
        logger.info('Creating default workspace', { projectId });
        const initCommands = [
          'cd /workspace',
          'echo "# AI-IDE Workspace" > README.md',
          'echo "Welcome to your development environment!" >> README.md',
          'echo "" >> README.md',
          'echo "Available languages:" >> README.md',
          'echo "- Python 3.11" >> README.md',
          'echo "- Node.js 18" >> README.md',
          'echo "- Java 17" >> README.md',
          'echo "- C/C++ (GCC)" >> README.md'
        ];

        for (const cmd of initCommands) {
          try {
            await dockerService.executeCommand(container.id, cmd);
          } catch (cmdError) {
            logger.warn('Init command failed (non-critical)', { cmd, error: cmdError.message });
          }
        }
      }

      // Set proper permissions
      await dockerService.executeCommand(container.id, 'chmod -R 777 /workspace');

      logger.info('✅ Project workspace setup complete', { userId, projectId });

    } catch (error) {
      logger.error('❌ Failed to setup project workspace', { 
        userId, 
        projectId, 
        containerId: container.id,
        error: error.message,
        stack: error.stack
      });
      // Don't throw - continue with terminal creation even if setup fails
    }
  }

  /**
   * Initialize workspace with basic files and project files if available
   */
  async initializeWorkspaceFiles(container, userId, projectId) {
    try {
      // Wait a moment for container to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create basic structure commands
      const initCommands = [
        'mkdir -p /workspace',
        'cd /workspace',
        // Create a welcome file
        'echo "# Welcome to AI-IDE Workspace" > README.md',
        'echo "" >> README.md',
        'echo "This is your persistent workspace directory." >> README.md',
        'echo "All files you create here will be saved automatically." >> README.md',
        'echo "" >> README.md',
        'echo "## Quick Start" >> README.md',
        'echo "- Create files: touch filename.ext" >> README.md',
        'echo "- Edit files: nano filename.ext or vi filename.ext" >> README.md',
        'echo "- List files: ls -la" >> README.md',
        'echo "- Run code: python file.py, node file.js, java ClassName, etc." >> README.md',
        'echo "" >> README.md'
      ];

      // If we have a real project, try to load its files
      if (projectId && projectId !== 'default') {
        try {
          await this.loadProjectFiles(container, userId, projectId);
        } catch (error) {
          logger.warn('Failed to load project files, continuing with basic workspace', { 
            projectId, 
            error: error.message 
          });
        }
      }

      // Execute initialization commands
      for (const command of initCommands) {
        try {
          await dockerService.executeCommand(container.id, command);
        } catch (cmdError) {
          logger.warn('Initialization command failed', { 
            command, 
            error: cmdError.message 
          });
        }
      }

      // Create language-specific sample files
      await this.createSampleFiles(container, container.language || 'bash');

      logger.info('Workspace initialized successfully', { 
        userId, 
        projectId, 
        containerId: container.id 
      });

    } catch (error) {
      logger.error('Failed to initialize workspace files', { 
        userId, 
        projectId, 
        containerId: container.id,
        error: error.message 
      });
    }
  }

  /**
   * Load project files from database/drive into workspace
   * SIMPLIFIED VERSION - Uses temp files instead of complex heredoc
   */
  async loadProjectFiles(container, userId, projectId) {
    const { tmpdir } = await import('os');
    const { writeFile, mkdir, rm } = await import('fs/promises');
    const { join } = await import('path');
    
    try {
      // Find the project
      const project = await Project.findOne({
        _id: projectId,
        owner: userId
      });

      if (!project) {
        logger.warn('Project not found', { projectId, userId });
        return;
      }

      logger.info('� Loading files for project', { 
        projectId, 
        projectName: project.name 
      });

      // Get all project files from database
      const files = await File.find({
        project: projectId,
        type: 'file'
      }).select('path content name');

      if (!files || files.length === 0) {
        logger.info('No files found in project', { projectId });
        return;
      }

      logger.info(`Loading ${files.length} files to container`, { projectId });

      // Create temp directory for files
      const tempDir = join(tmpdir(), `ide-files-${projectId}-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });

      try {
        // Filter out cache and build artifacts
        const validFiles = files.filter(file => {
          const path = file.path || '';
          // Skip cache directories, build artifacts, and other non-essential files
          const skipPatterns = [
            /\.cache/i,
            /node_modules/i,
            /\.git/i,
            /__pycache__/i,
            /\.pytest_cache/i,
            /\.mypy_cache/i,
            /target\/debug/i,
            /target\/release/i,
            /build\//i,
            /dist\//i,
            /\.gradle/i,
            /\.maven/i,
            /\.idea/i,
            /\.vscode/i,
            /\.DS_Store/i
          ];
          
          return !skipPatterns.some(pattern => pattern.test(path));
        });

        logger.info(`Filtered files: ${files.length} -> ${validFiles.length}`, { 
          projectId,
          skipped: files.length - validFiles.length 
        });

        // Write all files to temp directory
        for (const file of validFiles) {
          try {
            const content = file.content || '';
            let fileName = file.path.startsWith('/') ? file.path.substring(1) : file.path;
            
            // Remove null bytes and other invalid characters
            fileName = fileName.replace(/\0/g, '').replace(/[<>:"|?*\x00-\x1f]/g, '_');
            
            // Replace forward slashes with underscores
            fileName = fileName.replace(/\//g, '_');
            
            // Truncate excessively long filenames (Windows MAX_PATH is 260, leave room for temp dir)
            const maxLength = 200;
            if (fileName.length > maxLength) {
              const ext = fileName.lastIndexOf('.') > 0 ? fileName.substring(fileName.lastIndexOf('.')) : '';
              fileName = fileName.substring(0, maxLength - ext.length) + ext;
              logger.warn('Truncated long filename', { 
                original: file.path,
                truncated: fileName 
              });
            }
            
            const tempFilePath = join(tempDir, fileName);
            
            await writeFile(tempFilePath, content, 'utf8');
            
            logger.debug('Wrote temp file', { 
              fileName,
              tempFilePath,
              size: content.length 
            });
          } catch (fileError) {
            logger.error('Failed to write temp file', {
              path: file.path,
              error: fileError.message
            });
            // Continue with other files
          }
        }

        // Copy files to container using Docker API
        const tarModule = await import('tar-stream');
        const tar = tarModule.default || tarModule;
        const pack = tar.pack();

        logger.info('Creating tar archive with project files...', { fileCount: validFiles.length });

        // Add each file to tar
        for (const file of validFiles) {
          try {
            const content = file.content || '';
            let filePath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
            
            // Remove null bytes and sanitize path
            filePath = filePath.replace(/\0/g, '');
            
            // Create directories if needed
            const dirPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
            if (dirPath) {
              try {
                await dockerService.executeCommand(container.id, `mkdir -p /workspace/${dirPath}`);
              } catch (mkdirErr) {
                logger.debug('mkdir failed (may already exist)', { dirPath });
              }
            }

            // Add file to tar stream
            pack.entry({ name: filePath }, content);
            
            logger.debug('✅ Added file to tar', { 
              path: filePath,
              size: content.length
            });
          } catch (fileError) {
            logger.error('Failed to add file to tar', {
              path: file.path,
              error: fileError.message
            });
            // Continue with other files
          }
        }

        pack.finalize();

        logger.info('Tar archive created, uploading to container...');

        // Put tar into container - USE container.container (dockerode object)
        const dockerContainer = container.container || container;
        
        if (!dockerContainer || typeof dockerContainer.putArchive !== 'function') {
          throw new Error('Container object does not have putArchive method');
        }
        
        await dockerContainer.putArchive(pack, { path: '/workspace' });

        logger.info('✅ Archive uploaded successfully');

        logger.info(`✅ Successfully loaded ${files.length} files to container`, { projectId });

      } finally {
        // Cleanup temp directory
        try {
          await rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp directory', { error: cleanupError.message });
        }
      }

    } catch (error) {
      logger.error('❌ Failed to load project files', { 
        projectId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Sync files from Google Drive to MongoDB
   * This ensures container gets the latest files from Drive
   */
  async syncDriveToDatabase(projectId, driveFolderId, userId) {
    try {
      logger.info('📥 Starting Google Drive to MongoDB sync', { 
        projectId, 
        driveFolderId 
      });

      // Recursively list all files in Drive folder
      const driveFiles = await this.listDriveFilesRecursive(driveFolderId, '');
      
      logger.info(`Found ${driveFiles.length} files in Google Drive`, { projectId });

      // Sync each file to MongoDB
      let syncedCount = 0;
      let errorCount = 0;

      for (const driveFile of driveFiles) {
        try {
          // Skip folders (they're handled by the recursive structure)
          if (driveFile.mimeType === 'application/vnd.google-apps.folder') {
            continue;
          }

          // Download file content from Drive
          const content = await driveFileService.getFileContent(driveFile.id);
          
          // Convert Buffer to string if needed
          const contentString = Buffer.isBuffer(content) ? content.toString('utf-8') : content;

          // Update or create in MongoDB
          await File.findOneAndUpdate(
            {
              project: projectId,
              driveId: driveFile.id
            },
            {
              name: driveFile.name,
              content: contentString,
              type: 'file',
              path: driveFile.path,
              driveId: driveFile.id,
              syncStatus: 'synced',
              lastModified: new Date(driveFile.modifiedTime),
              size: driveFile.size || 0
            },
            { upsert: true, new: true }
          );

          syncedCount++;
          logger.debug(`✅ Synced file: ${driveFile.path}`, { projectId });

        } catch (fileError) {
          errorCount++;
          logger.error(`❌ Failed to sync file: ${driveFile.path}`, {
            projectId,
            driveFileId: driveFile.id,
            error: fileError.message
          });
        }
      }

      logger.info('✅ Google Drive sync completed', {
        projectId,
        totalFiles: driveFiles.length,
        synced: syncedCount,
        errors: errorCount
      });

      return { success: true, syncedCount, errorCount };

    } catch (error) {
      logger.error('❌ Google Drive sync failed', {
        projectId,
        driveFolderId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Recursively list all files in a Drive folder with their paths
   */
  async listDriveFilesRecursive(folderId, currentPath = '') {
    const allFiles = [];

    try {
      // List files in current folder
      const files = await driveFileService.listFiles(folderId, 1000);

      for (const file of files) {
        const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
        
        // Add file with its path
        allFiles.push({
          ...file,
          path: `/${filePath}`
        });

        // If it's a folder, recursively get its contents
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          const subFiles = await this.listDriveFilesRecursive(file.id, filePath);
          allFiles.push(...subFiles);
        }
      }

      return allFiles;

    } catch (error) {
      logger.error('Failed to list Drive folder recursively', {
        folderId,
        currentPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create language-specific sample files
   */
  async createSampleFiles(container, language) {
    try {
      const sampleFiles = {
        python: {
          'hello.py': '#!/usr/bin/env python3\nprint("Hello from Python!")\nprint("Your workspace is ready for Python development.")\n',
          'requirements.txt': '# Add your Python dependencies here\n# requests>=2.25.1\n# flask>=2.0.0\n'
        },
        javascript: {
          'hello.js': 'console.log("Hello from Node.js!");\nconsole.log("Your workspace is ready for JavaScript development.");\n',
          'package.json': '{\n  "name": "workspace",\n  "version": "1.0.0",\n  "description": "AI-IDE Workspace",\n  "main": "hello.js",\n  "scripts": {\n    "start": "node hello.js"\n  }\n}\n'
        },
        node: {
          'hello.js': 'console.log("Hello from Node.js!");\nconsole.log("Your workspace is ready for JavaScript development.");\n',
          'package.json': '{\n  "name": "workspace",\n  "version": "1.0.0",\n  "description": "AI-IDE Workspace",\n  "main": "hello.js",\n  "scripts": {\n    "start": "node hello.js"\n  }\n}\n'
        },
        java: {
          'Hello.java': 'public class Hello {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n        System.out.println("Your workspace is ready for Java development.");\n    }\n}\n'
        },
        cpp: {
          'hello.cpp': '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from C++!" << endl;\n    cout << "Your workspace is ready for C++ development." << endl;\n    return 0;\n}\n',
          'Makefile': 'CXX=g++\nCXXFLAGS=-Wall -std=c++17\n\nhello: hello.cpp\n\t$(CXX) $(CXXFLAGS) -o hello hello.cpp\n\nclean:\n\trm -f hello\n\n.PHONY: clean\n'
        },
        c: {
          'hello.c': '#include <stdio.h>\n\nint main() {\n    printf("Hello from C!\\n");\n    printf("Your workspace is ready for C development.\\n");\n    return 0;\n}\n',
          'Makefile': 'CC=gcc\nCFLAGS=-Wall -std=c99\n\nhello: hello.c\n\t$(CC) $(CFLAGS) -o hello hello.c\n\nclean:\n\trm -f hello\n\n.PHONY: clean\n'
        }
      };

      const files = sampleFiles[language] || {};
      
      for (const [filename, content] of Object.entries(files)) {
        try {
          const escapedContent = content.replace(/'/g, "'\\''");
          await dockerService.executeCommand(container.id, `echo '${escapedContent}' > /workspace/${filename}`);
        } catch (error) {
          logger.warn('Failed to create sample file', { filename, error: error.message });
        }
      }

    } catch (error) {
      logger.error('Failed to create sample files', { language, error: error.message });
    }
  }

  /**
   * Sync files from container back to database (called periodically or on terminal close)
   */
  async syncFilesFromContainer(terminalId) {
    try {
      const terminal = this.terminals.get(terminalId);
      if (!terminal || !terminal.container || terminal.projectId === 'default') {
        return;
      }

      logger.info('Syncing files from container to database', { 
        terminalId, 
        projectId: terminal.projectId,
        userId: terminal.userId 
      });

      // Get list of files in container workspace
      // FIX: terminal.container already has the Dockerode container object (not .container.container)
      const exec = await terminal.container.container.exec({
        Cmd: ['find', '/workspace', '-type', 'f', '-name', '*'],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start({ hijack: true });
      
      let output = '';
      stream.on('data', (data) => {
        // Remove Docker stream headers if present
        if (data.length >= 8 && (data[0] === 0x01 || data[0] === 0x02)) {
          const payloadSize = data.readUInt32BE(4);
          output += data.slice(8, 8 + payloadSize).toString();
        } else {
          output += data.toString();
        }
      });

      await new Promise((resolve) => {
        stream.on('end', resolve);
      });

      const filePaths = output.trim().split('\n')
        .filter(path => path && path !== '/workspace')
        .map(path => path.replace('/workspace/', ''))
        .filter(path => path && !path.startsWith('.') && path !== 'workspace'); // Filter out hidden files and duplicates

      if (filePaths.length === 0) {
        logger.info('No files to sync from container', { terminalId });
        return;
      }

      // Download files from container
      const containerFiles = await dockerService.downloadFiles(terminal.container.id, filePaths);
      
      // Update database with new/modified files
      for (const file of containerFiles) {
        try {
          const filePath = `/${file.name}`;
          
          // Check if file exists in database
          let dbFile = await File.findOne({
            project: terminal.projectId,
            path: filePath
          });

          if (dbFile) {
            // Update existing file if content changed
            if (dbFile.content !== file.content) {
              dbFile.content = file.content;
              dbFile.syncStatus = 'pending'; // Mark for Drive sync
              dbFile.lastModified = new Date();
              await dbFile.save();
              logger.info('Updated file in database', { filePath, projectId: terminal.projectId });
            }
          } else {
            // Create new file
            dbFile = new File({
              project: terminal.projectId,
              path: filePath,
              name: file.name.split('/').pop(),
              content: file.content,
              type: 'file',
              syncStatus: 'pending'
            });
            await dbFile.save();
            logger.info('Created new file in database', { filePath, projectId: terminal.projectId });
          }
        } catch (fileError) {
          logger.error('Error syncing file to database', { 
            fileName: file.name,
            error: fileError.message 
          });
        }
      }

      logger.info('File sync from container completed', { 
        terminalId,
        syncedFiles: containerFiles.length 
      });

    } catch (error) {
      // Suppress 404 errors (container already cleaned up)
      const isContainerGone = error.statusCode === 404 || error.message.includes('No such container');
      
      if (isContainerGone) {
        logger.debug('Container not found during sync (already removed)', { terminalId });
      } else {
        logger.error('Failed to sync files from container', { 
          terminalId,
          error: error.message 
        });
      }
    }
  }

  /**
   * Clean up stale terminals (inactive for more than 30 minutes)
   */
  async cleanupStaleTerminals() {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    const staleTerminals = [];

    for (const [terminalId, terminal] of this.terminals.entries()) {
      const inactiveTime = now - terminal.lastActivity.getTime();
      
      if (inactiveTime > staleThreshold) {
        staleTerminals.push(terminalId);
      }
    }

    if (staleTerminals.length > 0) {
      logger.info('Cleaning up stale terminals', { 
        staleCount: staleTerminals.length,
        totalTerminals: this.terminals.size 
      });

      for (const terminalId of staleTerminals) {
        await this.forceCleanupTerminal(terminalId);
      }
    }

    return staleTerminals.length;
  }

  /**
   * Initialize WebSocket server for terminals
   */
  initializeWebSocketServer(server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/terminal'
    });

    this.wss.on('connection', (ws, req) => {
      logger.info('Terminal WebSocket connection established', { 
        ip: req.socket.remoteAddress 
      });

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          logger.info('Terminal WebSocket message received', { 
            type: data.type, 
            terminalId: data.terminalId,
            dataLength: data.data ? data.data.length : 0
          });
          await this.handleMessage(ws, data);
        } catch (error) {
          logger.error('Terminal WebSocket message error', { error: error.message });
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Invalid message format' 
          }));
        }
      });

      ws.on('close', () => {
        this.cleanup(ws);
        logger.info('Terminal WebSocket connection closed');
      });

      ws.on('error', (error) => {
        logger.error('Terminal WebSocket error', { error: error.message });
        this.cleanup(ws);
      });
    });

    logger.info('Terminal WebSocket server initialized');
  }

  /**
   * Handle WebSocket messages
   */
  async handleMessage(ws, data) {
    const { type, ...payload } = data;

    try {
      switch (type) {
        case 'create':
          await this.createTerminal(ws, payload);
          break;
        
        case 'input':
          await this.sendInput(ws, payload);
          break;
        
        case 'resize':
          await this.resizeTerminal(ws, payload);
          break;
        
        case 'destroy':
          await this.destroyTerminal(ws, payload);
          break;
        
        default:
          logger.warn('Unknown terminal message type', { type });
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: `Unknown message type: ${type}` 
          }));
      }
    } catch (error) {
      logger.error('Terminal message handler error', { type, error: error.message });
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: error.message 
      }));
    }
  }

  /**
   * Get or create a container for a user+project combination
   * This implements GitHub Codespaces-style container reuse
   */
  async getOrCreateProjectContainer(userId, projectId, language) {
    const containerKey = `${userId}:${projectId}`;
    
    // Check if we already have a container for this user+project
    if (this.projectContainers.has(containerKey)) {
      const existingContainer = this.projectContainers.get(containerKey);
      
      try {
        // Verify container is still running
        const containerInfo = await existingContainer.container.inspect();
        if (containerInfo.State.Running) {
          logger.info('♻️ Reusing existing container', { 
            containerKey, 
            containerId: existingContainer.id,
            status: 'running'
          });
          return existingContainer;
        } else {
          logger.warn('Container exists but not running, removing from cache', {
            containerKey,
            containerId: existingContainer.id,
            status: containerInfo.State.Status
          });
          this.projectContainers.delete(containerKey);
        }
      } catch (error) {
        // Suppress 404 errors (container already removed)
        const isContainerGone = error.statusCode === 404 || error.message.includes('No such container');
        
        if (isContainerGone) {
          logger.debug('Container not found (already removed), creating new one', { containerKey });
        } else {
          logger.warn('Container inspection failed, removing from cache', {
            containerKey,
            error: error.message
          });
        }
        this.projectContainers.delete(containerKey);
      }
    }
    
    // Create new container
    logger.info('🐳 Creating new project container', { containerKey, language });
    const container = await dockerService.createContainer(userId, language, {
      isTerminal: true,
      projectId: projectId,
      Tty: true,
      OpenStdin: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true
    });
    
    // Store in cache
    this.projectContainers.set(containerKey, container);
    logger.info('✅ Container cached for reuse', { containerKey, containerId: container.id });
    
    return container;
  }

  /**
   * Create a new terminal session
   */
  async createTerminal(ws, { userId, sessionId, language = 'bash', projectId }) {
    try {
      // DEBUG: Log what we received
      logger.info('🔍 CREATE TERMINAL DEBUG', { 
        userId, 
        sessionId, 
        language, 
        projectId,
        projectIdType: typeof projectId,
        projectIdValue: projectId 
      });
      
      // Handle undefined projectId
      const safeProjectId = projectId || 'default';
      logger.info('🔍 Using safeProjectId:', { safeProjectId });
      
      // Check terminal limits
      const userTerminals = this.getUserTerminals(userId);
      if (userTerminals.length >= this.maxTerminalsPerUser) {
        // Clean up any dead terminals first
        await this.cleanupDeadTerminals(userId);
        const cleanedUserTerminals = this.getUserTerminals(userId);
        if (cleanedUserTerminals.length >= this.maxTerminalsPerUser) {
          throw new Error(`Maximum terminal limit reached (${this.maxTerminalsPerUser})`);
        }
      }

      let terminalId = sessionId || `${userId}-${safeProjectId}-${uuidv4()}`;
      
      // Check for session recovery
      if (sessionId && sessionManager.canRecover(sessionId)) {
        const sessionData = sessionManager.getSessionData(sessionId);
        logger.info('Attempting to recover terminal session', { terminalId, sessionData: sessionData ? 'found' : 'not-found' });
        
        // If we can recover, use the existing session ID
        terminalId = sessionId;
      } else if (this.terminals.has(terminalId)) {
        // Check if terminal with this ID already exists
        logger.warn('Terminal ID already exists, generating new one', { terminalId, userId });
        terminalId = uuidv4();
        logger.info('Generated new terminal ID', { oldId: sessionId || terminalId, newId: terminalId });
      }

      // Get or reuse container for this user+project (GitHub Codespaces style)
      const container = await this.getOrCreateProjectContainer(userId, safeProjectId, language);
      logger.info('📦 Using container', { 
        terminalId, 
        containerId: container.id,
        containerKey: `${userId}:${safeProjectId}`
      });

      // Wait a moment for container to be fully ready (only needed for new containers)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify container is running (with retry for slow-starting containers)
      let containerInfo;
      let retries = 3;
      while (retries > 0) {
        containerInfo = await container.container.inspect();
        if (containerInfo.State.Running) {
          break;
        }
        
        logger.warn('Container not ready, retrying...', { 
          terminalId, 
          containerId: container.id,
          status: containerInfo.State.Status,
          retriesLeft: retries - 1
        });
        
        if (retries === 1) {
          // Last retry - try to start the container if it's not running
          if (containerInfo.State.Status === 'exited' || containerInfo.State.Status === 'created') {
            logger.info('Attempting to start stopped container', { containerId: container.id });
            await container.container.start();
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw new Error(`Container is not running: ${containerInfo.State.Status}`);
          }
        }
        
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (!containerInfo.State.Running) {
        throw new Error(`Container failed to start after retries: ${containerInfo.State.Status}`);
      }

      // Setup workspace files if this is first terminal for this container
      const containerKey = `${userId}:${safeProjectId}`;
      if (!container.workspaceInitialized) {
        await this.setupProjectWorkspace(container, userId, safeProjectId);
        container.workspaceInitialized = true; // Mark as initialized
        this.projectContainers.set(containerKey, container); // Update cache
      }

      // Execute bash shell inside the container
      logger.info('🔌 Executing bash in container', { 
        terminalId, 
        containerState: containerInfo.State.Status, 
        language 
      });
      
      // Create exec instance with proper TTY settings
      const exec = await container.container.exec({
        Cmd: ['/bin/bash'],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Env: [
          'TERM=xterm-256color',
          'HOME=/workspace',
          'PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin',
          'PYTHONUNBUFFERED=1',
          'NODE_ENV=development',
          'JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64'
        ],
        WorkingDir: '/workspace'
      });
      
      // Start the exec with proper stream handling
      const stream = await exec.start({
        hijack: true,
        stdin: true,
        Tty: true
      });
      
      logger.info('✅ Bash shell started successfully', { terminalId });

      // Store terminal info
      const terminal = {
        id: terminalId,
        userId,
        projectId: safeProjectId,
        language,
        container,
        exec,
        stream,
        ws,
        createdAt: new Date(),
        lastActivity: new Date()
      };

      this.terminals.set(terminalId, terminal);
      ws.terminalId = terminalId;

      // Create session record for persistence
      sessionManager.createSession(terminalId, {
        userId,
        projectId: safeProjectId,
        language,
        containerId: container.id
      });

      // CRITICAL: Start SIMPLE container sync for file changes made via terminal
      try {
        const { simpleFileSyncService } = await import('./simpleFileSync.service.js');
        // Pass the actual Docker ID, not the custom UUID
        const dockerContainerId = container.dockerId || container.container.id;
        await simpleFileSyncService.startContainerSync(safeProjectId, dockerContainerId);
        logger.info('✅ SIMPLE container sync started for terminal', { 
          terminalId, 
          projectId: safeProjectId, 
          containerId: container.id,
          dockerContainerId 
        });
      } catch (syncError) {
        logger.warn('Failed to start container sync (non-critical)', {
          error: syncError.message,
          terminalId,
          projectId: safeProjectId
        });
      }

      // Terminal starts in /workspace via WorkingDir setting - no commands needed

      // Handle container output - Direct TTY stream (no Docker headers with Tty:true)
      stream.on('data', (data) => {
        try {
          // With Tty:true, Docker sends raw terminal output without headers
          const output = data.toString();
          
          if (output && output.length > 0) {
            // Update last activity
            if (terminal) {
              terminal.lastActivity = new Date();
            }
            
            // Send directly to WebSocket
            if (ws && ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: 'output',
                terminalId,
                data: output
              }));
            }
          }
        } catch (error) {
          logger.error('Error processing terminal output', { 
            terminalId, 
            error: error.message 
          });
        }
      });

      stream.on('end', () => {
        const terminal = this.terminals.get(terminalId);
        if (terminal && !terminal.destroying) {
          logger.info('Terminal stream ended', { terminalId, reason: 'container_stopped' });
          // Mark terminal as disconnected but don't destroy immediately
          terminal.streamEnded = true;
          terminal.lastActivity = new Date();
          
          // Notify frontend of disconnection
          // WebSocket.OPEN = 1 (ws.OPEN is undefined in ws library)
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'disconnected',
              terminalId,
              message: 'Terminal container stopped'
            }));
          }
        }
      });

      stream.on('error', (error) => {
        logger.error('Terminal stream error', { terminalId, error: error.message });
        // WebSocket.OPEN = 1 (ws.OPEN is undefined in ws library)
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'error',
            terminalId,
            message: 'Terminal connection lost'
          }));
        }
      });

      // Send success response
      // WebSocket.OPEN = 1 (ws.OPEN is undefined in ws library)
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'created',
          terminalId,
          language,
          containerId: container.id
        }));
      } else {
        logger.error('Cannot send created message - WebSocket not open', {
          terminalId,
          readyState: ws.readyState
        });
      }

      logger.info('Terminal created successfully', { 
        terminalId, 
        userId, 
        language,
        containerId: container.id
      });

    } catch (error) {
      logger.error('Failed to create terminal', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Send input to terminal
   */
  async sendInput(ws, { terminalId, data }) {
    try {
      logger.debug('Attempting to send input to terminal', {
        terminalId,
        dataLength: data ? data.length : 0,
        activeTerminals: this.terminals.size
      });

      const terminal = this.terminals.get(terminalId);
      if (!terminal) {
        logger.warn('Terminal not found in active terminals', { 
          terminalId, 
          activeTerminalIds: Array.from(this.terminals.keys()).slice(0, 5) // Limit log size
        });
        
        // Send terminal not found error to frontend so it can handle it
        // WebSocket.OPEN = 1 (ws.OPEN is undefined in ws library)
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'error',
            terminalId: terminalId,
            error: 'TERMINAL_NOT_FOUND',
            message: 'Terminal session expired. Please refresh the terminal.',
            activeTerminals: Array.from(this.terminals.keys())
          }));
        }
        return; // Don't throw, just return after sending error
      }

      // Validate terminal ownership
      if (terminal.ws !== ws) {
        logger.error('Unauthorized terminal access attempt', { 
          terminalId, 
          expectedWsId: terminal.ws?.id || 'unknown',
          actualWsId: ws.id || 'unknown'
        });
        
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'error',
            terminalId,
            message: 'Unauthorized terminal access'
          }));
        }
        return;
      }

      // Update last activity
      terminal.lastActivity = new Date();
      sessionManager.updateActivity(terminalId);

      // Send input to container with error handling
      logger.debug('Terminal stream status', {
        terminalId,
        hasStream: !!terminal.stream,
        isWritable: terminal.stream ? terminal.stream.writable : false
      });
      
      if (terminal.stream && terminal.stream.writable) {
        try {
          terminal.stream.write(data);
          logger.debug('Input sent to terminal', { terminalId });
        } catch (writeError) {
          logger.error('Write error in terminal stream', { 
            terminalId, 
            error: writeError.message
          });
          
          // Clean up terminal on write error
          this.terminals.delete(terminalId);
          
          // Notify frontend
          // WebSocket.OPEN = 1 (ws.OPEN is undefined in ws library)
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'error',
              terminalId,
              message: 'Terminal connection lost. Please reconnect.'
            }));
          }
          return; // Don't throw, just return
        }
      } else {
        // Stream not writable - try to recreate it
        logger.warn('Terminal stream not writable, attempting to recreate', {
          terminalId,
          hasStream: !!terminal.stream,
          streamDestroyed: terminal.stream ? terminal.stream.destroyed : 'no-stream'
        });
        
        // Try to recreate the stream
        try {
          // Verify container still exists before trying to recreate
          if (!terminal.container || !terminal.container.container) {
            throw new Error('Container reference lost');
          }

          // Check if container still exists in Docker
          try {
            const containerInfo = await terminal.container.container.inspect();
            if (!containerInfo.State.Running) {
              throw new Error(`Container not running (status: ${containerInfo.State.Status})`);
            }
          } catch (inspectError) {
            if (inspectError.statusCode === 404) {
              throw new Error('Container no longer exists in Docker');
            }
            throw inspectError;
          }

          // Create new exec instance with proper TTY settings
          const exec = await terminal.container.container.exec({
            Cmd: ['/bin/bash'],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            Env: [
              'TERM=xterm-256color',
              'HOME=/workspace',
              'PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin'
            ],
            WorkingDir: '/workspace'
          });
          
          // Start the exec with proper stream handling
          const stream = await exec.start({
            hijack: true,
            stdin: true,
            Tty: true
          });
          
          // Update terminal with new exec and stream
          terminal.exec = exec;
          terminal.stream = stream;
          
          // Setup stream handlers
          stream.on('data', (data) => {
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: 'output',
                terminalId,
                data: data.toString()
              }));
            }
          });
          
          stream.on('end', () => {
            logger.debug('Terminal stream ended', { terminalId });
          });
          
          logger.info('Terminal stream recreated successfully', { terminalId });
          
          // Now try to write the data again
          if (stream.writable) {
            stream.write(data);
            logger.info('Stream recreated and input sent', { terminalId });
            return;
          }
        } catch (recreateError) {
          logger.error('Failed to recreate terminal stream', {
            terminalId,
            error: recreateError.message
          });
          
          // Clean up the terminal from our tracking
          this.terminals.delete(terminalId);
          
          // Send specific error message based on error type
          let errorMessage = 'Terminal session ended. Please reconnect.';
          if (recreateError.message.includes('Container no longer exists')) {
            errorMessage = 'Container has been stopped. Please create a new terminal session.';
          } else if (recreateError.message.includes('not running')) {
            errorMessage = 'Container is not running. Please restart the terminal.';
          }
          
          // Send error to frontend
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'error',
              terminalId,
              message: errorMessage
            }));
          }
          
          return; // Don't try to cleanup further
        }
        
        // If recreation failed for other reasons, send error to frontend
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'error',
            terminalId,
            message: 'Terminal session ended. Please reconnect.'
          }));
        }
        
        // Mark terminal for cleanup after a delay
        setTimeout(() => {
          this.destroyTerminal(ws, { terminalId }).catch(error => {
            logger.debug('Cleanup after stream failure', { terminalId });
          });
        }, 2000);
        
        return; // Don't throw error that would crash the server
      }

    } catch (error) {
      logger.error('Unexpected error in sendInput function', { 
        terminalId, 
        error: error.message,
        stack: error.stack 
      });
      
      // Never let terminal errors crash the server
      // WebSocket.OPEN = 1 (ws.OPEN is undefined in ws library)
      if (ws && ws.readyState === 1) {
        try {
          ws.send(JSON.stringify({
            type: 'error',
            terminalId,
            message: 'Internal terminal error. Please reconnect.'
          }));
        } catch (sendError) {
          logger.error('Failed to send error message to client', { error: sendError.message });
        }
      }
      
      // Clean up terminal
      if (terminalId) {
        this.terminals.delete(terminalId);
      }
      
      // Don't re-throw the error - just log and handle gracefully
    }
  }

  /**
   * Resize terminal
   */
  async resizeTerminal(ws, { terminalId, cols, rows }) {
    try {
      const terminal = this.terminals.get(terminalId);
      if (!terminal) {
        throw new Error('Terminal not found');
      }

      if (terminal.ws !== ws) {
        throw new Error('Unauthorized terminal access');
      }

      // Resize container TTY
      await terminal.container.container.resize({ w: cols, h: rows });

      logger.debug('Terminal resized', { terminalId, cols, rows });

    } catch (error) {
      logger.error('Failed to resize terminal', { terminalId, error: error.message });
      // Don't throw - resize failures are not critical
    }
  }

  /**
   * Destroy terminal session (NOT the container - container is shared)
   */
  async destroyTerminal(ws, { terminalId }) {
    try {
      const terminal = this.terminals.get(terminalId);
      if (!terminal) {
        return; // Already destroyed
      }

      if (terminal.ws !== ws) {
        throw new Error('Unauthorized terminal access');
      }

      // Mark as being destroyed to prevent unexpected end warnings
      terminal.destroying = true;

      // Sync files from container to database before cleanup
      try {
        await this.syncFilesFromContainer(terminalId);
      } catch (syncError) {
        logger.error('Error syncing files during terminal destruction', { 
          terminalId, 
          error: syncError.message 
        });
      }

      // No intervals to clear - heartbeat mechanism removed

      // Close stream gracefully
      if (terminal.stream && !terminal.stream.destroyed) {
        terminal.stream.end();
      }

      // DO NOT cleanup container - it's shared across terminals (GitHub Codespaces style)
      // Container will be cleaned up when all terminals for that project are closed
      // or after inactivity timeout
      logger.info('🔌 Terminal session closed (container remains active for reuse)', { 
        terminalId,
        containerId: terminal.container.id,
        containerKey: `${terminal.userId}:${terminal.projectId}`
      });

      // Remove from tracking
      this.terminals.delete(terminalId);
      
      // Remove session record
      sessionManager.removeSession(terminalId);

      // Notify client
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'destroyed',
          terminalId
        }));
      }

      logger.info('Terminal session destroyed', { terminalId });

    } catch (error) {
      logger.error('Failed to destroy terminal', { terminalId, error: error.message });
      throw error;
    }
  }

  /**
   * Clean up all terminals for a WebSocket connection
   */
  cleanup(ws) {
    const terminalsToClean = [];
    
    // Find all terminals associated with this WebSocket
    for (const [terminalId, terminal] of this.terminals.entries()) {
      if (terminal.ws === ws) {
        terminalsToClean.push(terminalId);
      }
    }

    logger.info('Cleaning up terminals for WebSocket', { 
      terminalsToClean,
      totalActiveTerminals: this.terminals.size
    });

    // Clean up each terminal
    terminalsToClean.forEach(terminalId => {
      this.forceCleanupTerminal(terminalId).catch(error => {
        logger.error('Terminal cleanup error', { terminalId, error: error.message });
      });
    });
  }

  /**
   * Get terminals for a specific user
   */
  getUserTerminals(userId) {
    return Array.from(this.terminals.values()).filter(
      terminal => terminal.userId === userId
    );
  }

  /**
   * Clean up all terminals for a user
   */
  async cleanupUserTerminals(userId) {
    const userTerminals = this.getUserTerminals(userId);
    await Promise.all(
      userTerminals.map(terminal => 
        this.destroyTerminal(terminal.ws, { terminalId: terminal.id })
      )
    );
  }


  /**
   * List all active terminals
   */
  listTerminals(userId = null) {
    const terminals = Array.from(this.terminals.values());
    
    if (userId) {
      return terminals.filter(terminal => terminal.userId === userId);
    }

    return terminals.map(terminal => ({
      id: terminal.id,
      userId: terminal.userId,
      projectId: terminal.projectId,
      language: terminal.language,
      createdAt: terminal.createdAt,
      lastActivity: terminal.lastActivity
    }));
  }


  /**
   * Clean up dead terminals for a user
   */
  async cleanupDeadTerminals(userId) {
    const userTerminals = this.getUserTerminals(userId);
    const deadTerminals = [];

    for (const terminal of userTerminals) {
      try {
        // Check if container is still running
        if (terminal.container && terminal.container.container) {
          const containerInfo = await terminal.container.container.inspect();
          if (!containerInfo.State.Running) {
            deadTerminals.push(terminal.id);
          }
        } else {
          deadTerminals.push(terminal.id);
        }
      } catch (error) {
        // If we can't inspect the container, assume it's dead
        deadTerminals.push(terminal.id);
      }
    }

    // Clean up dead terminals
    for (const terminalId of deadTerminals) {
      logger.info('Cleaning up dead terminal', { terminalId, userId });
      await this.forceCleanupTerminal(terminalId);
    }

    return deadTerminals.length;
  }

  /**
   * Force cleanup a terminal without WebSocket validation
   */
  async forceCleanupTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;

    try {
      // Close stream
      if (terminal.stream && !terminal.stream.destroyed) {
        terminal.stream.destroy();
      }

      // Cleanup container
      if (terminal.container && terminal.container.cleanup) {
        await terminal.container.cleanup();
      } else if (terminal.container && terminal.container.id) {
        // Fallback to dockerService cleanup
        await dockerService.cleanupContainer(terminal.container.id);
      }

      // Remove from map
      this.terminals.delete(terminalId);
      
      // Remove session record
      sessionManager.removeSession(terminalId);
      
      logger.info('Force cleanup completed', { terminalId });
    } catch (error) {
      logger.error('Error during force cleanup', { terminalId, error: error.message });
      // Still remove from map even if cleanup fails
      this.terminals.delete(terminalId);
    }
  }

  /**
   * Get shell command for language
   */
  getShellCommand(language) {
    const shellMap = {
      'bash': ['/bin/bash', '-i'], // Interactive bash
      'sh': ['/bin/sh', '-i'],     // Interactive sh
      'python': ['/bin/bash', '-i'], // Start with interactive bash, then can run python
      'node': ['/bin/bash', '-i'],   // Start with interactive bash, then can run node
      'javascript': ['/bin/bash', '-i']
    };
    
    return shellMap[language] || ['/bin/bash', '-i'];
  }

  /**
   * Get terminal statistics
   */
  getStats() {
    const terminals = Array.from(this.terminals.values());
    
    return {
      totalTerminals: terminals.length,
      terminalsByLanguage: terminals.reduce((acc, terminal) => {
        acc[terminal.language] = (acc[terminal.language] || 0) + 1;
        return acc;
      }, {}),
      terminalsByUser: terminals.reduce((acc, terminal) => {
        acc[terminal.userId] = (acc[terminal.userId] || 0) + 1;
        return acc;
      }, {}),
      averageAge: terminals.length > 0 
        ? terminals.reduce((sum, terminal) => 
            sum + (Date.now() - terminal.createdAt.getTime()), 0
          ) / terminals.length
        : 0
    };
  }

  /**
   * Sync a single file to all containers for a project
   * Called when a file is saved in the IDE
   */
  async syncFileToContainers(userId, projectId, filePath, content) {
    try {
      logger.info('Syncing file to container', { 
        userId, 
        projectId, 
        filePath
      });

      // Find the container for this user+project
      const containerKey = `${userId}:${projectId}`;
      const container = this.projectContainers.get(containerKey);
      
      if (!container) {
        logger.debug('No active container for project', { 
          userId, 
          projectId
        });
        return;
      }

      // Verify container still exists in Docker service
      const containerInfo = dockerService.containers.get(container.id);
      if (!containerInfo) {
        logger.warn('Container no longer exists in Docker service, removing from cache', {
          containerId: container.id,
          containerKey
        });
        this.projectContainers.delete(containerKey);
        return;
      }

      // Verify container is running
      try {
        const dockerContainer = dockerService.docker.getContainer(container.id);
        const inspection = await dockerContainer.inspect();
        
        if (!inspection.State.Running) {
          logger.warn('Container is not running, cannot sync file', {
            containerId: container.id,
            state: inspection.State.Status
          });
          return;
        }
      } catch (inspectError) {
        if (inspectError.statusCode === 404) {
          logger.warn('Container not found in Docker, removing from cache', {
            containerId: container.id,
            containerKey
          });
          this.projectContainers.delete(containerKey);
          return;
        }
        throw inspectError;
      }

      // Normalize file path
      const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      
      // Create directory structure if needed
      const dirPath = normalizedPath.includes('/') 
        ? normalizedPath.substring(0, normalizedPath.lastIndexOf('/')) 
        : '';
      
      if (dirPath) {
        await dockerService.executeCommand(
          container.id, 
          `mkdir -p /workspace/${dirPath}`
        );
      }

      // Write file content to container using tee (more reliable than heredoc)
      const base64Content = Buffer.from(content).toString('base64');
      await dockerService.executeCommand(
        container.id,
        `echo "${base64Content}" | base64 -d | tee /workspace/${normalizedPath} > /dev/null`
      );

      logger.info('File synced to container', { 
        filePath, 
        containerId: container.id
      });

    } catch (error) {
      logger.error('Failed to sync file to container', {
        userId,
        projectId,
        filePath,
        error: error.message
      });
      // Don't throw - this is a background operation
    }
  }
}

export default new TerminalService();