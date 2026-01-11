import { logger } from '../../utils/logger.js';

/**
 * Three-way merge utility for automatic conflict resolution
 * Implements a basic text-based three-way merge algorithm
 */
export class ThreeWayMerge {
  constructor() {
    this.conflictMarkers = {
      local: '<<<<<<< LOCAL',
      separator: '=======',
      remote: '>>>>>>> REMOTE'
    };
  }

  /**
   * Perform a three-way merge
   * @param {string} baseContent - Original content (common ancestor)
   * @param {string} localContent - Local modifications
   * @param {string} remoteContent - Remote modifications
   * @returns {Object} Merge result with success flag and merged content
   */
  merge(baseContent, localContent, remoteContent) {
    try {
      // If contents are identical, no merge needed
      if (localContent === remoteContent) {
        return {
          success: true,
          content: localContent,
          conflicts: [],
          message: 'No merge required - contents are identical'
        };
      }

      // If local content matches base, use remote (remote-only changes)
      if (localContent === baseContent) {
        return {
          success: true,
          content: remoteContent,
          conflicts: [],
          message: 'Using remote version - no local changes'
        };
      }

      // If remote content matches base, use local (local-only changes)
      if (remoteContent === baseContent) {
        return {
          success: true,
          content: localContent,
          conflicts: [],
          message: 'Using local version - no remote changes'
        };
      }

      // Perform line-by-line three-way merge
      const baseLines = this.splitLines(baseContent);
      const localLines = this.splitLines(localContent);
      const remoteLines = this.splitLines(remoteContent);

      const mergeResult = this.performLineBasedMerge(baseLines, localLines, remoteLines);

      if (mergeResult.conflicts.length === 0) {
        return {
          success: true,
          content: mergeResult.lines.join('\n'),
          conflicts: [],
          message: 'Automatic merge successful'
        };
      } else {
        return {
          success: false,
          content: mergeResult.lines.join('\n'),
          conflicts: mergeResult.conflicts,
          message: `Merge completed with ${mergeResult.conflicts.length} conflicts`
        };
      }

    } catch (error) {
      logger.error('Three-way merge failed', {
        error: error.message
      });

      return {
        success: false,
        content: this.createManualMergeContent(localContent, remoteContent),
        conflicts: [{
          type: 'merge_error',
          message: error.message,
          lineStart: 1,
          lineEnd: Math.max(
            localContent.split('\n').length,
            remoteContent.split('\n').length
          )
        }],
        message: 'Merge failed - manual resolution required'
      };
    }
  }

  /**
   * Split content into lines, preserving empty lines
   * @param {string} content - Content to split
   * @returns {Array} Array of lines
   */
  splitLines(content) {
    if (!content) return [''];
    const lines = content.split('\n');
    // Ensure we always have at least one line
    return lines.length === 0 ? [''] : lines;
  }

  /**
   * Perform line-based three-way merge
   * @param {Array} baseLines - Base version lines
   * @param {Array} localLines - Local version lines
   * @param {Array} remoteLines - Remote version lines
   * @returns {Object} Merge result with lines and conflicts
   */
  performLineBasedMerge(baseLines, localLines, remoteLines) {
    const result = {
      lines: [],
      conflicts: []
    };

    // Simple algorithm: compare line by line
    const maxLines = Math.max(baseLines.length, localLines.length, remoteLines.length);

    for (let i = 0; i < maxLines; i++) {
      const baseLine = baseLines[i] || '';
      const localLine = localLines[i] || '';
      const remoteLine = remoteLines[i] || '';

      if (localLine === remoteLine) {
        // No conflict - both versions are the same
        result.lines.push(localLine);
      } else if (localLine === baseLine) {
        // Local unchanged, use remote
        result.lines.push(remoteLine);
      } else if (remoteLine === baseLine) {
        // Remote unchanged, use local
        result.lines.push(localLine);
      } else {
        // Conflict - both sides changed
        const conflictStartLine = result.lines.length;
        
        result.lines.push(this.conflictMarkers.local);
        result.lines.push(localLine);
        result.lines.push(this.conflictMarkers.separator);
        result.lines.push(remoteLine);
        result.lines.push(this.conflictMarkers.remote);

        result.conflicts.push({
          type: 'content_conflict',
          lineStart: conflictStartLine,
          lineEnd: result.lines.length - 1,
          localContent: localLine,
          remoteContent: remoteLine,
          baseContent: baseLine
        });
      }
    }

    return result;
  }

  /**
   * Create manual merge content with conflict markers
   * @param {string} localContent - Local content
   * @param {string} remoteContent - Remote content
   * @returns {string} Content with conflict markers for manual resolution
   */
  createManualMergeContent(localContent, remoteContent) {
    const lines = [
      this.conflictMarkers.local,
      localContent,
      this.conflictMarkers.separator,
      remoteContent,
      this.conflictMarkers.remote
    ];

    return lines.join('\n');
  }

  /**
   * Check if content has unresolved conflict markers
   * @param {string} content - Content to check
   * @returns {boolean} True if content has conflict markers
   */
  hasConflictMarkers(content) {
    return content.includes(this.conflictMarkers.local) ||
           content.includes(this.conflictMarkers.separator) ||
           content.includes(this.conflictMarkers.remote);
  }

  /**
   * Extract conflicts from content with markers
   * @param {string} content - Content with conflict markers
   * @returns {Array} Array of conflict information
   */
  extractConflicts(content) {
    const conflicts = [];
    const lines = content.split('\n');
    
    let inConflict = false;
    let conflictStart = -1;
    let separatorLine = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith(this.conflictMarkers.local.split(' ')[0])) {
        inConflict = true;
        conflictStart = i;
      } else if (line === this.conflictMarkers.separator && inConflict) {
        separatorLine = i;
      } else if (line.startsWith(this.conflictMarkers.remote.split(' ')[0]) && inConflict) {
        if (conflictStart !== -1 && separatorLine !== -1) {
          const localLines = lines.slice(conflictStart + 1, separatorLine);
          const remoteLines = lines.slice(separatorLine + 1, i);
          
          conflicts.push({
            type: 'merge_conflict',
            lineStart: conflictStart,
            lineEnd: i,
            localContent: localLines.join('\n'),
            remoteContent: remoteLines.join('\n')
          });
        }
        
        inConflict = false;
        conflictStart = -1;
        separatorLine = -1;
      }
    }
    
    return conflicts;
  }

  /**
   * Resolve conflicts by choosing a strategy for each conflict
   * @param {string} content - Content with conflict markers
   * @param {string} strategy - Resolution strategy ('local', 'remote', or 'manual')
   * @returns {string} Resolved content
   */
  resolveConflicts(content, strategy = 'local') {
    if (!this.hasConflictMarkers(content)) {
      return content;
    }

    const lines = content.split('\n');
    const resolvedLines = [];
    
    let inConflict = false;
    let localLines = [];
    let remoteLines = [];
    let phase = 'local'; // 'local' or 'remote'
    
    for (const line of lines) {
      if (line.startsWith(this.conflictMarkers.local.split(' ')[0])) {
        inConflict = true;
        localLines = [];
        remoteLines = [];
        phase = 'local';
        continue;
      }
      
      if (line === this.conflictMarkers.separator && inConflict) {
        phase = 'remote';
        continue;
      }
      
      if (line.startsWith(this.conflictMarkers.remote.split(' ')[0]) && inConflict) {
        // End of conflict - apply resolution strategy
        if (strategy === 'local') {
          resolvedLines.push(...localLines);
        } else if (strategy === 'remote') {
          resolvedLines.push(...remoteLines);
        } else {
          // Keep conflict markers for manual resolution
          resolvedLines.push(this.conflictMarkers.local);
          resolvedLines.push(...localLines);
          resolvedLines.push(this.conflictMarkers.separator);
          resolvedLines.push(...remoteLines);
          resolvedLines.push(line);
        }
        
        inConflict = false;
        continue;
      }
      
      if (inConflict) {
        if (phase === 'local') {
          localLines.push(line);
        } else {
          remoteLines.push(line);
        }
      } else {
        resolvedLines.push(line);
      }
    }
    
    return resolvedLines.join('\n');
  }

  /**
   * Calculate merge statistics
   * @param {string} baseContent - Base content
   * @param {string} localContent - Local content  
   * @param {string} remoteContent - Remote content
   * @returns {Object} Merge statistics
   */
  getMergeStats(baseContent, localContent, remoteContent) {
    const baseLines = this.splitLines(baseContent);
    const localLines = this.splitLines(localContent);
    const remoteLines = this.splitLines(remoteContent);

    let localChanges = 0;
    let remoteChanges = 0;
    let conflicts = 0;

    const maxLines = Math.max(baseLines.length, localLines.length, remoteLines.length);

    for (let i = 0; i < maxLines; i++) {
      const baseLine = baseLines[i] || '';
      const localLine = localLines[i] || '';
      const remoteLine = remoteLines[i] || '';

      const localChanged = localLine !== baseLine;
      const remoteChanged = remoteLine !== baseLine;

      if (localChanged) localChanges++;
      if (remoteChanged) remoteChanges++;
      if (localChanged && remoteChanged && localLine !== remoteLine) {
        conflicts++;
      }
    }

    return {
      localChanges,
      remoteChanges,
      conflicts,
      totalLines: maxLines,
      changeRatio: (localChanges + remoteChanges) / maxLines
    };
  }
}

export default ThreeWayMerge;