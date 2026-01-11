import express from 'express';
import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import gitService from '../services/git.service.js';
import terminalService from '../services/terminal.service.js';

const router = express.Router();

/**
 * @route   GET /api/v1/git/:projectId/status
 * @desc    Get git status for project
 * @access  Private
 */
router.get('/:projectId/status', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;

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

    // Get container for this project
    const containerKey = `${req.user.id}:${projectId}`;
    const container = terminalService.projectContainers.get(containerKey);

    if (!container) {
      return res.status(404).json({
        success: false,
        message: 'Project container not found. Please open the project first.'
      });
    }

    // Get git status
    const result = await gitService.getStatus(container.id);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get git status',
        error: result.error
      });
    }

    res.json({
      success: true,
      status: result.status
    });
  } catch (error) {
    logger.error('Failed to get git status', {
      error: error.message,
      projectId: req.params.projectId
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get git status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/git/:projectId/stage
 * @desc    Stage files
 * @access  Private
 */
router.post('/:projectId/stage', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { files, all = false } = req.body;

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

    const containerKey = `${req.user.id}:${projectId}`;
    const container = terminalService.projectContainers.get(containerKey);

    if (!container) {
      return res.status(404).json({
        success: false,
        message: 'Project container not found'
      });
    }

    let result;
    if (all) {
      result = await gitService.stageAll(container.id);
    } else {
      result = await gitService.stageFiles(container.id, files);
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to stage files',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Files staged successfully'
    });
  } catch (error) {
    logger.error('Failed to stage files', {
      error: error.message,
      projectId: req.params.projectId
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to stage files',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/git/:projectId/unstage
 * @desc    Unstage files
 * @access  Private
 */
router.post('/:projectId/unstage', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { files, all = false } = req.body;

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

    const containerKey = `${req.user.id}:${projectId}`;
    const container = terminalService.projectContainers.get(containerKey);

    if (!container) {
      return res.status(404).json({
        success: false,
        message: 'Project container not found'
      });
    }

    let result;
    if (all) {
      result = await gitService.unstageAll(container.id);
    } else {
      result = await gitService.unstageFiles(container.id, files);
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to unstage files',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Files unstaged successfully'
    });
  } catch (error) {
    logger.error('Failed to unstage files', {
      error: error.message,
      projectId: req.params.projectId
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to unstage files',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/git/:projectId/commit
 * @desc    Commit changes
 * @access  Private
 */
router.post('/:projectId/commit', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Commit message is required'
      });
    }

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

    const containerKey = `${req.user.id}:${projectId}`;
    const container = terminalService.projectContainers.get(containerKey);

    if (!container) {
      return res.status(404).json({
        success: false,
        message: 'Project container not found'
      });
    }

    const result = await gitService.commit(container.id, message);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to commit',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Changes committed successfully',
      output: result.output
    });
  } catch (error) {
    logger.error('Failed to commit', {
      error: error.message,
      projectId: req.params.projectId
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to commit',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/git/:projectId/init
 * @desc    Initialize git repository
 * @access  Private
 */
router.post('/:projectId/init', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;

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

    const containerKey = `${req.user.id}:${projectId}`;
    const container = terminalService.projectContainers.get(containerKey);

    if (!container) {
      return res.status(404).json({
        success: false,
        message: 'Project container not found'
      });
    }

    const result = await gitService.initRepository(container.id);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize git repository',
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Git repository initialized successfully'
    });
  } catch (error) {
    logger.error('Failed to initialize git', {
      error: error.message,
      projectId: req.params.projectId
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to initialize git',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;
