import { google } from 'googleapis';
import { logger } from '../utils/logger.js';
import { googleDriveService } from './googleDrive.service.js';

class DriveFileService {
  constructor() {
    this.drive = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiryTime = null;
  }

  // Initialize with authenticated Drive client
  initialize(accessToken, refreshToken = null, expiryTime = null) {
    try {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.tokenExpiryTime = expiryTime;
      
      // Ensure googleDriveService is initialized first
      if (!googleDriveService.oauth2Client) {
        googleDriveService._initialize();
      }
      
      // Set credentials on the OAuth client for automatic token refresh
      if (refreshToken) {
        googleDriveService.oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
          expiry_date: expiryTime
        });
      } else {
        googleDriveService.oauth2Client.setCredentials({
          access_token: accessToken,
          expiry_date: expiryTime
        });
      }
      
      this.drive = googleDriveService.getDriveClient(accessToken);
      logger.info('✅ DriveFile service initialized', { 
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        expiryTime: expiryTime ? new Date(expiryTime).toISOString() : 'not set'
      });
    } catch (error) {
      logger.error('❌ Failed to initialize DriveFile service', { 
        error: error.message,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken
      });
      throw error;
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized() {
    return this.drive !== null;
  }

  /**
   * Check if access token is expired or about to expire
   */
  isTokenExpired() {
    if (!this.tokenExpiryTime) return false;
    
    // Consider expired if less than 5 minutes remaining
    const now = Date.now();
    const expiryTime = new Date(this.tokenExpiryTime).getTime();
    const fiveMinutes = 5 * 60 * 1000;
    
    return (expiryTime - now) < fiveMinutes;
  }

  /**
   * Refresh the access token if expired
   */
  async refreshTokenIfNeeded() {
    if (!this.isTokenExpired() || !this.refreshToken) {
      return; // Token still valid or no refresh token available
    }

    try {
      logger.info('🔄 Refreshing expired access token');
      const newTokens = await googleDriveService.refreshAccessToken(this.refreshToken);
      
      // Re-initialize with new tokens
      this.initialize(
        newTokens.access_token,
        this.refreshToken, // Keep the same refresh token
        newTokens.expiry_date
      );
      
      logger.info('✅ Access token refreshed successfully');
    } catch (error) {
      logger.error('❌ Failed to refresh access token', { error: error.message });
      throw new Error('Session expired. Please re-authenticate.');
    }
  }

  /**
   * Ensure service is initialized and token is valid before operations
   */
  async ensureInitialized() {
    if (!this.isInitialized()) {
      throw new Error('Drive service not initialized. Call initialize(accessToken) first.');
    }
    
    // Refresh token if needed
    await this.refreshTokenIfNeeded();
  }

  /**
   * Create a new project folder in Google Drive
   */
  async createProjectFolder(projectName, parentFolderId = null) {
    await this.ensureInitialized();
    try {
      const folderMetadata = {
        name: projectName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      const response = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, mimeType, createdTime, modifiedTime'
      });

      logger.info('Project folder created in Drive', {
        folderId: response.data.id,
        folderName: projectName
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create project folder in Drive', {
        error: error.message,
        projectName
      });
      throw new Error(`Failed to create project folder: ${error.message}`);
    }
  }

  /**
   * Create a file in Google Drive
   */
  async createFile(fileName, content, parentFolderId, mimeType = 'text/plain') {
    await this.ensureInitialized();
    try {
      const fileMetadata = {
        name: fileName,
        parents: [parentFolderId]
      };

      const media = {
        mimeType,
        body: content
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, mimeType, size, createdTime, modifiedTime, md5Checksum'
      });

      logger.info('File created in Drive', {
        fileId: response.data.id,
        fileName,
        size: response.data.size
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create file in Drive', {
        error: error.message,
        fileName
      });
      throw new Error(`Failed to create file: ${error.message}`);
    }
  }

  /**
   * Update file content in Google Drive
   */
  async updateFile(fileId, content, mimeType = 'text/plain') {
    await this.ensureInitialized();
    try {
      const media = {
        mimeType,
        body: content
      };

      const response = await this.drive.files.update({
        fileId: fileId,
        media: media,
        fields: 'id, name, mimeType, size, modifiedTime, md5Checksum'
      });

      logger.info('File updated in Drive', {
        fileId,
        size: response.data.size
      });

      return response.data;
    } catch (error) {
      // Reduce log noise when OAuth is simply not configured
      const isAuthError = error.message && (
        error.message.includes('No access, refresh token') ||
        error.message.includes('invalid_grant') ||
        error.message.includes('access token')
      );
      
      if (isAuthError) {
        logger.debug('Drive sync skipped - OAuth not configured', { fileId });
      } else {
        logger.error('Failed to update file in Drive', {
          error: error.message,
          fileId
        });
      }
      throw new Error(`Failed to update file: ${error.message}`);
    }
  }

  /**
   * Get file content from Google Drive
   */
  async getFileContent(fileId) {
    await this.ensureInitialized();
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get file content from Drive', {
        error: error.message,
        fileId
      });
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  /**
   * Get file metadata from Google Drive
   */
  async getFileMetadata(fileId) {
    await this.ensureInitialized();
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, createdTime, modifiedTime, md5Checksum, parents'
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get file metadata from Drive', {
        error: error.message,
        fileId
      });
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(folderId, pageSize = 100) {
    await this.ensureInitialized();
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, md5Checksum)',
        pageSize,
        orderBy: 'folder,name'
      });

      return response.data.files;
    } catch (error) {
      logger.error('Failed to list files from Drive', {
        error: error.message,
        folderId
      });
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId) {
    await this.ensureInitialized();
    
    logger.info('🗑️  Attempting to delete file from Drive', { fileId });
    
    try {
      await this.drive.files.delete({
        fileId: fileId
      });

      logger.info('✅ File deleted from Drive successfully', { fileId });
      return true;
    } catch (error) {
      // Check if it's an auth error (user hasn't set up Google Drive)
      const isAuthError = error.message && (
        error.message.includes('No access, refresh token') ||
        error.message.includes('invalid_grant') ||
        error.message.includes('Missing required parameter')
      );

      if (isAuthError) {
        logger.debug('Drive delete skipped - not configured', { fileId });
      } else {
        logger.error('Failed to delete file from Drive', {
          error: error.message,
          fileId
        });
      }
      
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Create folder in Google Drive
   */
  async createFolder(folderName, parentFolderId) {
    await this.ensureInitialized();
    try {
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      };

      const response = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, mimeType, createdTime, modifiedTime'
      });

      logger.info('Folder created in Drive', {
        folderId: response.data.id,
        folderName
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create folder in Drive', {
        error: error.message,
        folderName
      });
      throw new Error(`Failed to create folder: ${error.message}`);
    }
  }

  /**
   * Move file to different parent folder
   */
  async moveFile(fileId, newParentId, oldParentId) {
    await this.ensureInitialized();
    try {
      const response = await this.drive.files.update({
        fileId: fileId,
        addParents: newParentId,
        removeParents: oldParentId,
        fields: 'id, name, parents'
      });

      logger.info('File moved in Drive', {
        fileId,
        newParentId,
        oldParentId
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to move file in Drive', {
        error: error.message,
        fileId
      });
      throw new Error(`Failed to move file: ${error.message}`);
    }
  }

  /**
   * Rename file in Google Drive
   */
  async renameFile(fileId, newName) {
    await this.ensureInitialized();
    try {
      const response = await this.drive.files.update({
        fileId: fileId,
        resource: {
          name: newName
        },
        fields: 'id, name, modifiedTime'
      });

      logger.info('File renamed in Drive', {
        fileId,
        newName
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to rename file in Drive', {
        error: error.message,
        fileId,
        newName
      });
      throw new Error(`Failed to rename file: ${error.message}`);
    }
  }

  /**
   * Get projects folder or create if doesn't exist
   */
  async getOrCreateProjectsFolder() {
    await this.ensureInitialized();
    try {
      // First, try to find existing "AI-IDE Projects" folder
      const response = await this.drive.files.list({
        q: "name='AI-IDE Projects' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)'
      });

      if (response.data.files.length > 0) {
        return response.data.files[0];
      }

      // Create the folder if it doesn't exist
      return await this.createProjectFolder('AI-IDE Projects');
    } catch (error) {
      logger.error('Failed to get or create projects folder', {
        error: error.message
      });
      throw new Error(`Failed to get or create projects folder: ${error.message}`);
    }
  }

  /**
   * Check if file exists in Drive
   */
  async fileExists(fileName, parentFolderId) {
    try {
      const response = await this.drive.files.list({
        q: `name='${fileName}' and '${parentFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)'
      });

      return response.data.files.length > 0 ? response.data.files[0] : null;
    } catch (error) {
      logger.error('Failed to check file existence in Drive', {
        error: error.message,
        fileName
      });
      return null;
    }
  }
}

export const driveFileService = new DriveFileService();
