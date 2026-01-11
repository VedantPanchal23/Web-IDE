import express from 'express';
import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.js';
import { File } from '../models/File.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/v1/search/workspace
 * @desc    Search across all files in a project
 * @access  Private
 */
router.post('/workspace', authenticateToken, async (req, res) => {
  try {
    const { 
      projectId, 
      query, 
      caseSensitive = false, 
      wholeWord = false, 
      useRegex = false,
      includePattern = '',
      excludePattern = '*.log, *.tmp, node_modules/*, .git/*'
    } = req.body;

    logger.info('Workspace search requested', { 
      projectId, 
      query, 
      userId: req.user.id 
    });

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
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

    // Get all files in project (only type='file', not folders)
    const files = await File.find({
      project: projectId,
      type: 'file'
    }).select('_id name path content extension');

    const results = [];
    const excludePatterns = excludePattern
      .split(',')
      .map(p => p.trim())
      .filter(p => p);

    const includePatterns = includePattern
      .split(',')
      .map(p => p.trim())
      .filter(p => p);

    // Build search pattern
    let searchPattern;
    try {
      if (useRegex) {
        searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patternStr = wholeWord ? `\\b${escaped}\\b` : escaped;
        searchPattern = new RegExp(patternStr, caseSensitive ? 'g' : 'gi');
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid search pattern',
        error: error.message
      });
    }

    // Search through files
    for (const file of files) {
      // Skip files without content
      if (!file.content) continue;

      // Apply exclude patterns
      const shouldExclude = excludePatterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        return regex.test(file.path || file.name);
      });

      if (shouldExclude) continue;

      // Apply include patterns if specified
      if (includePatterns.length > 0) {
        const shouldInclude = includePatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          return regex.test(file.path || file.name);
        });

        if (!shouldInclude) continue;
      }

      // Search for matches in file content
      const lines = file.content.split('\n');
      const matches = [];

      lines.forEach((line, lineIndex) => {
        // Reset regex lastIndex for each line
        searchPattern.lastIndex = 0;
        const lineMatches = [...line.matchAll(searchPattern)];
        
        if (lineMatches.length > 0) {
          matches.push({
            lineNumber: lineIndex + 1,
            lineText: line,
            matchCount: lineMatches.length,
            contextBefore: lineIndex > 0 ? lines[lineIndex - 1] : null,
            contextAfter: lineIndex < lines.length - 1 ? lines[lineIndex + 1] : null
          });
        }
      });

      if (matches.length > 0) {
        results.push({
          fileId: file._id,
          fileName: file.name,
          filePath: file.path,
          matches: matches,
          totalMatches: matches.reduce((sum, m) => sum + m.matchCount, 0)
        });
      }
    }

    const totalMatches = results.reduce((sum, r) => sum + r.totalMatches, 0);

    logger.info('Search completed', {
      projectId,
      query,
      filesSearched: files.length,
      filesWithMatches: results.length,
      totalMatches
    });

    res.json({
      success: true,
      message: 'Search completed',
      results,
      stats: {
        filesSearched: files.length,
        filesWithMatches: results.length,
        totalMatches
      }
    });
  } catch (error) {
    logger.error('Workspace search failed', {
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/search/replace
 * @desc    Replace text across files in a project
 * @access  Private
 */
router.post('/replace', authenticateToken, async (req, res) => {
  try {
    const { 
      projectId, 
      searchQuery, 
      replaceText,
      fileIds = [], // Specific files to replace in, or all if empty
      caseSensitive = false, 
      wholeWord = false, 
      useRegex = false
    } = req.body;

    logger.info('Replace requested', { 
      projectId, 
      searchQuery,
      fileCount: fileIds.length,
      userId: req.user.id 
    });

    if (!searchQuery || !searchQuery.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    if (replaceText === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Replace text is required (can be empty string)'
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
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

    // Build search pattern
    let searchPattern;
    try {
      if (useRegex) {
        searchPattern = new RegExp(searchQuery, caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patternStr = wholeWord ? `\\b${escaped}\\b` : escaped;
        searchPattern = new RegExp(patternStr, caseSensitive ? 'g' : 'gi');
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid search pattern',
        error: error.message
      });
    }

    // Get files to replace in
    const query = {
      project: projectId,
      type: 'file'
    };

    if (fileIds.length > 0) {
      query._id = { $in: fileIds };
    }

    const files = await File.find(query);

    const replacedFiles = [];
    let totalReplacements = 0;

    for (const file of files) {
      if (!file.content) continue;

      const originalContent = file.content;
      const newContent = originalContent.replace(searchPattern, replaceText);

      if (newContent !== originalContent) {
        file.content = newContent;
        await file.save();

        // Count replacements
        const matches = originalContent.match(searchPattern);
        const replacementCount = matches ? matches.length : 0;
        totalReplacements += replacementCount;

        replacedFiles.push({
          fileId: file._id,
          fileName: file.name,
          filePath: file.path,
          replacements: replacementCount
        });
      }
    }

    logger.info('Replace completed', {
      projectId,
      filesModified: replacedFiles.length,
      totalReplacements
    });

    res.json({
      success: true,
      message: 'Replace completed',
      replacedFiles,
      stats: {
        filesProcessed: files.length,
        filesModified: replacedFiles.length,
        totalReplacements
      }
    });
  } catch (error) {
    logger.error('Replace failed', {
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Replace failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;
