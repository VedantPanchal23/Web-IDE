import express from 'express';
import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.js';
import { File } from '../models/File.js';
import { User } from '../models/User.js';
import { driveFileService } from '../services/driveFile.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import crypto from 'crypto';

const router = express.Router();

/**
 * @route   GET /api/v1/files/:projectId/files
 * @desc    List project files (file tree)
 * @access  Private
 */
router.get('/:projectId/files', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path } = req.query;

    logger.info('File list requested', { projectId, path, userId: req.user.id });

    // Verify project ownership
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get file tree structure
    const fileTree = await File.getFileTree(projectId);

    // Update project last accessed time
    await project.updateLastAccessed();

    res.json({
      success: true,
      message: 'Files retrieved successfully',
      projectId,
      fileTree,
      path: path || '/'
    });
  } catch (error) {
    logger.error('Failed to list files', {
      error: error.message,
      projectId: req.params.projectId,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve files',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/v1/files/:projectId/content
 * @desc    Read file content
 * @access  Private
 * @query   path - File path to read or fileId
 */
router.get('/:projectId/content', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: filePath, fileId, skipSync = 'false' } = req.query;

    logger.info('File content requested', { projectId, filePath, fileId, skipSync, userId: req.user.id });

    // Verify project ownership
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Find file by ID or path
    let file;
    if (fileId) {
      file = await File.findOne({
        _id: fileId,
        project: projectId
      });
    } else if (filePath) {
      file = await File.findOne({
        path: filePath,
        project: projectId
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'File path or fileId is required'
      });
    }

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (file.type === 'folder') {
      return res.status(400).json({
        success: false,
        message: 'Cannot read content of a folder'
      });
    }

    // Try to get latest content from Google Drive (skip for faster loading)
    let content = file.content;
    
    // Only sync with Drive if explicitly requested (not on every file open)
    if (skipSync === 'false') {
      try {
        // Get user with drive tokens
        const userWithTokens = await User.findById(req.user._id).select('+driveAccessToken +driveRefreshToken');
        
        if (userWithTokens && userWithTokens.driveAccessToken && !userWithTokens.isTokenExpired()) {
          driveFileService.initialize(userWithTokens.driveAccessToken);
          const driveContent = await driveFileService.getFileContent(file.driveId);
          if (driveContent !== file.content) {
            // Update local content if Drive version is different
            file.content = driveContent;
            file.syncStatus = 'synced';
            await file.save();
            content = driveContent;
          }
        } else {
          logger.warn('No drive access token available or token expired', { 
            userId: req.user._id,
            hasToken: !!userWithTokens?.driveAccessToken,
            isExpired: userWithTokens?.isTokenExpired()
          });
        }
      } catch (error) {
        logger.warn('Failed to sync file content from Drive, using local version', {
          error: error.message,
          fileId: file._id
        });
      }
    } else {
      logger.debug('Skipping Drive sync for faster file loading', { fileId: file._id });
    }

    res.json({
      success: true,
      message: 'File content retrieved successfully',
      content,
      metadata: {
        id: file._id,
        name: file.name,
        path: file.path,
        size: file.size,
        extension: file.extension,
        language: file.metadata.language,
        syncStatus: file.syncStatus,
        lastModified: file.updatedAt,
        encoding: file.encoding
      }
    });
  } catch (error) {
    logger.error('Failed to read file content', {
      error: error.message,
      projectId: req.params.projectId,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to read file content',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   PUT /api/v1/files/:projectId/content
 * @desc    Write file content
 * @access  Private
 * @query   path - File path to write or fileId
 */
router.put('/:projectId/content', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: filePath, fileId } = req.query;
    const { content } = req.body;

    logger.info('File write requested', { 
      projectId, 
      filePath, 
      fileId,
      userId: req.user.id
    });

    if (content === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    // Verify project ownership
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Find file by ID or path
    let file;
    if (fileId) {
      file = await File.findOne({
        _id: fileId,
        project: projectId
      });
    } else if (filePath) {
      file = await File.findOne({
        path: filePath,
        project: projectId
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'File path or fileId is required'
      });
    }

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (file.type === 'folder') {
      return res.status(400).json({
        success: false,
        message: 'Cannot write content to a folder'
      });
    }

    if (file.isReadonly) {
      return res.status(403).json({
        success: false,
        message: 'File is read-only'
      });
    }

    // Calculate content hash for sync tracking
    const contentHash = crypto.createHash('md5').update(content).digest('hex');

    // Update file content locally first (local-first approach)
    file.content = content;
    file.localHash = contentHash;
    file.syncStatus = 'syncing';
    file.metadata.lastEditedBy = req.user.id;
    file.metadata.version += 1;
    await file.save();

    // Background sync to Google Drive
    try {
      driveFileService.initialize(req.user.accessToken);
      await driveFileService.updateFile(file.driveId, content, file.mimeType);
      
      file.driveHash = contentHash;
      file.syncStatus = 'synced';
      file.lastSyncedAt = new Date();
      await file.save();
    } catch (error) {
      // Reduce log noise when OAuth is simply not configured
      const isAuthError = error.message && (
        error.message.includes('No access, refresh token') ||
        error.message.includes('invalid_grant') ||
        error.message.includes('access token')
      );
      
      if (isAuthError) {
        logger.debug('Drive sync skipped - OAuth not configured', { fileId: file._id });
      } else {
        logger.error('Failed to sync file to Drive', {
          error: error.message,
          fileId: file._id
        });
      }
      
      file.syncStatus = 'error';
      await file.save();
    }

    // CRITICAL: Sync file to active container immediately
    // This allows terminal to see changes without refresh
    try {
      const terminalService = (await import('../services/terminal.service.js')).default;
      await terminalService.syncFileToContainers(req.user.id, projectId, file.path, content);
    } catch (syncError) {
      logger.error('Failed to sync file to container', {
        error: syncError.message,
        fileId: file._id,
        userId: req.user.id,
        projectId
      });
      // Don't fail the request if container sync fails
    }

    res.json({
      success: true,
      message: 'File content updated successfully',
      metadata: {
        id: file._id,
        name: file.name,
        path: file.path,
        size: file.size,
        syncStatus: file.syncStatus,
        lastModified: file.updatedAt,
        version: file.metadata.version
      }
    });
  } catch (error) {
    logger.error('Failed to write file content', {
      error: error.message,
      projectId: req.params.projectId,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to write file content',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/files/:projectId/create
 * @desc    Create new file or folder
 * @access  Private
 */
router.post('/:projectId/create', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, type, path, parentId, content = '' } = req.body;

    logger.info('File creation requested', { 
      projectId, 
      name, 
      type, 
      path,
      userId: req.user.id 
    });

    if (!name || !type || !path) {
      return res.status(400).json({
        success: false,
        message: 'Name, type, and path are required'
      });
    }

    if (!['file', 'folder'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "file" or "folder"'
      });
    }

    // Verify project ownership
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if file/folder already exists
    const existingFile = await File.findOne({
      project: projectId,
      path: path
    });

    if (existingFile) {
      return res.status(409).json({
        success: false,
        message: 'File or folder already exists at this path'
      });
    }

    // Verify parent folder exists if parentId is provided
    let parentFolder = null;
    if (parentId) {
      parentFolder = await File.findOne({
        _id: parentId,
        project: projectId,
        type: 'folder'
      });

      if (!parentFolder) {
        return res.status(404).json({
          success: false,
          message: 'Parent folder not found'
        });
      }
    }

    // Get user with drive tokens
    const userWithTokens = await User.findById(req.user._id).select('+driveAccessToken +driveRefreshToken +driveTokenExpiresAt');
    
    logger.info('User tokens check for file creation', {
      userId: req.user._id,
      hasAccessToken: !!userWithTokens?.driveAccessToken,
      hasRefreshToken: !!userWithTokens?.driveRefreshToken,
      tokenExpiresAt: userWithTokens?.driveTokenExpiresAt,
      isExpired: userWithTokens?.isTokenExpired()
    });
    
    if (!userWithTokens || !userWithTokens.driveAccessToken) {
      return res.status(401).json({
        success: false,
        message: 'Google Drive access token not found. Please re-authenticate.',
        code: 'DRIVE_AUTH_REQUIRED',
        requiresReauth: true
      });
    }

    // Check if token is expired and try to refresh
    if (userWithTokens.isTokenExpired()) {
      logger.info('Drive access token expired, attempting refresh', { userId: req.user._id });
      
      if (!userWithTokens.driveRefreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Drive access token expired and no refresh token available. Please re-authenticate.',
          code: 'DRIVE_AUTH_EXPIRED',
          requiresReauth: true
        });
      }

      try {
        // Import here to avoid circular dependency
        const { googleDriveService } = await import('../services/googleDrive.service.js');
        const newTokens = await googleDriveService.refreshAccessToken(userWithTokens.driveRefreshToken);
        await userWithTokens.updateDriveTokens(newTokens);
        
        logger.info('Successfully refreshed drive tokens', { userId: req.user._id });
      } catch (refreshError) {
        logger.error('Failed to refresh drive tokens', {
          userId: req.user._id,
          error: refreshError.message
        });
        
        return res.status(401).json({
          success: false,
          message: 'Failed to refresh expired Drive token. Please re-authenticate.',
          code: 'DRIVE_REFRESH_FAILED',
          requiresReauth: true
        });
      }
    }

    driveFileService.initialize(userWithTokens.driveAccessToken);

    let driveFile;
    if (type === 'folder') {
      // Create folder in Google Drive
      driveFile = await driveFileService.createFolder(
        name,
        parentFolder ? parentFolder.driveId : project.driveFolderId
      );
    } else {
      // Create file in Google Drive
      driveFile = await driveFileService.createFile(
        name,
        content,
        parentFolder ? parentFolder.driveId : project.driveFolderId,
        'text/plain'
      );
    }

    // Create file record in database
    const file = new File({
      name,
      path,
      type,
      content: type === 'file' ? content : undefined,
      project: projectId,
      parent: parentId || null,
      driveId: driveFile.id,
      mimeType: type === 'folder' ? 'application/vnd.google-apps.folder' : 'text/plain',
      metadata: {
        lastEditedBy: req.user.id
      }
    });

    logger.info('💾 Creating file in database', {
      name,
      path,
      type,
      driveId: driveFile.id,
      projectId
    });

    await file.save();

    logger.info('✅ File saved to database', {
      fileId: file._id,
      name: file.name,
      driveId: file.driveId,
      path: file.path
    });

    // Update project file count
    if (type === 'file') {
      await Project.findByIdAndUpdate(projectId, {
        $inc: { fileCount: 1 }
      });
    }

    // CRITICAL: Sync new file to active container immediately
    if (type === 'file') {
      try {
        const terminalService = (await import('../services/terminal.service.js')).default;
        await terminalService.syncFileToContainers(req.user.id, projectId, file.path, content);
      } catch (syncError) {
        logger.warn('Failed to sync new file to container (non-critical)', {
          error: syncError.message,
          fileId: file._id
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `${type === 'file' ? 'File' : 'Folder'} created successfully`,
      file: {
        id: file._id,
        name: file.name,
        path: file.path,
        type: file.type,
        size: file.size,
        extension: file.extension,
        syncStatus: file.syncStatus,
        createdAt: file.createdAt,
        metadata: file.metadata
      }
    });
  } catch (error) {
    logger.error('Failed to create file/folder', {
      error: error.message,
      projectId: req.params.projectId,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to create file/folder',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/files/:projectId/search
 * @desc    Search files in project
 * @access  Private
 */
router.post('/:projectId/search', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { query, caseSensitive, wholeWord, useRegex, includePattern, excludePattern } = req.body;

    logger.info('File search requested', { 
      projectId, 
      query,
      options: { caseSensitive, wholeWord, useRegex },
      userId: req.user.id 
    });

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Verify project ownership
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get all files in project
    const files = await File.find({
      project: projectId,
      type: 'file' // Only search in files, not folders
    });

    // Build search pattern
    let searchPattern;
    if (useRegex) {
      try {
        searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid regular expression'
        });
      }
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
      searchPattern = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    }

    // Apply file filters
    let filteredFiles = files;
    
    if (excludePattern) {
      const excludePatterns = excludePattern.split(',').map(p => p.trim()).filter(p => p);
      filteredFiles = filteredFiles.filter(file => {
        return !excludePatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          return regex.test(file.path || file.name);
        });
      });
    }

    if (includePattern) {
      const includePatterns = includePattern.split(',').map(p => p.trim()).filter(p => p);
      filteredFiles = filteredFiles.filter(file => {
        return includePatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          return regex.test(file.path || file.name);
        });
      });
    }

    // Search in files
    const results = [];
    for (const file of filteredFiles) {
      if (!file.content) continue;

      const lines = file.content.split('\n');
      const matches = [];

      lines.forEach((line, lineIndex) => {
        const lineMatches = [...line.matchAll(searchPattern)];
        if (lineMatches.length > 0) {
          matches.push({
            lineNumber: lineIndex + 1,
            lineText: line,
            matchCount: lineMatches.length
          });
        }
      });

      if (matches.length > 0) {
        results.push({
          file: {
            id: file._id,
            name: file.name,
            path: file.path,
            type: file.type
          },
          matches: matches,
          totalMatches: matches.reduce((sum, m) => sum + m.matchCount, 0)
        });
      }
    }

    res.json({
      success: true,
      query,
      results,
      totalMatches: results.reduce((sum, r) => sum + r.totalMatches, 0),
      totalFiles: results.length
    });
  } catch (error) {
    logger.error('Failed to search files', {
      error: error.message,
      projectId: req.params.projectId,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to search files',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   PATCH /api/v1/files/:projectId/:fileId/rename
 * @desc    Rename file or folder
 * @access  Private
 */
router.patch('/:projectId/:fileId/rename', authenticateToken, async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    const { newName } = req.body;

    logger.info('File rename requested', { 
      projectId, 
      fileId,
      newName,
      userId: req.user.id 
    });

    if (!newName || !newName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'New name is required'
      });
    }

    // Verify project ownership
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Find file
    const file = await File.findOne({
      _id: fileId,
      project: projectId
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const oldName = file.name;
    const oldPath = file.path;

    // Build new path
    const pathParts = oldPath.split('/');
    pathParts[pathParts.length - 1] = newName.trim();
    const newPath = pathParts.join('/');

    // Check if new path already exists
    const existingFile = await File.findOne({
      path: newPath,
      project: projectId,
      _id: { $ne: fileId }
    });

    if (existingFile) {
      return res.status(409).json({
        success: false,
        message: `A ${file.type} with the name "${newName}" already exists in this location`
      });
    }

    // Update file in database
    file.name = newName.trim();
    file.path = newPath;
    
    // Update extension if it's a file
    if (file.type === 'file') {
      const extMatch = newName.match(/\.([^.]+)$/);
      file.extension = extMatch ? extMatch[1] : '';
    }

    await file.save();

    // Rename in Google Drive if driveId exists
    if (file.driveId) {
      try {
        driveFileService.initialize(req.user.accessToken, req.user.refreshToken);
        await driveFileService.renameFile(file.driveId, newName.trim());
        logger.info('✅ Renamed file in Google Drive', { 
          fileId: file._id, 
          oldName, 
          newName: newName.trim() 
        });
      } catch (error) {
        const isAuthError = error.message && (
          error.message.includes('No access, refresh token') ||
          error.message.includes('invalid_grant') ||
          error.message.includes('access token')
        );
        
        if (isAuthError) {
          logger.debug('Drive sync skipped - OAuth not configured', { fileId: file._id });
        } else {
          logger.error('❌ Failed to rename file in Drive', {
            error: error.message,
            fileId: file._id
          });
        }
      }
    }

    // Rename in container if it exists
    try {
      const terminalService = (await import('../services/terminal.service.js')).default;
      const dockerService = (await import('../services/docker.service.js')).default;
      const containerKey = `${req.user.id}:${projectId}`;
      const container = terminalService.projectContainers.get(containerKey);
      
      if (container) {
        const oldContainerPath = oldPath.startsWith('/') 
          ? `/workspace${oldPath}` 
          : `/workspace/${oldPath}`;
        const newContainerPath = newPath.startsWith('/') 
          ? `/workspace${newPath}` 
          : `/workspace/${newPath}`;
        
        await dockerService.executeCommand(
          container.id,
          `mv "${oldContainerPath}" "${newContainerPath}"`
        );
        logger.info('✅ Renamed file in container', { 
          fileId: file._id, 
          oldPath: oldContainerPath,
          newPath: newContainerPath 
        });
      }
    } catch (syncError) {
      logger.warn('Failed to rename file in container (non-critical)', {
        error: syncError.message,
        fileId: file._id
      });
    }

    // If it's a folder, update paths of all children recursively
    if (file.type === 'folder') {
      await updateChildrenPaths(fileId, oldPath, newPath);
    }

    res.json({
      success: true,
      message: `${file.type === 'file' ? 'File' : 'Folder'} renamed successfully`,
      file: {
        id: file._id,
        name: file.name,
        path: file.path,
        type: file.type,
        oldName,
        oldPath
      }
    });
  } catch (error) {
    logger.error('Failed to rename file', {
      error: error.message,
      projectId: req.params.projectId,
      fileId: req.params.fileId,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to rename file',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Helper function to update paths of all children when a folder is renamed
async function updateChildrenPaths(folderId, oldParentPath, newParentPath) {
  try {
    const children = await File.find({ parent: folderId });

    for (const child of children) {
      const oldChildPath = child.path;
      const newChildPath = oldChildPath.replace(oldParentPath, newParentPath);
      
      child.path = newChildPath;
      await child.save();

      // Recursively update if this child is also a folder
      if (child.type === 'folder') {
        await updateChildrenPaths(child._id, oldChildPath, newChildPath);
      }
    }
  } catch (error) {
    logger.error('Failed to update children paths', {
      error: error.message,
      folderId
    });
    throw error;
  }
}

/**
 * @route   DELETE /api/v1/files/:projectId/:fileId
 * @desc    Delete file or folder
 * @access  Private
 */
router.delete('/:projectId/:fileId', authenticateToken, async (req, res) => {
  try {
    const { projectId, fileId } = req.params;

    logger.info('File deletion requested', { projectId, fileId, userId: req.user.id });

    // Verify project ownership
    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Find the file/folder
    const file = await File.findOne({
      _id: fileId,
      project: projectId
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // If it's a folder, delete all children recursively
    if (file.type === 'folder') {
      await deleteFolder(file._id, req.user.accessToken, req.user.refreshToken);
    } else {
      // Delete single file from Drive
      logger.info('🗑️ Attempting to delete file', { 
        fileId: file._id, 
        driveId: file.driveId,
        hasDriveId: !!file.driveId,
        fileName: file.name,
        path: file.path
      });
      
      // Always try to delete from Drive if driveId exists
      if (file.driveId) {
        try {
          // CRITICAL: Need to refresh user tokens before Drive operations
          const user = await User.findById(req.user.id);
          if (!user || !user.googleDrive) {
            logger.warn('⚠️ User has no Google Drive configured', { userId: req.user.id });
          } else {
            // Check if token is expired and refresh if needed
            if (user.googleDrive.tokenExpiry && new Date(user.googleDrive.tokenExpiry) < new Date()) {
              logger.info('🔄 Refreshing expired Google Drive token', { userId: req.user.id });
              // Token will be refreshed by driveFileService
            }
            
            driveFileService.initialize(
              user.googleDrive.accessToken, 
              user.googleDrive.refreshToken,
              user.googleDrive.tokenExpiry
            );
            
            await driveFileService.deleteFile(file.driveId);
            logger.info('✅ Deleted file from Google Drive', { 
              fileId: file._id, 
              driveId: file.driveId,
              fileName: file.name 
            });
          }
        } catch (error) {
          // Log all errors for debugging
          logger.error('❌ Failed to delete file from Drive', {
            error: error.message,
            stack: error.stack,
            fileId: file._id,
            driveId: file.driveId,
            fileName: file.name
          });
          
          // Don't throw - continue with database deletion
          // The file might already be deleted from Drive
        }
      } else {
        logger.warn('⚠️ File has no driveId, skipping Drive deletion', { 
          fileId: file._id,
          fileName: file.name,
          path: file.path
        });
      }

      // CRITICAL: Also delete from container if it exists there
      try {
        const terminalServiceModule = await import('../services/terminal.service.js');
        const terminalService = terminalServiceModule.default;
        const dockerServiceModule = await import('../services/docker.service.js');
        const dockerService = dockerServiceModule.default;
        
        // Find active terminal for this project
        const userTerminals = terminalService.getUserTerminals(req.user.id);
        const projectTerminal = userTerminals.find(t => t.projectId === projectId);
        
        if (projectTerminal && projectTerminal.container) {
          const containerId = projectTerminal.container.id;
          const containerPath = `/workspace${file.path}`;
          
          logger.info('🗑️ Deleting file from container', { 
            fileId: file._id, 
            containerId, 
            containerPath 
          });
          
          await dockerService.executeCommand(containerId, `rm -f ${containerPath}`);
          logger.info('✅ Deleted file from container', { fileId: file._id, containerPath });
        }
      } catch (containerError) {
        logger.warn('Failed to delete file from container (non-critical)', {
          error: containerError.message,
          fileId: file._id
        });
      }

      // Update project file count
      await Project.findByIdAndUpdate(projectId, {
        $inc: { fileCount: -1 }
      });
    }

    // Delete file record from database
    await File.findByIdAndDelete(fileId);

    // CRITICAL: Delete file from active container immediately
    if (file.type === 'file') {
      try {
        const terminalService = (await import('../services/terminal.service.js')).default;
        const dockerService = (await import('../services/docker.service.js')).default;
        const containerKey = `${req.user.id}:${projectId}`;
        const container = terminalService.projectContainers.get(containerKey);
        
        if (container) {
          const normalizedPath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
          await dockerService.executeCommand(
            container.id,
            `rm -f /workspace/${normalizedPath}`
          );
        }
      } catch (syncError) {
        logger.warn('Failed to delete file from container (non-critical)', {
          error: syncError.message,
          fileId: file._id
        });
      }
    }

    res.json({
      success: true,
      message: `${file.type === 'file' ? 'File' : 'Folder'} deleted successfully`,
      deletedFile: {
        id: file._id,
        name: file.name,
        type: file.type
      }
    });
  } catch (error) {
    logger.error('Failed to delete file', {
      error: error.message,
      projectId: req.params.projectId,
      fileId: req.params.fileId,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Helper function to recursively delete folder and its contents
async function deleteFolder(folderId, accessToken, refreshToken) {
  try {
    // Find all children of this folder
    const children = await File.find({ parent: folderId });

    for (const child of children) {
      if (child.type === 'folder') {
        // Recursively delete subfolders
        await deleteFolder(child._id, accessToken, refreshToken);
      } else {
        // Delete file from Drive
        try {
          driveFileService.initialize(accessToken, refreshToken);
          if (child.driveId) {
            await driveFileService.deleteFile(child.driveId);
            logger.info('Deleted child file from Drive', { fileId: child._id, driveId: child.driveId });
          }
        } catch (error) {
          logger.warn('Failed to delete child file from Drive', {
            error: error.message,
            fileId: child._id
          });
        }
      }
      
      // Delete child from database
      await File.findByIdAndDelete(child._id);
    }

    // Delete the folder itself from Drive
    const folder = await File.findById(folderId);
    if (folder) {
      try {
        driveFileService.initialize(accessToken, refreshToken);
        if (folder.driveId) {
          await driveFileService.deleteFile(folder.driveId);
          logger.info('Deleted folder from Drive', { folderId: folder._id, driveId: folder.driveId });
        }
      } catch (error) {
        logger.warn('Failed to delete folder from Drive', {
          error: error.message,
          folderId: folder._id
        });
      }
    }
  } catch (error) {
    logger.error('Failed to delete folder recursively', {
      error: error.message,
      folderId
    });
    throw error;
  }
}

export default router;
