import chokidar from 'chokidar';
import { logger } from '../utils/logger.js';
import { File } from '../models/File.js';
import { Project } from '../models/Project.js';
import path from 'path';
import fs from 'fs/promises';
import { driveFileService } from './driveFile.service.js';

/**
 * File Watcher Service - Real-time file system monitoring
 * Watches container workspaces and notifies clients of changes via WebSocket
 */
class FileWatcherService {
  constructor() {
    this.watchers = new Map(); // projectId -> watcher instance
    this.watcherClients = new Map(); // projectId -> Set of WebSocket clients
    this.syncIntervals = new Map(); // projectId -> interval timer for container sync
  }

  /**
   * Start watching a project's workspace
   * @param {string} projectId - Project ID
   * @param {string} workspacePath - Path to workspace directory (in container or local)
   * @param {Object} options - Watch options
   */
  startWatching(projectId, workspacePath, options = {}) {
    // Check if already watching
    if (this.watchers.has(projectId)) {
      logger.debug('Already watching project', { projectId });
      return;
    }

    try {
      const watcher = chokidar.watch(workspacePath, {
        ignored: [
          /(^|[\/\\])\../, // Ignore dotfiles
          '**/node_modules/**',
          '**/.git/**',
          '**/*.log',
          '**/*.tmp',
          '**/DumpStack.log.tmp', // Windows system file
          'C:\\DumpStack.log.tmp', // Absolute path for Windows
          /DumpStack\.log\.tmp$/, // Pattern match
          '**/__pycache__/**', // Python cache
          '**/.next/**', // Next.js build
          '**/dist/**', // Build output
          '**/build/**' // Build output
        ],
        persistent: true,
        ignoreInitial: true, // Don't emit events for existing files on startup
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100
        },
        ...options
      });

      // File added
      watcher.on('add', async (filePath) => {
        try {
          const relativePath = path.relative(workspacePath, filePath);
          const stats = await fs.stat(filePath);
          
          logger.info('File added', { projectId, file: relativePath });
          
          this.notifyClients(projectId, {
            type: 'file-added',
            projectId,
            filePath: `/${relativePath}`,
            file: {
              path: `/${relativePath}`,
              name: path.basename(filePath),
              size: stats.size,
              modifiedAt: stats.mtime
            }
          });

          // Optionally sync to database
          await this.syncFileToDatabase(projectId, filePath, workspacePath);
        } catch (error) {
          logger.error('Error handling file add event', {
            projectId,
            file: filePath,
            error: error.message
          });
        }
      });

      // File changed
      watcher.on('change', async (filePath) => {
        try {
          const relativePath = path.relative(workspacePath, filePath);
          const stats = await fs.stat(filePath);
          
          logger.info('File changed', { projectId, file: relativePath });
          
          this.notifyClients(projectId, {
            type: 'file-changed',
            projectId,
            filePath: `/${relativePath}`,
            file: {
              path: `/${relativePath}`,
              name: path.basename(filePath),
              size: stats.size,
              modifiedAt: stats.mtime
            }
          });

          // Optionally sync to database
          await this.syncFileToDatabase(projectId, filePath, workspacePath);
        } catch (error) {
          logger.error('Error handling file change event', {
            projectId,
            file: filePath,
            error: error.message
          });
        }
      });

      // File deleted
      watcher.on('unlink', async (filePath) => {
        try {
          const relativePath = path.relative(workspacePath, filePath);
          
          logger.info('File deleted', { projectId, file: relativePath });
          
          this.notifyClients(projectId, {
            type: 'file-deleted',
            projectId,
            filePath: `/${relativePath}`,
            file: {
              path: `/${relativePath}`,
              name: path.basename(filePath)
            }
          });

          // Optionally mark as deleted in database
          await this.markFileAsDeleted(projectId, `/${relativePath}`);
        } catch (error) {
          logger.error('Error handling file delete event', {
            projectId,
            file: filePath,
            error: error.message
          });
        }
      });

      // Directory added
      watcher.on('addDir', async (dirPath) => {
        try {
          const relativePath = path.relative(workspacePath, dirPath);
          if (relativePath) { // Ignore root workspace
            logger.info('Directory added', { projectId, dir: relativePath });
            
            this.notifyClients(projectId, {
              type: 'dir-added',
              projectId,
              dirPath: `/${relativePath}`,
              dir: {
                path: `/${relativePath}`,
                name: path.basename(dirPath)
              }
            });

            // Sync folder to database and Google Drive
            await this.syncFolderToDatabase(projectId, dirPath, workspacePath);
          }
        } catch (error) {
          logger.error('Error handling dir add event', {
            projectId,
            dir: dirPath,
            error: error.message
          });
        }
      });

      // Directory deleted
      watcher.on('unlinkDir', async (dirPath) => {
        try {
          const relativePath = path.relative(workspacePath, dirPath);
          if (relativePath) {
            logger.info('Directory deleted', { projectId, dir: relativePath });
            
            this.notifyClients(projectId, {
              type: 'dir-deleted',
              projectId,
              dirPath: `/${relativePath}`,
              dir: {
                path: `/${relativePath}`,
                name: path.basename(dirPath)
              }
            });
          }
        } catch (error) {
          logger.error('Error handling dir delete event', {
            projectId,
            dir: dirPath,
            error: error.message
          });
        }
      });

      // Error handling
      watcher.on('error', (error) => {
        // Suppress common Windows system file errors
        const isIgnorableError = error.code === 'EBUSY' || 
                                 error.message.includes('DumpStack.log.tmp') ||
                                 error.message.includes('resource busy or locked');
        
        if (isIgnorableError) {
          logger.debug('File watcher: ignoring system file error', { 
            projectId, 
            error: error.message 
          });
        } else {
          logger.error('File watcher error', { 
            projectId, 
            error: error.message,
            code: error.code 
          });
        }
      });

      this.watchers.set(projectId, watcher);
      this.watcherClients.set(projectId, new Set());

      logger.info('Started file watching', { projectId, path: workspacePath });
    } catch (error) {
      logger.error('Failed to start file watching', {
        projectId,
        path: workspacePath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Stop watching a project's workspace
   * @param {string} projectId - Project ID
   */
  async stopWatching(projectId) {
    const watcher = this.watchers.get(projectId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(projectId);
      this.watcherClients.delete(projectId);
      logger.info('Stopped file watching', { projectId });
    }
    
    // Stop container sync interval if exists
    const syncInterval = this.syncIntervals.get(projectId);
    if (syncInterval) {
      clearInterval(syncInterval);
      this.syncIntervals.delete(projectId);
      logger.info('Stopped container sync interval', { projectId });
    }
  }

  /**
   * Start periodic container filesystem sync for Docker containers
   * Since chokidar can't watch inside Docker volumes, we poll the container
   * @param {string} projectId - Project ID
   * @param {string} containerId - Docker container ID
   * @param {number} intervalMs - Sync interval in milliseconds (default 5000ms = 5s)
   */
  async startContainerSync(projectId, containerId, intervalMs = 5000) {
    // Don't start if already syncing
    if (this.syncIntervals.has(projectId)) {
      logger.debug('Container sync already running', { projectId });
      return;
    }

    logger.info('Starting container filesystem sync', { projectId, containerId, intervalMs });

    // Import docker service dynamically to avoid circular dependency (default export)
    const dockerServiceModule = await import('./docker.service.js');
    const dockerService = dockerServiceModule.default;

    // Initial sync
    await this.syncContainerFilesystem(projectId, containerId);

    // Set up periodic sync
    const interval = setInterval(async () => {
      try {
        await this.syncContainerFilesystem(projectId, containerId);
      } catch (error) {
        logger.error('Container sync failed', {
          projectId,
          containerId,
          error: error.message
        });
      }
    }, intervalMs);

    this.syncIntervals.set(projectId, interval);
  }

  /**
   * Stop periodic container sync
   * @param {string} projectId - Project ID
   */
  stopContainerSync(projectId) {
    const interval = this.syncIntervals.get(projectId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(projectId);
      logger.info('Stopped container sync', { projectId });
    }
  }

  /**
   * Sync container filesystem to database and Google Drive
   * Scans /workspace in container and syncs all files/folders
   * @param {string} projectId - Project ID
   * @param {string} containerId - Docker container ID
   */
  async syncContainerFilesystem(projectId, containerId) {
    logger.info('🔄 Container sync started', { projectId, containerId });
    
    try {
      // Import docker service (default export)
      const dockerServiceModule = await import('./docker.service.js');
      const dockerService = dockerServiceModule.default;

      // Find the Docker container - try multiple methods
      let container = null;
      let dockerId = null;
      
      // Method 1: Check service registry
      const containerInfo = dockerService.containers.get(containerId);
      if (containerInfo && containerInfo.container) {
        container = containerInfo.container;
        dockerId = containerInfo.dockerId || container.id;
        logger.info('✅ Found container in registry', { projectId, containerId, dockerId });
      } else {
        // Method 2: Search all Docker containers by name
        logger.info('🔍 Searching Docker for container...', { containerId });
        const allContainers = await dockerService.docker.listContainers({ all: true });
        const matchingContainer = allContainers.find(c => 
          c.Names && c.Names.some(name => name.includes(containerId))
        );
        
        if (matchingContainer) {
          dockerId = matchingContainer.Id;
          container = dockerService.docker.getContainer(dockerId);
          logger.info('✅ Found container in Docker', { 
            projectId, 
            containerId, 
            dockerId: dockerId.slice(0, 12),
            state: matchingContainer.State 
          });
        } else {
          logger.warn('⚠️ Container not found anywhere', { 
            projectId, 
            containerId,
            availableContainers: allContainers.length
          });
          return;
        }
      }

      // Check if container is running
      const inspectInfo = await container.inspect();
      if (!inspectInfo.State.Running) {
        logger.warn('⚠️ Container not running', { 
          projectId, 
          containerId,
          state: inspectInfo.State.Status 
        });
        return;
      }
      
      logger.info('✅ Container is running, scanning filesystem...', { projectId, containerId });

      // List all files in container's /workspace (both files and directories)
      // Use the container object directly (not docker.getContainer with UUID)
      const exec = await container.exec({
        Cmd: ['find', '/workspace', '-mindepth', '1'],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      
      let output = '';
      stream.on('data', (chunk) => {
        output += chunk.toString('utf8');
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      // Parse file list - Docker streams have 8-byte headers
      const paths = output
        .split('\n')
        .map(line => {
          // Remove Docker stream headers (8 bytes) and ANSI codes
          return line.replace(/^[\x00-\x08]+/, '').replace(/\x1b\[[0-9;]*m/g, '').trim();
        })
        .filter(path => path && path !== '/workspace' && !path.includes('find:'));

      if (paths.length === 0) {
        logger.info('📂 No files in container workspace', { projectId, containerId });
        return;
      }

      logger.info('📁 Found files in container', { 
        projectId, 
        containerId,
        count: paths.length, 
        files: paths 
      });

      // Get all existing files from database
      const existingFiles = await File.find({ project: projectId });
      const existingPaths = new Set(existingFiles.map(f => f.path));

      // Process each path
      for (const containerPath of paths) {
        try {
          const relativePath = containerPath.replace('/workspace', '');
          
          // Skip if already in database with recent sync
          if (existingPaths.has(relativePath)) {
            const existing = existingFiles.find(f => f.path === relativePath);
            if (existing && existing.lastModified) {
              const age = Date.now() - new Date(existing.lastModified).getTime();
              if (age < 10000) { // Skip if synced in last 10 seconds
                continue;
              }
            }
          }

          // Check if it's a file or directory
          const statExec = await container.exec({
            Cmd: ['stat', '-c', '%F', containerPath],
            AttachStdout: true,
            AttachStderr: true
          });

          const statStream = await statExec.start({ hijack: true, stdin: false });
          let statOutput = '';
          statStream.on('data', (chunk) => {
            statOutput += chunk.toString('utf8');
          });

          await new Promise((resolve, reject) => {
            statStream.on('end', resolve);
            statStream.on('error', reject);
          });

          const fileType = statOutput.replace(/^\x00/, '').trim();

          if (fileType.includes('directory')) {
            // Sync folder
            await this.syncContainerFolder(projectId, containerId, containerPath);
          } else if (fileType.includes('file')) {
            // Sync file
            await this.syncContainerFile(projectId, containerId, containerPath);
          }
        } catch (pathError) {
          logger.error('Failed to sync container path', {
            projectId,
            path: containerPath,
            error: pathError.message
          });
        }
      }

      logger.debug('Container filesystem sync complete', { projectId });
    } catch (error) {
      logger.error('Failed to sync container filesystem', {
        projectId,
        containerId,
        error: error.message
      });
    }
  }

  /**
   * Sync a single file from container to Drive
   * @param {string} projectId - Project ID
   * @param {string} containerId - Container ID
   * @param {string} containerPath - Path in container (e.g., /workspace/file.txt)
   */
  async syncContainerFile(projectId, containerId, containerPath) {
    try {
      const dockerServiceModule = await import('./docker.service.js');
      const dockerService = dockerServiceModule.default;
      
      // Get container from service registry
      const containerInfo = dockerService.containers.get(containerId);
      if (!containerInfo || !containerInfo.container) {
        logger.warn('Container not found for file sync', { projectId, containerId, containerPath });
        return;
      }
      
      // Read file content from container
      const exec = await containerInfo.container.exec({
        Cmd: ['cat', containerPath],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      let content = '';
      stream.on('data', (chunk) => {
        content += chunk.toString('utf8');
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      // Clean up Docker stream headers
      content = content.replace(/^\x00/g, '');

      const relativePath = containerPath.replace('/workspace/', '');
      const fileName = path.basename(containerPath);
      const dirPath = path.dirname(`/${relativePath}`);

      // Save to database and sync to Drive
      let fileDoc = await File.findOneAndUpdate(
        {
          project: projectId,
          path: `/${relativePath}`
        },
        {
          $set: {
            name: fileName,
            content: content,
            type: 'file',
            lastModified: new Date(),
            syncStatus: 'syncing'
          },
          $setOnInsert: {
            project: projectId,
            path: `/${relativePath}`
          }
        },
        {
          upsert: true,
          new: true
        }
      );

      // Sync to Google Drive
      try {
        const project = await Project.findById(projectId).populate('owner');
        if (!project || !project.driveFolderId) {
          return;
        }

        if (project.owner && project.owner.googleDrive) {
          driveFileService.initialize(
            project.owner.googleDrive.accessToken,
            project.owner.googleDrive.refreshToken,
            project.owner.googleDrive.tokenExpiry
          );

          let parentDriveFolderId = project.driveFolderId;
          if (dirPath !== '/') {
            parentDriveFolderId = await this.ensureDriveFolderPath(
              dirPath,
              project.driveFolderId,
              projectId
            );
          }

          if (fileDoc.driveId) {
            await driveFileService.updateFile(fileDoc.driveId, content);
          } else {
            const driveFile = await driveFileService.createFile(
              fileName,
              content,
              parentDriveFolderId
            );
            fileDoc.driveId = driveFile.id;
            await fileDoc.save();
          }

          fileDoc.syncStatus = 'synced';
          await fileDoc.save();

          // Notify clients
          this.notifyClients(projectId, {
            type: 'file-added',
            projectId,
            filePath: `/${relativePath}`,
            file: {
              path: `/${relativePath}`,
              name: fileName,
              content: content,
              driveId: fileDoc.driveId
            }
          });

          logger.info('Synced container file to Drive', {
            projectId,
            file: relativePath,
            driveId: fileDoc.driveId
          });
        }
      } catch (driveError) {
        logger.error('Failed to sync container file to Drive', {
          projectId,
          file: relativePath,
          error: driveError.message
        });
        fileDoc.syncStatus = 'failed';
        await fileDoc.save();
      }
    } catch (error) {
      logger.error('Failed to sync container file', {
        projectId,
        containerPath,
        error: error.message
      });
    }
  }

  /**
   * Sync a folder from container to Drive
   * @param {string} projectId - Project ID
   * @param {string} containerId - Container ID
   * @param {string} containerPath - Path in container (e.g., /workspace/folder)
   */
  async syncContainerFolder(projectId, containerId, containerPath) {
    try {
      const relativePath = containerPath.replace('/workspace/', '');
      const folderName = path.basename(containerPath);
      const parentPath = path.dirname(`/${relativePath}`);

      // Save to database
      let folderDoc = await File.findOneAndUpdate(
        {
          project: projectId,
          path: `/${relativePath}`
        },
        {
          name: folderName,
          type: 'folder',
          lastModified: new Date(),
          syncStatus: 'syncing'
        },
        {
          upsert: true,
          new: true
        }
      );

      // Sync to Google Drive
      try {
        const project = await Project.findById(projectId).populate('owner');
        if (!project || !project.driveFolderId) {
          return;
        }

        if (project.owner && project.owner.googleDrive) {
          driveFileService.initialize(
            project.owner.googleDrive.accessToken,
            project.owner.googleDrive.refreshToken,
            project.owner.googleDrive.tokenExpiry
          );

          let parentDriveFolderId = project.driveFolderId;
          if (parentPath !== '/') {
            parentDriveFolderId = await this.ensureDriveFolderPath(
              parentPath,
              project.driveFolderId,
              projectId
            );
          }

          if (!folderDoc.driveId) {
            const driveFolder = await driveFileService.createFolder(
              folderName,
              parentDriveFolderId
            );
            folderDoc.driveId = driveFolder.id;
            await folderDoc.save();
          }

          folderDoc.syncStatus = 'synced';
          await folderDoc.save();

          // Notify clients
          this.notifyClients(projectId, {
            type: 'dir-added',
            projectId,
            dirPath: `/${relativePath}`,
            dir: {
              path: `/${relativePath}`,
              name: folderName,
              driveId: folderDoc.driveId
            }
          });

          logger.info('Synced container folder to Drive', {
            projectId,
            folder: relativePath,
            driveId: folderDoc.driveId
          });
        }
      } catch (driveError) {
        logger.error('Failed to sync container folder to Drive', {
          projectId,
          folder: relativePath,
          error: driveError.message
        });
        folderDoc.syncStatus = 'failed';
        await folderDoc.save();
      }
    } catch (error) {
      logger.error('Failed to sync container folder', {
        projectId,
        containerPath,
        error: error.message
      });
    }
  }

  /**
   * Register a WebSocket client to receive file change notifications
   * @param {string} projectId - Project ID
   * @param {WebSocket} ws - WebSocket client
   */
  registerClient(projectId, ws) {
    let clients = this.watcherClients.get(projectId);
    if (!clients) {
      clients = new Set();
      this.watcherClients.set(projectId, clients);
    }
    clients.add(ws);
    logger.debug('Registered file watcher client', { projectId });
  }

  /**
   * Unregister a WebSocket client
   * @param {string} projectId - Project ID
   * @param {WebSocket} ws - WebSocket client
   */
  unregisterClient(projectId, ws) {
    const clients = this.watcherClients.get(projectId);
    if (clients) {
      clients.delete(ws);
      logger.debug('Unregistered file watcher client', { projectId });
    }
  }

  /**
   * Notify all registered clients of a file system event
   * @param {string} projectId - Project ID
   * @param {Object} event - Event data
   */
  notifyClients(projectId, event) {
    const clients = this.watcherClients.get(projectId);
    if (!clients || clients.size === 0) return;

    logger.debug('Notifying clients of file event', {
      projectId,
      eventType: event.type,
      clientCount: clients.size
    });
    
    for (const socket of clients) {
      try {
        // Socket.IO socket - use emit instead of send
        if (socket.connected) {
          socket.emit(event.type, event);
        }
      } catch (error) {
        logger.error('Error sending file event to client', {
          projectId,
          eventType: event.type,
          error: error.message
        });
      }
    }
  }

  /**
   * Sync file to database and Google Drive
   * @param {string} projectId - Project ID
   * @param {string} filePath - Absolute file path
   * @param {string} workspacePath - Workspace root path
   */
  async syncFileToDatabase(projectId, filePath, workspacePath) {
    try {
      const relativePath = path.relative(workspacePath, filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      const dirPath = path.dirname(`/${relativePath}`);
      
      // 1. Get or create file in database
      let fileDoc = await File.findOneAndUpdate(
        {
          project: projectId,
          path: `/${relativePath}`
        },
        {
          name: fileName,
          content: content,
          type: 'file',
          lastModified: new Date(),
          syncStatus: 'syncing'
        },
        {
          upsert: true,
          new: true
        }
      );

      // 2. Sync to Google Drive
      try {
        // Get project to access Google Drive folder
        const project = await Project.findById(projectId).populate('owner');
        if (!project || !project.driveFolderId) {
          logger.warn('Project has no Drive folder, skipping Drive sync', {
            projectId,
            file: relativePath
          });
          return;
        }

        // Initialize Drive service with user's tokens
        if (project.owner && project.owner.googleDrive) {
          driveFileService.initialize(
            project.owner.googleDrive.accessToken,
            project.owner.googleDrive.refreshToken,
            project.owner.googleDrive.tokenExpiry
          );

          // Find parent Drive folder for this file
          let parentDriveFolderId = project.driveFolderId;
          
          // If file is in a subdirectory, find or create the folder structure
          if (dirPath !== '/') {
            parentDriveFolderId = await this.ensureDriveFolderPath(
              dirPath,
              project.driveFolderId,
              projectId
            );
          }

          // Check if file already exists in Drive
          if (fileDoc.driveId) {
            // Update existing file in Drive
            await driveFileService.updateFile(fileDoc.driveId, content);
            logger.info('Updated file in Google Drive', {
              projectId,
              file: relativePath,
              driveId: fileDoc.driveId
            });
          } else {
            // Create new file in Drive
            const driveFile = await driveFileService.createFile(
              fileName,
              content,
              parentDriveFolderId
            );
            
            // Update file doc with Drive ID
            fileDoc.driveId = driveFile.id;
            await fileDoc.save();
            
            logger.info('Created file in Google Drive', {
              projectId,
              file: relativePath,
              driveId: driveFile.id
            });
          }

          // Mark as synced
          fileDoc.syncStatus = 'synced';
          await fileDoc.save();
        }
      } catch (driveError) {
        logger.error('Failed to sync file to Google Drive', {
          projectId,
          file: relativePath,
          error: driveError.message
        });
        
        // Mark as failed but don't throw - file is saved locally
        fileDoc.syncStatus = 'failed';
        await fileDoc.save();
      }

      logger.debug('Synced file to database and Drive', {
        projectId,
        file: relativePath,
        syncStatus: fileDoc.syncStatus
      });
    } catch (error) {
      logger.error('Failed to sync file', {
        projectId,
        file: filePath,
        error: error.message
      });
    }
  }

  /**
   * Sync folder to database and Google Drive
   * @param {string} projectId - Project ID
   * @param {string} dirPath - Absolute directory path
   * @param {string} workspacePath - Workspace root path
   */
  async syncFolderToDatabase(projectId, dirPath, workspacePath) {
    try {
      const relativePath = path.relative(workspacePath, dirPath);
      const folderName = path.basename(dirPath);
      const parentPath = path.dirname(`/${relativePath}`);
      
      // 1. Get or create folder in database
      let folderDoc = await File.findOneAndUpdate(
        {
          project: projectId,
          path: `/${relativePath}`
        },
        {
          name: folderName,
          type: 'folder',
          lastModified: new Date(),
          syncStatus: 'syncing'
        },
        {
          upsert: true,
          new: true
        }
      );

      // 2. Sync to Google Drive
      try {
        // Get project to access Google Drive folder
        const project = await Project.findById(projectId).populate('owner');
        if (!project || !project.driveFolderId) {
          logger.warn('Project has no Drive folder, skipping Drive sync', {
            projectId,
            folder: relativePath
          });
          return;
        }

        // Initialize Drive service with user's tokens
        if (project.owner && project.owner.googleDrive) {
          driveFileService.initialize(
            project.owner.googleDrive.accessToken,
            project.owner.googleDrive.refreshToken,
            project.owner.googleDrive.tokenExpiry
          );

          // Find parent Drive folder
          let parentDriveFolderId = project.driveFolderId;
          
          // If folder is in a subdirectory, ensure parent exists
          if (parentPath !== '/') {
            parentDriveFolderId = await this.ensureDriveFolderPath(
              parentPath,
              project.driveFolderId,
              projectId
            );
          }

          // Check if folder already exists in Drive
          if (folderDoc.driveId) {
            logger.info('Folder already exists in Google Drive', {
              projectId,
              folder: relativePath,
              driveId: folderDoc.driveId
            });
          } else {
            // Create new folder in Drive
            const driveFolder = await driveFileService.createFolder(
              folderName,
              parentDriveFolderId
            );
            
            // Update folder doc with Drive ID
            folderDoc.driveId = driveFolder.id;
            await folderDoc.save();
            
            logger.info('Created folder in Google Drive', {
              projectId,
              folder: relativePath,
              driveId: driveFolder.id
            });
          }

          // Mark as synced
          folderDoc.syncStatus = 'synced';
          await folderDoc.save();
        }
      } catch (driveError) {
        logger.error('Failed to sync folder to Google Drive', {
          projectId,
          folder: relativePath,
          error: driveError.message
        });
        
        // Mark as failed but don't throw - folder is saved locally
        folderDoc.syncStatus = 'failed';
        await folderDoc.save();
      }

      logger.debug('Synced folder to database and Drive', {
        projectId,
        folder: relativePath,
        syncStatus: folderDoc.syncStatus
      });
    } catch (error) {
      logger.error('Failed to sync folder', {
        projectId,
        dir: dirPath,
        error: error.message
      });
    }
  }

  /**
   * Ensure Drive folder path exists (create nested folders if needed)
   * @param {string} dirPath - Directory path like '/folder1/folder2'
   * @param {string} rootDriveFolderId - Root Drive folder ID
   * @param {string} projectId - Project ID
   * @returns {string} Drive folder ID of the deepest folder
   */
  async ensureDriveFolderPath(dirPath, rootDriveFolderId, projectId) {
    try {
      // Split path into parts
      const parts = dirPath.split('/').filter(p => p);
      let currentDriveFolderId = rootDriveFolderId;
      let currentPath = '';

      // Create each folder in the path
      for (const part of parts) {
        currentPath += `/${part}`;
        
        // Check if folder exists in database
        let folderDoc = await File.findOne({
          project: projectId,
          path: currentPath,
          type: 'folder'
        });

        if (!folderDoc || !folderDoc.driveId) {
          // Create folder in Drive
          const driveFolder = await driveFileService.createFolder(
            part,
            currentDriveFolderId
          );
          
          // Save to database
          if (folderDoc) {
            folderDoc.driveId = driveFolder.id;
            await folderDoc.save();
          } else {
            folderDoc = await File.create({
              project: projectId,
              name: part,
              path: currentPath,
              type: 'folder',
              driveId: driveFolder.id,
              syncStatus: 'synced'
            });
          }
          
          currentDriveFolderId = driveFolder.id;
          logger.info('Created Drive folder', {
            projectId,
            folderPath: currentPath,
            driveFolderId: driveFolder.id
          });
        } else {
          currentDriveFolderId = folderDoc.driveId;
        }
      }

      return currentDriveFolderId;
    } catch (error) {
      logger.error('Failed to ensure Drive folder path', {
        projectId,
        dirPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mark file as deleted in database
   * @param {string} projectId - Project ID
   * @param {string} filePath - Relative file path
   */
  async markFileAsDeleted(projectId, filePath) {
    try {
      await File.findOneAndUpdate(
        {
          project: projectId,
          path: filePath
        },
        {
          isDeleted: true,
          deletedAt: new Date()
        }
      );

      logger.debug('Marked file as deleted in database', {
        projectId,
        file: filePath
      });
    } catch (error) {
      logger.error('Failed to mark file as deleted', {
        projectId,
        file: filePath,
        error: error.message
      });
    }
  }

  /**
   * Get watcher status
   */
  getStatus() {
    return {
      activeWatchers: this.watchers.size,
      projects: Array.from(this.watchers.keys()),
      clientConnections: Array.from(this.watcherClients.entries()).map(([projectId, clients]) => ({
        projectId,
        clientCount: clients.size
      }))
    };
  }
}

// Export singleton instance
const fileWatcherService = new FileWatcherService();
export default fileWatcherService;
export { fileWatcherService };
