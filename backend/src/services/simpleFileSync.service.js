import { logger } from '../utils/logger.js';
import { File } from '../models/File.js';
import { Project } from '../models/Project.js';
import { driveFileService } from './driveFile.service.js';
import path from 'path';

/**
 * SIMPLIFIED FILE SYNC SERVICE
 * Clean, simple, working container sync
 */
class SimpleFileSyncService {
  constructor() {
    this.syncIntervals = new Map();
    this.clients = new Map();
  }

  /**
   * Register a client for notifications
   */
  registerClient(projectId, socket) {
    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, new Set());
    }
    this.clients.get(projectId).add(socket);
    logger.info('Client registered for sync', { projectId, clientCount: this.clients.get(projectId).size });
  }

  /**
   * Unregister a client
   */
  unregisterClient(projectId, socket) {
    const clients = this.clients.get(projectId);
    if (clients) {
      clients.delete(socket);
      if (clients.size === 0) {
        this.clients.delete(projectId);
      }
    }
  }

  /**
   * Notify clients of file changes
   */
  notifyClients(projectId, data) {
    const clients = this.clients.get(projectId);
    if (clients) {
      clients.forEach(socket => {
        if (socket.connected) {
          socket.emit('file-watcher:change', data);
        }
      });
    }
  }

  /**
   * Start container sync - SIMPLE VERSION
   * Just scans container every 10 seconds and syncs to Drive
   */
  async startContainerSync(projectId, containerId) {
    // Don't start if already running
    if (this.syncIntervals.has(projectId)) {
      logger.debug('Container sync already running', { projectId });
      return;
    }

    logger.info('🚀 Starting SIMPLE container sync', { projectId, containerId });

    // Run initial sync
    await this.syncNow(projectId, containerId);

    // Then run every 10 seconds
    const interval = setInterval(async () => {
      try {
        await this.syncNow(projectId, containerId);
      } catch (error) {
        logger.error('Container sync error', { projectId, error: error.message });
      }
    }, 10000); // 10 seconds

    this.syncIntervals.set(projectId, interval);
  }

  /**
   * Stop container sync
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
   * Sync container files NOW - SIMPLE VERSION
   * 1. Get all files from container
   * 2. Get all files from database
   * 3. Sync differences
   */
  async syncNow(projectId, dockerContainerId) {
    try {
      if (!dockerContainerId) {
        logger.warn('⚠️  No containerId provided, skipping sync', { projectId });
        return;
      }

      logger.info('📂 Syncing container files...', { projectId, dockerContainerId });

      // Get Docker service
      const dockerServiceModule = await import('./docker.service.js');
      const dockerService = dockerServiceModule.default;

      // Get container directly by Docker ID
      const container = dockerService.docker.getContainer(dockerContainerId);
      
      // Verify container exists and is running
      try {
        const containerInfo = await container.inspect();
        if (!containerInfo.State.Running) {
          logger.warn('Container not running, skipping sync', { 
            projectId, 
            dockerContainerId,
            status: containerInfo.State.Status 
          });
          return;
        }
      } catch (inspectError) {
        if (inspectError.statusCode === 404) {
          logger.warn('Container not found, skipping sync', { projectId, dockerContainerId });
          return;
        }
        throw inspectError;
      }

      // Get container files
      const containerFiles = await this.getContainerFiles(container);
      logger.info(`Found ${containerFiles.length} files in container`, { projectId });

      // Get database files
      const dbFiles = await File.find({ project: projectId }).lean();
      const dbFileMap = new Map(dbFiles.map(f => [f.path, f]));

      // Get project info for Drive sync
      const project = await Project.findById(projectId).populate('owner');
      if (!project) return;

      // Initialize Drive if available
      let driveEnabled = false;
      if (project.owner && project.owner.googleDrive) {
        driveFileService.initialize(
          project.owner.googleDrive.accessToken,
          project.owner.googleDrive.refreshToken,
          project.owner.googleDrive.tokenExpiry
        );
        driveEnabled = true;
      }

      // Sync each container file
      let newFiles = 0;
      let updatedFiles = 0;

      for (const containerFile of containerFiles) {
        const dbFile = dbFileMap.get(containerFile.path);

        if (!dbFile) {
          // NEW FILE - Add to database and Drive
          await this.addNewFile(project, containerFile, driveEnabled, container);
          newFiles++;
        } else if (containerFile.modifiedTime > new Date(dbFile.updatedAt).getTime()) {
          // UPDATED FILE - Update database and Drive
          await this.updateFile(dbFile, containerFile, driveEnabled, container);
          updatedFiles++;
        }
      }

      if (newFiles > 0 || updatedFiles > 0) {
        logger.info('✅ Sync complete', { 
          projectId, 
          new: newFiles, 
          updated: updatedFiles 
        });

        // Notify clients to refresh
        this.notifyClients(projectId, {
          type: 'files-synced',
          projectId,
          new: newFiles,
          updated: updatedFiles
        });
      }

    } catch (error) {
      logger.error('Sync failed', { projectId, error: error.message, stack: error.stack });
    }
  }

  /**
   * Get list of files in container
   */
  async getContainerFiles(container) {
    try {
      // Execute 'find' command
      const exec = await container.exec({
        Cmd: ['find', '/workspace', '-type', 'f'],
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
        setTimeout(resolve, 5000); // Timeout
      });

      // Parse output
      const files = output
        .split('\n')
        .map(line => line.replace(/^[\x00-\x08]+/, '').trim())
        .filter(line => line && line.startsWith('/workspace/') && !line.includes('find:'))
        .map(fullPath => {
          const relativePath = fullPath.replace('/workspace', '');
          return {
            path: relativePath,
            fullPath: fullPath,
            name: path.basename(relativePath),
            modifiedTime: Date.now() // We don't have real mtime, use current time
          };
        });

      return files;
    } catch (error) {
      logger.error('Failed to list container files', { error: error.message });
      return [];
    }
  }

  /**
   * Add new file to database and Drive
   */
  async addNewFile(project, containerFile, driveEnabled, container) {
    try {
      // Read content from container
      const content = await this.readFileFromContainer(container, containerFile.fullPath);

      // Create in database
      const newFile = await File.create({
        project: project._id,
        name: containerFile.name,
        path: containerFile.path,
        type: 'file',
        content: content,
        syncStatus: driveEnabled ? 'syncing' : 'local-only'
      });

      // Upload to Drive if enabled
      if (driveEnabled && project.driveFolderId) {
        try {
          const driveFile = await driveFileService.createFile(
            containerFile.name,
            content,
            project.driveFolderId,
            'text/plain'
          );

          newFile.driveId = driveFile.id;
          newFile.syncStatus = 'synced';
          await newFile.save();

          logger.info('✅ New file synced to Drive', { 
            path: containerFile.path,
            driveId: driveFile.id
          });
        } catch (driveError) {
          logger.warn('Failed to upload to Drive', { 
            path: containerFile.path,
            error: driveError.message 
          });
        }
      }

    } catch (error) {
      logger.error('Failed to add new file', { 
        path: containerFile.path,
        error: error.message 
      });
    }
  }

  /**
   * Update existing file in database and Drive
   */
  async updateFile(dbFile, containerFile, driveEnabled, container) {
    try {
      // Read new content from container
      const content = await this.readFileFromContainer(container, containerFile.fullPath);

      // Update database
      dbFile.content = content;
      dbFile.syncStatus = driveEnabled ? 'syncing' : 'local-only';
      await File.findByIdAndUpdate(dbFile._id, {
        content: content,
        syncStatus: driveEnabled ? 'syncing' : 'local-only',
        updatedAt: new Date()
      });

      // Update Drive if enabled
      if (driveEnabled && dbFile.driveId) {
        try {
          await driveFileService.updateFile(dbFile.driveId, content);
          
          await File.findByIdAndUpdate(dbFile._id, {
            syncStatus: 'synced'
          });

          logger.debug('✅ File updated in Drive', { 
            path: containerFile.path,
            driveId: dbFile.driveId
          });
        } catch (driveError) {
          logger.warn('Failed to update in Drive', { 
            path: containerFile.path,
            error: driveError.message 
          });
        }
      }

    } catch (error) {
      logger.error('Failed to update file', { 
        path: containerFile.path,
        error: error.message 
      });
    }
  }

  /**
   * Read file content from container - PROPERLY strip Docker headers
   */
  async readFileFromContainer(container, filePath) {
    try {
      const exec = await container.exec({
        Cmd: ['cat', filePath],
        AttachStdout: true,
        AttachStderr: true,
        Tty: false // IMPORTANT: When false, Docker adds 8-byte headers
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      
      const chunks = [];
      
      stream.on('data', (chunk) => {
        // Docker multiplexed stream format:
        // Header: 8 bytes
        //   byte 0: stream type (0=stdin, 1=stdout, 2=stderr)
        //   bytes 1-3: padding
        //   bytes 4-7: payload size (big-endian uint32)
        // Payload: N bytes of actual data
        
        let offset = 0;
        while (offset < chunk.length) {
          // Check if we have enough bytes for a header
          if (chunk.length - offset < 8) {
            break; // Not enough data for header
          }
          
          const streamType = chunk[offset];
          const payloadSize = chunk.readUInt32BE(offset + 4);
          
          // Extract payload (skip 8-byte header)
          const payloadStart = offset + 8;
          const payloadEnd = payloadStart + payloadSize;
          
          if (payloadEnd <= chunk.length) {
            const payload = chunk.slice(payloadStart, payloadEnd);
            chunks.push(payload);
            offset = payloadEnd;
          } else {
            // Incomplete payload in this chunk
            break;
          }
        }
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
        setTimeout(resolve, 5000); // Timeout
      });

      // Combine all chunks and convert to string
      const buffer = Buffer.concat(chunks);
      const content = buffer.toString('utf8');

      return content;
    } catch (error) {
      logger.error('Failed to read file from container', { 
        filePath,
        error: error.message 
      });
      return '';
    }
  }

  /**
   * Manual sync trigger
   */
  async manualSync(projectId, containerId) {
    logger.info('🔄 Manual sync triggered', { projectId, containerId });
    await this.syncNow(projectId, containerId);
  }
}

// Export singleton instance
export const simpleFileSyncService = new SimpleFileSyncService();
