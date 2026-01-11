import express from 'express';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { syncEngine } from '../lib/sync/SyncEngine.js';
import { Priority } from '../lib/sync/QueueManager.js';
import { driveFileService } from '../services/driveFile.service.js';
import { googleDriveService } from '../services/googleDrive.service.js';
import { File } from '../models/File.js';
import { User } from '../models/User.js';
import terminalService from '../services/terminal.service.js';

const router = express.Router();

// Apply authentication to all sync routes
router.use(authenticateToken);

/**
 * Initialize Drive service with user tokens
 */
async function initializeDriveService(userId) {
  try {
    const user = await User.findById(userId).select('+driveAccessToken +driveRefreshToken +driveTokenExpiresAt');
    
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.driveAccessToken) {
      const error = new Error('Google Drive not connected. Please authenticate with Google Drive.');
      error.code = 'DRIVE_AUTH_REQUIRED';
      throw error;
    }

    // Check if token is expired and refresh if needed
    let accessToken = user.driveAccessToken;
    if (user.isTokenExpired() && user.driveRefreshToken) {
      logger.info('Drive token expired, refreshing...', { userId: user._id });
      try {
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
        const error = new Error('Google Drive authentication expired. Please re-authenticate.');
        error.code = 'DRIVE_REFRESH_FAILED';
        throw error;
      }
    }

    // Initialize drive service with valid access token
    driveFileService.initialize(accessToken);
    logger.info('Drive service initialized for user', { userId });
    
    return user;
  } catch (error) {
    logger.error('Failed to initialize Drive service', {
      userId,
      error: error.message,
      code: error.code
    });
    throw error;
  }
}

/**
 * @route   POST /api/v1/sync/upload
 * @desc    Upload project files to Google Drive
 * @access  Private
 */
router.post('/upload', async (req, res) => {
  try {
    const { projectId, files, priority = Priority.NORMAL } = req.body;
    const userId = req.user.id;

    logger.info('Google Drive upload requested', {
      userId,
      projectId,
      fileCount: files?.length
    });

    // Initialize Drive service with user tokens
    await initializeDriveService(userId);

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }

    let filesToUpload = [];

    if (files && Array.isArray(files)) {
      // Upload specific files
      filesToUpload = files;
    } else {
      // Upload all files in project
      filesToUpload = await File.find({ 
        projectId,
        userId,
        isDeleted: false
      });
    }

    if (filesToUpload.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files to upload'
      });
    }

    // Queue upload operations
    const uploadIds = [];
    for (const file of filesToUpload) {
      const uploadId = syncEngine.queueUpload(file, priority);
      uploadIds.push(uploadId);
    }

    const operationId = `upload_${Date.now()}_${projectId}`;

    res.json({
      success: true,
      message: `${filesToUpload.length} files queued for upload`,
      projectId,
      operationId,
      uploadIds,
      fileCount: filesToUpload.length,
      status: 'queued'
    });

  } catch (error) {
    logger.error('Upload request failed', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to queue upload operation'
    });
  }
});

/**
 * @route   POST /api/v1/sync/download
 * @desc    Download files from Google Drive
 * @access  Private
 */
router.post('/download', async (req, res) => {
  try {
    const { driveFileId, projectId, priority = Priority.NORMAL } = req.body;
    const userId = req.user.id;

    logger.info('Google Drive download requested', { 
      userId,
      driveFileId,
      projectId 
    });

    // Initialize Drive service with user tokens
    await initializeDriveService(userId);

    let filesToDownload = [];

    if (driveFileId) {
      // Download specific file
      const remoteFile = await driveFileService.getFile(driveFileId, userId);
      if (!remoteFile) {
        return res.status(404).json({
          success: false,
          error: 'File not found on Google Drive'
        });
      }
      filesToDownload = [remoteFile];
    } else if (projectId) {
      // Download all files in project from Drive
      const projectFiles = await File.find({ 
        projectId,
        userId,
        driveId: { $exists: true, $ne: null }
      });

      for (const file of projectFiles) {
        try {
          const remoteFile = await driveFileService.getFile(file.driveId, userId);
          if (remoteFile) {
            filesToDownload.push(remoteFile);
          }
        } catch (error) {
          logger.warn('Failed to fetch remote file for download', {
            fileId: file._id,
            driveId: file.driveId,
            error: error.message
          });
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either driveFileId or projectId is required'
      });
    }

    if (filesToDownload.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files to download'
      });
    }

    // Queue download operations
    const downloadIds = [];
    for (const file of filesToDownload) {
      const downloadId = syncEngine.queueDownload(file, priority);
      downloadIds.push(downloadId);
    }

    const operationId = `download_${Date.now()}_${projectId || driveFileId}`;

    res.json({
      success: true,
      message: `${filesToDownload.length} files queued for download`,
      operationId,
      downloadIds,
      fileCount: filesToDownload.length,
      status: 'queued'
    });

  } catch (error) {
    logger.error('Download request failed', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to queue download operation'
    });
  }
});

/**
 * @route   GET /api/v1/sync/status
 * @desc    Get overall sync engine status
 * @access  Private
 */
router.get('/status', (req, res) => {
  try {
    const status = syncEngine.getStatus();

    res.json({
      success: true,
      status
    });

  } catch (error) {
    logger.error('Failed to get sync status', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get sync status'
    });
  }
});

/**
 * @route   GET /api/v1/sync/queue/status
 * @desc    Get queue status
 * @access  Private
 */
router.get('/queue/status', (req, res) => {
  try {
    const queueStatus = syncEngine.getQueueStatus();

    res.json({
      success: true,
      queue: queueStatus
    });

  } catch (error) {
    logger.error('Failed to get queue status', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get queue status'
    });
  }
});

/**
 * @route   GET /api/v1/sync/conflicts
 * @desc    Get current conflicts
 * @access  Private
 */
router.get('/conflicts', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userId = req.user.id;
    const { projectId } = req.query;

    let query = { userId, conflictStatus: 'unresolved' };
    if (projectId) {
      query.projectId = projectId;
    }

    const conflictedFiles = await File.find(query);

    res.json({
      success: true,
      conflicts: conflictedFiles.map(file => ({
        fileId: file._id,
        fileName: file.name,
        filePath: file.path,
        projectId: file.projectId,
        conflictType: file.conflictType,
        conflictReason: file.conflictReason,
        lastSyncAttempt: file.lastSyncAttempt,
        conflictData: file.conflictData
      }))
    });

  } catch (error) {
    logger.error('Failed to get conflicts', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get conflicts'
    });
  }
});

/**
 * @route   POST /api/v1/sync/conflicts/:fileId/resolve
 * @desc    Resolve a file conflict
 * @access  Private
 */
router.post('/conflicts/:fileId/resolve', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { strategy, content } = req.body;
    const userId = req.user.id;

    logger.info('Conflict resolution requested', {
      userId,
      fileId,
      strategy
    });

    if (!strategy) {
      return res.status(400).json({
        success: false,
        error: 'Resolution strategy is required'
      });
    }

    const result = await syncEngine.resolveConflict(fileId, strategy, { content, userId });

    if (result.success) {
      res.json({
        success: true,
        message: 'Conflict resolved successfully',
        fileId,
        strategy,
        syncId: result.syncId
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to resolve conflict'
      });
    }

  } catch (error) {
    logger.error('Conflict resolution failed', {
      error: error.message,
      userId: req.user?.id,
      fileId: req.params.fileId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to resolve conflict'
    });
  }
});

/**
 * @route   POST /api/v1/sync/manual
 * @desc    Trigger manual sync for project or file
 * @access  Private
 */
router.post('/manual', async (req, res) => {
  try {
    const { projectId, fileId, direction = 'bidirectional' } = req.body;
    const userId = req.user.id;

    logger.info('Manual sync requested', {
      userId,
      projectId,
      fileId,
      direction
    });

    if (!projectId && !fileId) {
      return res.status(400).json({
        success: false,
        error: 'Either projectId or fileId is required'
      });
    }

    const syncId = await syncEngine.triggerManualSync(userId, { projectId, fileId, direction });

    res.json({
      success: true,
      message: 'Manual sync initiated',
      syncId,
      direction
    });

  } catch (error) {
    logger.error('Manual sync failed', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to initiate manual sync'
    });
  }
});

/**
 * @route   GET /api/v1/sync/drive/files
 * @desc    List user's Google Drive files
 * @access  Private
 */
router.get('/drive/files', async (req, res) => {
  try {
    const { query, pageToken, folderId, maxResults = 20 } = req.query;
    const userId = req.user.id;

    logger.info('Google Drive file listing requested', { 
      userId, 
      query, 
      pageToken,
      folderId
    });

    const result = await driveFileService.listFiles(userId, {
      query,
      pageToken,
      folderId,
      maxResults: parseInt(maxResults)
    });

    res.json({
      success: true,
      files: result.files || [],
      nextPageToken: result.nextPageToken || null,
      query,
      totalCount: result.files?.length || 0
    });

  } catch (error) {
    logger.error('Google Drive file listing failed', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to list Google Drive files'
    });
  }
});

/**
 * @route   DELETE /api/v1/sync/drive/:fileId
 * @desc    Delete file from Google Drive
 * @access  Private
 */
router.delete('/drive/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    logger.info('Google Drive file deletion requested', { 
      userId, 
      fileId 
    });

    await driveFileService.deleteFile(fileId, userId);

    // Also update local file if it exists
    await File.findOneAndUpdate(
      { driveId: fileId, userId },
      { 
        driveId: null,
        lastSynced: null,
        syncStatus: 'local_only'
      }
    );

    res.json({
      success: true,
      message: 'File deleted from Google Drive',
      fileId
    });

  } catch (error) {
    logger.error('Google Drive file deletion failed', {
      error: error.message,
      userId: req.user?.id,
      fileId: req.params.fileId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete file from Google Drive'
    });
  }
});

/**
 * @route   POST /api/v1/sync/settings
 * @desc    Update sync settings
 * @access  Private
 */
router.post('/settings', (req, res) => {
  try {
    const { backgroundSyncEnabled, syncInterval, autoResolveConflicts } = req.body;

    if (backgroundSyncEnabled !== undefined) {
      if (backgroundSyncEnabled) {
        syncEngine.startBackgroundSync();
      } else {
        syncEngine.stopBackgroundSync();
      }
    }

    if (syncInterval !== undefined) {
      syncEngine.setSyncInterval(syncInterval);
    }

    if (autoResolveConflicts !== undefined) {
      syncEngine.setAutoResolveConflicts(autoResolveConflicts);
    }

    res.json({
      success: true,
      message: 'Sync settings updated',
      settings: {
        backgroundSyncEnabled: syncEngine.isBackgroundSyncRunning(),
        syncInterval: syncEngine.syncInterval,
        autoResolveConflicts: syncEngine.autoResolveConflicts
      }
    });

  } catch (error) {
    logger.error('Failed to update sync settings', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update sync settings'
    });
  }
});

/**
 * @route   POST /api/v1/sync/terminal/:terminalId/files
 * @desc    Manually sync files from terminal container to database
 * @access  Private
 */
router.post('/terminal/:terminalId/files', async (req, res) => {
  try {
    const { terminalId } = req.params;
    const userId = req.user.id;

    logger.info('Manual terminal file sync requested', { terminalId, userId });

    // Verify terminal ownership (basic check)
    const terminal = terminalService.terminals.get(terminalId);
    if (!terminal) {
      return res.status(404).json({
        success: false,
        message: 'Terminal not found'
      });
    }

    if (terminal.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to terminal'
      });
    }

    // Perform file sync
    await terminalService.syncFilesFromContainer(terminalId);

    res.json({
      success: true,
      message: 'Files synced successfully from terminal to database',
      terminalId
    });

  } catch (error) {
    logger.error('Manual terminal file sync failed', { 
      terminalId: req.params.terminalId,
      userId: req.user.id,
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to sync files from terminal',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/v1/sync/terminals
 * @desc    Get active terminals and their sync status
 * @access  Private
 */
router.get('/terminals', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user terminals
    const userTerminals = terminalService.getUserTerminals(userId);
    
    const terminals = userTerminals.map(terminal => ({
      id: terminal.id,
      projectId: terminal.projectId,
      language: terminal.language,
      createdAt: terminal.createdAt,
      lastActivity: terminal.lastActivity,
      isActive: !terminal.destroying && terminal.stream && !terminal.stream.destroyed
    }));

    res.json({
      success: true,
      userId,
      terminals,
      totalTerminals: terminals.length,
      activeTerminals: terminals.filter(t => t.isActive).length
    });

  } catch (error) {
    logger.error('Failed to get terminal sync status', { 
      userId: req.user.id,
      error: error.message 
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get terminal status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/sync/background/start
 * @desc    Start background sync for a project
 * @access  Private
 */
router.post('/background/start', async (req, res) => {
  try {
    const { projectId, intervalMs = 30000 } = req.body;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    logger.info('Starting background sync', { userId, projectId, intervalMs });

    syncEngine.startBackgroundSyncForProject(projectId, intervalMs);

    res.json({
      success: true,
      message: 'Background sync started',
      projectId,
      intervalMs
    });

  } catch (error) {
    logger.error('Failed to start background sync', {
      userId: req.user.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to start background sync',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/sync/background/stop
 * @desc    Stop background sync for a project
 * @access  Private
 */
router.post('/background/stop', async (req, res) => {
  try {
    const { projectId } = req.body;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    logger.info('Stopping background sync', { userId, projectId });

    syncEngine.stopBackgroundSyncForProject(projectId);

    res.json({
      success: true,
      message: 'Background sync stopped',
      projectId
    });

  } catch (error) {
    logger.error('Failed to stop background sync', {
      userId: req.user.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to stop background sync',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/sync/project
 * @desc    Manually trigger project sync
 * @access  Private
 */
router.post('/project', async (req, res) => {
  try {
    const { projectId } = req.body;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    logger.info('Manual project sync requested', { userId, projectId });

    const result = await syncEngine.syncProject(projectId);

    res.json(result);

  } catch (error) {
    logger.error('Manual project sync failed', {
      userId: req.user.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Project sync failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/v1/sync/status/:projectId
 * @desc    Get sync status for a project
 * @access  Private
 */
router.get('/status/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    logger.debug('Get sync status requested', { userId, projectId });

    const status = syncEngine.getSyncStatus(projectId);

    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    logger.error('Failed to get sync status', {
      userId: req.user.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get sync status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/v1/sync/engine/status
 * @desc    Get overall sync engine status
 * @access  Private
 */
router.get('/engine/status', async (req, res) => {
  try {
    const userId = req.user.id;

    logger.debug('Get engine status requested', { userId });

    const status = syncEngine.getStatus();

    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    logger.error('Failed to get engine status', {
      userId: req.user.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get engine status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/sync/pull-from-drive
 * @desc    Pull latest changes from Google Drive for a project
 * @access  Private
 */
router.post('/pull-from-drive', async (req, res) => {
  try {
    const { projectId } = req.body;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId is required'
      });
    }

    logger.info('Pull from Drive requested', { userId, projectId });

    // Initialize Drive service
    await initializeDriveService(userId);

    // Get project to find Drive folder ID
    const Project = (await import('../models/Project.js')).Project;
    const project = await Project.findOne({ _id: projectId, owner: userId });
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    if (!project.driveFolderId) {
      return res.status(400).json({
        success: false,
        error: 'Project has no Google Drive folder'
      });
    }

    // Get all files from Drive folder
    const driveFiles = await driveFileService.listFiles(project.driveFolderId);
    
    // Get all files from database
    const dbFiles = await File.find({ project: projectId });
    const dbFilesByDriveId = new Map(dbFiles.map(f => [f.driveId, f]));

    let created = 0, updated = 0, deleted = 0;

    // Check for new or updated files in Drive
    for (const driveFile of driveFiles) {
      const dbFile = dbFilesByDriveId.get(driveFile.id);
      
      if (!dbFile) {
        // File exists in Drive but not in DB - create it
        const content = driveFile.mimeType !== 'application/vnd.google-apps.folder'
          ? await driveFileService.getFileContent(driveFile.id)
          : '';

        await File.create({
          project: projectId,
          name: driveFile.name,
          path: `/${driveFile.name}`, // Simplified - should build full path
          type: driveFile.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
          content,
          driveId: driveFile.id,
          lastModified: new Date(driveFile.modifiedTime),
          syncStatus: 'synced'
        });
        created++;
      } else {
        // File exists - check if Drive version is newer
        const driveModified = new Date(driveFile.modifiedTime);
        const dbModified = new Date(dbFile.lastModified);

        if (driveModified > dbModified) {
          // Drive version is newer - update DB
          if (dbFile.type !== 'folder') {
            const content = await driveFileService.getFileContent(driveFile.id);
            dbFile.content = content;
          }
          dbFile.lastModified = driveModified;
          dbFile.syncStatus = 'synced';
          await dbFile.save();
          updated++;
        }
      }
    }

    // Check for files deleted in Drive
    const driveFileIds = new Set(driveFiles.map(f => f.id));
    for (const dbFile of dbFiles) {
      if (dbFile.driveId && !driveFileIds.has(dbFile.driveId)) {
        // File exists in DB but not in Drive - delete from DB
        await File.findByIdAndDelete(dbFile._id);
        deleted++;
      }
    }

    logger.info('Pull from Drive completed', {
      projectId,
      created,
      updated,
      deleted
    });

    res.json({
      success: true,
      message: 'Sync from Drive completed',
      stats: { created, updated, deleted }
    });

  } catch (error) {
    logger.error('Failed to pull from Drive', {
      userId: req.user.id,
      projectId: req.body.projectId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to pull from Drive',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;

