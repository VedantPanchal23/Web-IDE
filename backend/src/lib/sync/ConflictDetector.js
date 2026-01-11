import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

/**
 * Conflict types
 */
export const ConflictType = {
  MODIFY_MODIFY: 'modify-modify',
  DELETE_MODIFY: 'delete-modify',
  RENAME_RENAME: 'rename-rename',
  CONTENT_DIVERGED: 'content-diverged'
};

/**
 * Detects conflicts between local and remote file versions
 */
export class ConflictDetector {
  constructor() {
    this.conflictThresholdMs = 5000; // 5 seconds threshold for simultaneous edits
  }

  /**
   * Detect if there's a conflict between local and remote file versions
   * @param {Object} localFile - Local file object from database
   * @param {Object} remoteFile - Remote file data from Google Drive
   * @returns {Object|null} Conflict information or null if no conflict
   */
  detectConflict(localFile, remoteFile) {
    try {
      // Check if both versions have been modified
      const localModified = new Date(localFile.updatedAt);
      const remoteModified = new Date(remoteFile.modifiedTime);
      const timeDiff = Math.abs(localModified.getTime() - remoteModified.getTime());

      // Calculate content hashes
      const localContent = localFile.content || '';
      const remoteContent = remoteFile.content || '';
      
      const localHash = crypto.createHash('md5').update(localContent, 'utf8').digest('hex');
      const remoteHash = remoteFile.hash || crypto.createHash('md5').update(remoteContent, 'utf8').digest('hex');

      // No conflict if content is identical
      if (localHash === remoteHash) {
        return null;
      }

      // Check if both files were modified recently (potential conflict)
      if (timeDiff < this.conflictThresholdMs) {
        return this.createConflictInfo(
          ConflictType.MODIFY_MODIFY,
          localFile,
          remoteFile,
          'Both local and remote versions were modified simultaneously'
        );
      }

      // Check for content divergence
      if (this.hasContentDiverged(localFile, remoteFile)) {
        return this.createConflictInfo(
          ConflictType.CONTENT_DIVERGED,
          localFile,
          remoteFile,
          'Local and remote content have diverged significantly'
        );
      }

      // Check if local file was deleted but remote was modified
      if (localFile.isDeleted && remoteModified > localModified) {
        return this.createConflictInfo(
          ConflictType.DELETE_MODIFY,
          localFile,
          remoteFile,
          'Local file was deleted but remote version was modified'
        );
      }

      // No conflict detected
      return null;

    } catch (error) {
      logger.error('Error detecting conflict', {
        fileId: localFile._id,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Check if content has diverged significantly between versions
   * @param {Object} localFile - Local file
   * @param {Object} remoteFile - Remote file
   * @returns {boolean} True if content has diverged
   */
  hasContentDiverged(localFile, remoteFile) {
    const localContent = localFile.content || '';
    const remoteContent = remoteFile.content || '';

    // Simple heuristics for content divergence
    const localLines = localContent.split('\n');
    const remoteLines = remoteContent.split('\n');

    // Check for significant line count differences
    const lineDiffRatio = Math.abs(localLines.length - remoteLines.length) / Math.max(localLines.length, remoteLines.length);
    if (lineDiffRatio > 0.3) { // More than 30% line difference
      return true;
    }

    // Check for significant character count differences
    const charDiffRatio = Math.abs(localContent.length - remoteContent.length) / Math.max(localContent.length, remoteContent.length);
    if (charDiffRatio > 0.5) { // More than 50% character difference
      return true;
    }

    // Use Levenshtein distance for small files
    if (localContent.length < 1000 && remoteContent.length < 1000) {
      const distance = this.calculateLevenshteinDistance(localContent, remoteContent);
      const maxLength = Math.max(localContent.length, remoteContent.length);
      const similarity = 1 - (distance / maxLength);
      
      if (similarity < 0.5) { // Less than 50% similarity
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Levenshtein distance
   */
  calculateLevenshteinDistance(str1, str2) {
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Create conflict information object
   * @param {string} type - Conflict type
   * @param {Object} localFile - Local file
   * @param {Object} remoteFile - Remote file
   * @param {string} description - Conflict description
   * @returns {Object} Conflict information
   */
  createConflictInfo(type, localFile, remoteFile, description) {
    return {
      type,
      description,
      fileId: localFile._id,
      fileName: localFile.name,
      filePath: localFile.path,
      localVersion: {
        content: localFile.content,
        modifiedAt: localFile.updatedAt,
        hash: localFile.localHash
      },
      remoteVersion: {
        content: remoteFile.content,
        modifiedAt: remoteFile.modifiedTime,
        hash: remoteFile.hash
      },
      detectedAt: new Date(),
      resolutionOptions: this.getResolutionOptions(type)
    };
  }

  /**
   * Get available resolution options for a conflict type
   * @param {string} conflictType - Type of conflict
   * @returns {Array} Array of resolution options
   */
  getResolutionOptions(conflictType) {
    const baseOptions = [
      {
        strategy: 'keep-local',
        label: 'Keep Local Version',
        description: 'Use the local file version and overwrite remote'
      },
      {
        strategy: 'keep-remote', 
        label: 'Keep Remote Version',
        description: 'Use the remote file version and overwrite local'
      }
    ];

    switch (conflictType) {
      case ConflictType.MODIFY_MODIFY:
      case ConflictType.CONTENT_DIVERGED:
        return [
          ...baseOptions,
          {
            strategy: 'merge',
            label: 'Attempt Auto-Merge',
            description: 'Try to automatically merge both versions'
          },
          {
            strategy: 'manual',
            label: 'Manual Resolution',
            description: 'Manually resolve conflicts in editor'
          }
        ];

      case ConflictType.DELETE_MODIFY:
        return [
          {
            strategy: 'keep-local',
            label: 'Keep Deleted',
            description: 'Keep the file deleted'
          },
          {
            strategy: 'keep-remote',
            label: 'Restore File',
            description: 'Restore file with remote changes'
          }
        ];

      case ConflictType.RENAME_RENAME:
        return [
          ...baseOptions,
          {
            strategy: 'rename-both',
            label: 'Keep Both',
            description: 'Keep both files with different names'
          }
        ];

      default:
        return baseOptions;
    }
  }

  /**
   * Batch conflict detection for multiple files
   * @param {Array} localFiles - Array of local files
   * @param {Array} remoteFiles - Array of remote files
   * @returns {Array} Array of conflicts detected
   */
  detectBatchConflicts(localFiles, remoteFiles) {
    const conflicts = [];
    
    // Create a map of remote files by ID for quick lookup
    const remoteFileMap = new Map();
    remoteFiles.forEach(remoteFile => {
      if (remoteFile.id) {
        remoteFileMap.set(remoteFile.id, remoteFile);
      }
    });

    // Check each local file for conflicts
    localFiles.forEach(localFile => {
      if (localFile.driveId) {
        const remoteFile = remoteFileMap.get(localFile.driveId);
        if (remoteFile) {
          const conflict = this.detectConflict(localFile, remoteFile);
          if (conflict) {
            conflicts.push(conflict);
          }
        }
      }
    });

    logger.info('Batch conflict detection completed', {
      localFileCount: localFiles.length,
      remoteFileCount: remoteFiles.length,
      conflictsFound: conflicts.length
    });

    return conflicts;
  }

  /**
   * Set conflict detection threshold
   * @param {number} thresholdMs - Threshold in milliseconds
   */
  setConflictThreshold(thresholdMs) {
    this.conflictThresholdMs = thresholdMs;
    logger.info('Conflict threshold updated', { thresholdMs });
  }
}