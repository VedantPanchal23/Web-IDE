import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import { File } from '../../models/File.js';
import { Project } from '../../models/Project.js';
import { User } from '../../models/User.js';
import { driveFileService } from '../../services/driveFile.service.js';
import { ConflictDetector } from './ConflictDetector.js';
import { QueueManager, Priority } from './QueueManager.js';
import { ThreeWayMerge } from './ThreeWayMerge.js';

// Sync status constants
export const SyncStatus = {
  SYNCED: 'synced',
  PENDING: 'pending', 
  SYNCING: 'syncing',
  CONFLICT: 'conflict',
  ERROR: 'error',
  OFFLINE: 'offline'
};

// Conflict resolution strategies
export const ResolutionStrategy = {
  KEEP_LOCAL: 'keep-local',
  KEEP_REMOTE: 'keep-remote',
  THREE_WAY_MERGE: 'merge', 
  MANUAL_MERGE: 'manual'
};

/**
 * Core file synchronization engine
 * Handles background sync between local cache and Google Drive
 */
export class SyncEngine {
  constructor() {
    this.conflictDetector = new ConflictDetector();
    this.queueManager = new QueueManager();
    this.threeWayMerge = new ThreeWayMerge();
    this.activeProjects = new Map(); // projectId -> sync interval
    this.syncIntervals = new Map(); // projectId -> interval ID
    this.backgroundSyncEnabled = true;
    this.autoResolveConflicts = false;
    this.defaultSyncInterval = 30000; // 30 seconds
    this.startTime = Date.now();
  }



  /**
   * Enable background sync globally
   */
  startBackgroundSync() {
    this.backgroundSyncEnabled = true;
    logger.info('Background sync enabled globally');
  }

  /**
   * Disable background sync globally and stop all active syncs
   */
  stopBackgroundSync() {
    this.backgroundSyncEnabled = false;
    // Stop all active project syncs
    for (const projectId of this.syncIntervals.keys()) {
      this.stopBackgroundSyncForProject(projectId);
    }
    logger.info('Background sync disabled globally');
  }

  /**
   * Start background sync for a specific project
   * @param {string} projectId - Project ID to sync
   * @param {number} intervalMs - Sync interval in milliseconds (default: 30s)
   */
  startBackgroundSyncForProject(projectId, intervalMs = 30000) {
    try {
      if (this.syncIntervals.has(projectId)) {
        logger.debug('Background sync already running for project', { projectId });
        return;
      }

      const intervalId = setInterval(async () => {
        try {
          await this.syncProject(projectId);
        } catch (error) {
          logger.error('Background sync failed', { 
            projectId, 
            error: error.message 
          });
        }
      }, intervalMs);

      this.syncIntervals.set(projectId, intervalId);
      this.activeProjects.set(projectId, { intervalMs, startedAt: new Date() });

      logger.info('Started background sync for project', { projectId, intervalMs });
    } catch (error) {
      logger.error('Failed to start background sync', { projectId, error: error.message });
      throw error;
    }
  }

  /**
   * Stop background sync for a specific project
   * @param {string} projectId - Project ID to stop syncing
   */
  stopBackgroundSyncForProject(projectId) {
    try {
      const intervalId = this.syncIntervals.get(projectId);
      if (intervalId) {
        clearInterval(intervalId);
        this.syncIntervals.delete(projectId);
        this.activeProjects.delete(projectId);
        logger.info('Stopped background sync for project', { projectId });
      }
    } catch (error) {
      logger.error('Failed to stop background sync', { projectId, error: error.message });
    }
  }

  /**
   * Check if background sync is running globally
   * @returns {boolean} True if background sync is enabled globally
   */
  isBackgroundSyncRunning() {
    return this.backgroundSyncEnabled;
  }

  /**
   * Get the current sync interval
   * @returns {number} Current sync interval in milliseconds
   */
  get syncInterval() {
    return this.defaultSyncInterval;
  }

  /**
   * Get overall sync engine status
   * @returns {Object} Overall sync status information
   */
  getStatus() {
    const activeProjects = Array.from(this.activeProjects.entries()).map(([projectId, info]) => ({
      projectId,
      syncInterval: info.intervalMs,
      startedAt: info.startedAt,
      queueSize: this.queueManager.getQueueSize(projectId)
    }));

    return {
      isRunning: true,
      backgroundSyncEnabled: this.backgroundSyncEnabled,
      autoResolveConflicts: this.autoResolveConflicts,
      activeProjectsCount: this.activeProjects.size,
      activeProjects,
      totalQueueSize: this.queueManager.getTotalQueueSize(),
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Get sync status for a project
   * @param {string} projectId - Project ID
   * @returns {Object} Sync status information
   */
  getSyncStatus(projectId) {
    const isActive = this.activeProjects.has(projectId);
    const activeInfo = this.activeProjects.get(projectId);
    
    return {
      projectId,
      isBackgroundSyncActive: isActive,
      syncInterval: activeInfo?.intervalMs || null,
      startedAt: activeInfo?.startedAt || null,
      queueSize: this.queueManager.getQueueSize(projectId)
    };
  }

  /**
   * Trigger manual sync for a project or specific file
   * @param {string} userId - User ID
   * @param {Object} options - Sync options
   * @param {string} options.projectId - Project ID to sync
   * @param {string} options.fileId - Optional specific file ID to sync
   * @param {string} options.direction - Sync direction: 'bidirectional', 'upload', or 'download'
   * @returns {string} Sync operation ID
   */
  async triggerManualSync(userId, { projectId, fileId, direction = 'bidirectional' }) {
    const syncId = crypto.randomUUID();
    
    try {
      logger.info('Manual sync triggered', { 
        syncId, 
        userId, 
        projectId, 
        fileId, 
        direction 
      });

      // Get user for Drive credentials
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (fileId) {
        // Sync specific file
        const file = await File.findById(fileId);
        if (!file) {
          throw new Error('File not found');
        }
        await this.syncFile(file, user);
      } else if (projectId) {
        // Sync entire project
        await this.syncProject(projectId);
      } else {
        throw new Error('Either projectId or fileId must be provided');
      }

      logger.info('Manual sync completed', { syncId, projectId, fileId });
      return syncId;

    } catch (error) {
      logger.error('Manual sync failed', { 
        syncId, 
        userId, 
        projectId, 
        fileId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Sync all files in a project with Google Drive
   * @param {string} projectId - Project ID to sync
   * @returns {Object} Sync result with status and statistics
   */
  async syncProject(projectId) {
    const startTime = Date.now();
    let stats = {
      filesChecked: 0,
      filesUploaded: 0,
      filesDownloaded: 0,
      conflictsDetected: 0,
      errors: 0
    };

    try {
      logger.info('Starting project sync', { projectId });

      // Get project and verify it exists
      const project = await Project.findById(projectId).populate('owner');
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // Get user with drive tokens
      const user = await User.findById(project.owner._id).select('+driveAccessToken +driveRefreshToken +driveTokenExpiresAt');
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.driveAccessToken) {
        logger.warn('User does not have Google Drive access token', { userId: user._id });
        throw new Error('User does not have valid Google Drive access');
      }

      // Check if token is expired and refresh if needed
      let accessToken = user.driveAccessToken;
      if (user.isTokenExpired() && user.driveRefreshToken) {
        logger.info('Drive token expired, refreshing...', { userId: user._id });
        try {
          const { googleDriveService } = await import('../../services/googleDrive.service.js');
          const newCredentials = await googleDriveService.refreshAccessToken(user.driveRefreshToken);
          
          // Update user with new tokens
          await user.updateDriveTokens(newCredentials);
          accessToken = newCredentials.access_token;
          
          logger.info('Drive token refreshed successfully', { userId: user._id });
        } catch (refreshError) {
          logger.error('Failed to refresh Drive token', { 
            userId: user._id, 
            error: refreshError.message 
          });
          throw new Error('Failed to refresh Google Drive access token');
        }
      }

      // Initialize drive service with valid access token
      driveFileService.initialize(accessToken);

      // Get all files in the project
      const files = await File.find({ project: projectId });
      stats.filesChecked = files.length;

      // Process each file
      for (const file of files) {
        try {
          const result = await this.syncFile(file, user);
          
          if (result.action === 'upload') {
            stats.filesUploaded++;
          } else if (result.action === 'download') {
            stats.filesDownloaded++;
          } else if (result.action === 'conflict') {
            stats.conflictsDetected++;
          }
        } catch (error) {
          stats.errors++;
          logger.error('Failed to sync individual file', {
            fileId: file._id,
            error: error.message
          });
        }
      }

      // Update project sync timestamp
      project.lastSyncedAt = new Date();
      project.syncStatus = stats.conflictsDetected > 0 ? SyncStatus.CONFLICT : SyncStatus.SYNCED;
      await project.save();

      const duration = Date.now() - startTime;
      logger.info('Project sync completed', { projectId, stats, duration });

      return {
        success: true,
        projectId,
        stats,
        duration,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Project sync failed', { projectId, error: error.message });
      
      // Update project with error status
      try {
        await Project.findByIdAndUpdate(projectId, {
          syncStatus: SyncStatus.ERROR,
          lastSyncError: error.message,
          lastSyncedAt: new Date()
        });
      } catch (updateError) {
        logger.error('Failed to update project sync status', { projectId, updateError: updateError.message });
      }

      return {
        success: false,
        projectId,
        error: error.message,
        stats,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Sync a single file with Google Drive
   * @param {Object} file - File document from database
   * @param {Object} user - User with drive access tokens
   * @returns {Object} Sync result for the file
   */
  async syncFile(file, user) {
    try {
      // Skip folders for now (focus on files)
      if (file.type === 'folder') {
        return { action: 'skip', reason: 'folder' };
      }

      // Skip files marked as local-only or without driveId
      if (!file.driveId || file.syncStatus === 'local-only') {
        logger.debug('Skipping local-only file', { 
          fileId: file._id, 
          path: file.path,
          syncStatus: file.syncStatus 
        });
        return { action: 'skip', reason: 'local-only' };
      }

      // Get current file content and calculate hash
      const localContent = file.content || '';
      const localHash = crypto.createHash('md5').update(localContent, 'utf8').digest('hex');

      // Check if file exists in Drive and get metadata
      let driveMetadata = null;
      let driveContent = null;

      try {
        driveMetadata = await driveFileService.getFileMetadata(file.driveId);
        driveContent = await driveFileService.getFileContent(file.driveId);
      } catch (driveError) {
        // File might not exist in Drive or access denied
        logger.warn('Could not access Drive file', {
          fileId: file._id,
          driveId: file.driveId,
          error: driveError.message
        });
        
        // Upload local file to Drive
        return await this.uploadFileToDrive(file, user);
      }

      // Calculate Drive file hash
      const driveHash = crypto.createHash('md5').update(driveContent || '', 'utf8').digest('hex');

      // Check for conflicts
      const conflict = this.conflictDetector.detectConflict(file, {
        content: driveContent,
        hash: driveHash,
        modifiedTime: new Date(driveMetadata.modifiedTime)
      });

      if (conflict) {
        // Handle conflict
        await this.handleConflict(file, conflict);
        return { action: 'conflict', conflict };
      }

      // Determine sync direction based on timestamps and hashes
      const localModified = file.updatedAt;
      const driveModified = new Date(driveMetadata.modifiedTime);

      if (localHash !== driveHash) {
        if (localModified > driveModified) {
          // Local is newer, upload to Drive
          return await this.uploadFileToDrive(file, user);
        } else {
          // Drive is newer, download to local
          return await this.downloadFileFromDrive(file, driveContent, driveHash);
        }
      }

      // Files are in sync
      await this.markFileAsSynced(file, localHash);
      return { action: 'sync', reason: 'already_synced' };

    } catch (error) {
      logger.error('File sync failed', {
        fileId: file._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Upload file to Google Drive
   * @param {Object} file - File document
   * @param {Object} user - User with drive tokens
   * @returns {Object} Upload result
   */
  async uploadFileToDrive(file, user) {
    try {
      file.syncStatus = SyncStatus.SYNCING;
      await file.save();

      const content = file.content || '';
      await driveFileService.updateFile(file.driveId, content, file.mimeType);

      const contentHash = crypto.createHash('md5').update(content, 'utf8').digest('hex');
      await this.markFileAsSynced(file, contentHash);

      logger.debug('File uploaded to Drive', { fileId: file._id });
      return { action: 'upload', success: true };

    } catch (error) {
      file.syncStatus = SyncStatus.ERROR;
      await file.save();
      throw error;
    }
  }

  /**
   * Download file from Google Drive
   * @param {Object} file - File document
   * @param {string} driveContent - Content from Drive
   * @param {string} driveHash - Hash of Drive content
   * @returns {Object} Download result
   */
  async downloadFileFromDrive(file, driveContent, driveHash) {
    try {
      file.syncStatus = SyncStatus.SYNCING;
      file.content = driveContent;
      await file.save();

      await this.markFileAsSynced(file, driveHash);

      logger.debug('File downloaded from Drive', { fileId: file._id });
      return { action: 'download', success: true };

    } catch (error) {
      file.syncStatus = SyncStatus.ERROR;
      await file.save();
      throw error;
    }
  }

  /**
   * Mark file as synced with given hash
   * @param {Object} file - File document
   * @param {string} hash - Content hash
   */
  async markFileAsSynced(file, hash) {
    file.syncStatus = SyncStatus.SYNCED;
    file.localHash = hash;
    file.driveHash = hash;
    file.lastSyncedAt = new Date();
    await file.save();
  }

  /**
   * Handle file conflict by storing conflict data
   * @param {Object} file - File document
   * @param {Object} conflict - Conflict information
   */
  async handleConflict(file, conflict) {
    try {
      file.syncStatus = SyncStatus.CONFLICT;
      file.conflictData = {
        localContent: file.content,
        driveContent: conflict.driveContent,
        conflictedAt: new Date(),
        conflictType: conflict.type
      };
      await file.save();

      logger.info('File conflict detected and stored', {
        fileId: file._id,
        conflictType: conflict.type
      });
    } catch (error) {
      logger.error('Failed to store conflict data', {
        fileId: file._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Resolve a file conflict using specified strategy
   * @param {string} fileId - File ID
   * @param {string} strategy - Resolution strategy
   * @returns {Object} Resolution result
   */
  async resolveConflict(fileId, strategy) {
    try {
      const file = await File.findById(fileId);
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      if (file.syncStatus !== SyncStatus.CONFLICT) {
        throw new Error('File is not in conflict state');
      }

      if (!file.conflictData) {
        throw new Error('No conflict data available');
      }

      let resolvedContent = '';

      switch (strategy) {
        case ResolutionStrategy.KEEP_LOCAL:
          resolvedContent = file.conflictData.localContent;
          break;

        case ResolutionStrategy.KEEP_REMOTE:
          resolvedContent = file.conflictData.driveContent;
          break;

        case ResolutionStrategy.THREE_WAY_MERGE:
          const mergeResult = this.performThreeWayMerge(
            file.conflictData.baseContent || '',
            file.conflictData.localContent,
            file.conflictData.driveContent
          );
          
          if (!mergeResult.success) {
            throw new Error(`Three-way merge failed: ${mergeResult.message}`);
          }
          
          resolvedContent = mergeResult.content;
          break;

        case ResolutionStrategy.MANUAL_MERGE:
          // For manual merge, the resolved content should be provided separately
          throw new Error('Manual merge requires resolved content to be provided');

        default:
          throw new Error(`Unknown resolution strategy: ${strategy}`);
      }

      // Apply the resolution
      file.content = resolvedContent;
      file.conflictData = null;
      file.syncStatus = SyncStatus.SYNCING;
      await file.save();

      // Sync the resolved content to Drive
      const user = await User.findById(file.project.owner).select('+driveAccessToken +driveRefreshToken +driveTokenExpiresAt');
      if (user && user.driveAccessToken) {
        // Check if token is expired and refresh if needed
        let accessToken = user.driveAccessToken;
        if (user.isTokenExpired() && user.driveRefreshToken) {
          logger.info('Drive token expired during conflict resolution, refreshing...', { userId: user._id });
          try {
            const { googleDriveService } = await import('../../services/googleDrive.service.js');
            const newCredentials = await googleDriveService.refreshAccessToken(user.driveRefreshToken);
            
            // Update user with new tokens
            await user.updateDriveTokens(newCredentials);
            accessToken = newCredentials.access_token;
            
            logger.info('Drive token refreshed successfully during conflict resolution', { userId: user._id });
          } catch (refreshError) {
            logger.error('Failed to refresh Drive token during conflict resolution', { 
              userId: user._id, 
              error: refreshError.message 
            });
            throw new Error('Failed to refresh Google Drive access token');
          }
        }

        driveFileService.initialize(accessToken);
        await driveFileService.updateFile(file.driveId, resolvedContent, file.mimeType);
      }

      // Mark as synced
      const contentHash = crypto.createHash('md5').update(resolvedContent, 'utf8').digest('hex');
      await this.markFileAsSynced(file, contentHash);

      logger.info('Conflict resolved', {
        fileId,
        strategy,
        contentLength: resolvedContent.length
      });

      return {
        success: true,
        fileId,
        strategy,
        resolvedContentLength: resolvedContent.length
      };

    } catch (error) {
      logger.error('Failed to resolve conflict', {
        fileId,
        strategy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Detect conflicts for all files in a project
   * @param {string} projectId - Project ID
   * @returns {Array} Array of conflict information
   */
  async detectConflicts(projectId) {
    try {
      const files = await File.find({ 
        project: projectId, 
        syncStatus: SyncStatus.CONFLICT 
      });

      return files.map(file => ({
        fileId: file._id,
        fileName: file.name,
        path: file.path,
        conflictType: file.conflictData?.conflictType,
        conflictedAt: file.conflictData?.conflictedAt,
        hasLocalChanges: !!file.conflictData?.localContent,
        hasRemoteChanges: !!file.conflictData?.driveContent
      }));

    } catch (error) {
      logger.error('Failed to detect conflicts', {
        projectId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Perform a three-way merge of base, local, and remote content
   * @param {string} baseContent - Base/original file content
   * @param {string} localContent - Local file content
   * @param {string} remoteContent - Remote file content
   * @returns {Object} Merge result with success flag and content
   */
  performThreeWayMerge(baseContent, localContent, remoteContent) {
    return this.threeWayMerge.merge(baseContent, localContent, remoteContent);
  }

  /**
   * Get queue status across all projects
   * @returns {Object} Queue status information
   */
  getQueueStatus() {
    return this.queueManager.getQueueStatus();
  }

  /**
   * Set sync interval for background sync operations
   * @param {number} intervalMs - Interval in milliseconds
   */
  setSyncInterval(intervalMs) {
    this.defaultSyncInterval = intervalMs || 30000;
    logger.info('Default sync interval updated', { intervalMs: this.defaultSyncInterval });
  }

  /**
   * Set auto resolve conflicts setting
   * @param {boolean} enabled - Whether to auto-resolve conflicts
   */
  setAutoResolveConflicts(enabled) {
    this.autoResolveConflicts = !!enabled;
    logger.info('Auto resolve conflicts setting updated', { enabled: this.autoResolveConflicts });
  }

  /**
   * Cleanup - stop all background sync processes
   */
  cleanup() {
    for (const projectId of this.syncIntervals.keys()) {
      this.stopBackgroundSyncForProject(projectId);
    }
    logger.info('Sync engine cleanup completed');
  }
}

// Create singleton instance
export const syncEngine = new SyncEngine();

// Cleanup on process exit
process.on('SIGTERM', () => syncEngine.cleanup());
process.on('SIGINT', () => syncEngine.cleanup());