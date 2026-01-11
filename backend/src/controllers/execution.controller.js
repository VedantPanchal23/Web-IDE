import express from 'express';
import { logger } from '../utils/logger.js';
import dockerService from '../services/docker.service.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Store active executions
const activeExecutions = new Map();

/**
 * @route   POST /api/v1/execution/test
 * @desc    Test code execution without authentication (for development)
 * @access  Public
 */
router.post('/test', async (req, res) => {
  try {
    const { code, language, projectId, files = [], timeout = 30000 } = req.body;
    const userId = 'test-user-' + Date.now(); // Mock user ID for testing

    // Validation
    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: 'Code and language are required'
      });
    }

    const executionId = uuidv4();
    logger.info('TEST: Starting code execution', { 
      executionId, 
      language, 
      codeLength: code.length,
      userId 
    });

    // Store execution info
    activeExecutions.set(executionId, {
      id: executionId,
      userId,
      language,
      startTime: Date.now(),
      status: 'running'
    });

    // Create container for code execution
    const container = await dockerService.createContainer(userId, language, {
      isTerminal: false, // This is for code execution, not terminal
      projectId,
      files
    });

    // Create execution object
    const execution = {
      id: executionId,
      userId,
      projectId,
      language,
      code,
      files,
      status: 'pending',
      createdAt: Date.now(),
      timeout
    };

    // Execute the code asynchronously and wait for completion
    await executeCodeAsync(execution, timeout);
    
    // Wait for execution to complete
    let attempts = 0;
    const maxAttempts = timeout / 100; // Check every 100ms
    
    while (execution.status === 'running' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    // Clean up
    activeExecutions.delete(executionId);
    
    logger.info('TEST: Code execution completed', { 
      executionId, 
      status: execution.status,
      duration: execution.completedAt ? execution.completedAt - execution.createdAt : 0
    });

    return res.json({
      success: execution.status === 'completed',
      status: execution.status,
      output: execution.output || '',
      error: execution.error || null,
      exitCode: execution.exitCode || null,
      executionId
    });

  } catch (error) {
    logger.error('TEST: Code execution error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/v1/execution/run
 * @desc    Execute code in secure container
 * @access  Private
 */
router.post('/run', authMiddleware, async (req, res) => {
  try {
    const { code, language, projectId, files = [], timeout = 30000 } = req.body;
    const userId = req.user.id;

    // Validation
    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: 'Code and language are required'
      });
    }

    const executionId = uuidv4();
    
    logger.info('Code execution requested', {
      executionId,
      userId,
      language,
      projectId,
      codeLength: code.length,
      fileCount: files.length
    });

    // Create execution record
    const execution = {
      id: executionId,
      userId,
      projectId,
      language,
      code,
      files,
      status: 'queued',
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      output: '',
      error: null,
      container: null
    };

    activeExecutions.set(executionId, execution);

    // Start async execution
    executeCodeAsync(execution, timeout).catch(error => {
      logger.error('Async execution error', { executionId, error: error.message });
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = new Date();
    });

    res.json({
      success: true,
      executionId,
      status: 'queued',
      language,
      projectId
    });

  } catch (error) {
    logger.error('Code execution request failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Execute code asynchronously
 */
async function executeCodeAsync(execution, timeout) {
  try {
    execution.status = 'running';
    execution.startedAt = new Date();

    // Create container
    const container = await dockerService.createContainer(
      execution.userId, 
      execution.language
    );
    
    execution.container = container;

    // Wait for container to fully start before executing code
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Upload files if provided
    if (execution.files && execution.files.length > 0) {
      await dockerService.uploadFiles(container.id, execution.files);
    }

    // Execute code
    const { exec, stream } = await dockerService.executeCommand(
      container.id,
      execution.code
    );

    let output = '';
    let error = '';

    // Set up timeout
    const timeoutHandle = setTimeout(async () => {
      try {
        await dockerService.cleanupContainer(container.id);
        execution.status = 'timeout';
        execution.error = 'Execution timed out';
        execution.completedAt = new Date();
      } catch (timeoutError) {
        logger.error('Timeout cleanup error', { 
          executionId: execution.id, 
          error: timeoutError.message 
        });
      }
    }, timeout);

    // Handle output
    stream.on('data', (chunk) => {
      // Docker exec with Tty=false multiplexes stdout/stderr
      // Format: [STREAM_TYPE][0x00,0x00,0x00][SIZE][DATA...]
      if (chunk.length > 8 && chunk[0] <= 2) {
        const streamType = chunk[0];
        const size = chunk.readUInt32BE(4);
        const data = chunk.slice(8, 8 + size).toString();
        
        if (streamType === 1) { // stdout
          output += data;
        } else if (streamType === 2) { // stderr
          error += data;
        }
      } else {
        // Raw stream data (when Tty=true)
        const data = chunk.toString();
        output += data;
      }
      
      execution.output = output;
      execution.error = error || null;
    });

    stream.on('end', async () => {
      clearTimeout(timeoutHandle);
      
      try {
        // Get execution details
        const execInfo = await exec.inspect();
        
        execution.status = execInfo.ExitCode === 0 ? 'completed' : 'failed';
        execution.completedAt = new Date();
        
        if (execInfo.ExitCode !== 0 && !error) {
          execution.error = `Process exited with code ${execInfo.ExitCode}`;
        }

        // Cleanup container
        await dockerService.cleanupContainer(container.id);

        logger.info('Code execution completed', {
          executionId: execution.id,
          status: execution.status,
          exitCode: execInfo.ExitCode,
          duration: execution.completedAt - execution.startedAt
        });

      } catch (cleanupError) {
        logger.error('Execution cleanup error', { 
          executionId: execution.id, 
          error: cleanupError.message 
        });
      }
    });

    stream.on('error', (streamError) => {
      clearTimeout(timeoutHandle);
      execution.status = 'failed';
      execution.error = streamError.message;
      execution.completedAt = new Date();
      
      logger.error('Execution stream error', { 
        executionId: execution.id, 
        error: streamError.message 
      });
    });

  } catch (error) {
    execution.status = 'failed';
    execution.error = error.message;
    execution.completedAt = new Date();
    
    // Cleanup on error
    if (execution.container) {
      try {
        await dockerService.cleanupContainer(execution.container.id);
      } catch (cleanupError) {
        logger.error('Error cleanup failed', { 
          executionId: execution.id, 
          error: cleanupError.message 
        });
      }
    }
    
    throw error;
  }
}

/**
 * @route   GET /api/v1/execution/:executionId/status
 * @desc    Get execution status
 * @access  Private
 */
router.get('/:executionId/status', authMiddleware, (req, res) => {
  try {
    const { executionId } = req.params;
    const userId = req.user.id;

    const execution = activeExecutions.get(executionId);
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }

    // Check ownership
    if (execution.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const response = {
      success: true,
      executionId,
      status: execution.status,
      output: execution.output,
      error: execution.error,
      createdAt: execution.createdAt,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      language: execution.language
    };

    if (execution.startedAt && execution.completedAt) {
      response.duration = execution.completedAt - execution.startedAt;
    }

    res.json(response);

  } catch (error) {
    logger.error('Execution status request failed', { 
      executionId: req.params.executionId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/v1/execution/:executionId/terminate
 * @desc    Terminate running execution
 * @access  Private
 */
router.post('/:executionId/terminate', authMiddleware, async (req, res) => {
  try {
    const { executionId } = req.params;
    const userId = req.user.id;

    const execution = activeExecutions.get(executionId);
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }

    // Check ownership
    if (execution.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only terminate if running
    if (execution.status !== 'running' && execution.status !== 'queued') {
      return res.status(400).json({
        success: false,
        message: `Cannot terminate execution with status: ${execution.status}`
      });
    }

    // Cleanup container
    if (execution.container) {
      await dockerService.cleanupContainer(execution.container.id);
    }

    // Update status
    execution.status = 'terminated';
    execution.completedAt = new Date();
    execution.error = 'Execution was terminated by user';

    logger.info('Execution terminated', { executionId, userId });

    res.json({
      success: true,
      executionId,
      status: 'terminated'
    });

  } catch (error) {
    logger.error('Execution termination failed', { 
      executionId: req.params.executionId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/execution/list
 * @desc    List user's executions
 * @access  Private
 */
router.get('/list', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const userExecutions = Array.from(activeExecutions.values())
      .filter(execution => execution.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(offset, offset + limit)
      .map(execution => ({
        id: execution.id,
        projectId: execution.projectId,
        language: execution.language,
        status: execution.status,
        createdAt: execution.createdAt,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        duration: execution.startedAt && execution.completedAt 
          ? execution.completedAt - execution.startedAt 
          : null
      }));

    res.json({
      success: true,
      executions: userExecutions,
      total: userExecutions.length
    });

  } catch (error) {
    logger.error('Execution list request failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/execution/containers/status
 * @desc    Get container status and health
 * @access  Private
 */
router.get('/containers/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get Docker health
    const dockerHealth = await dockerService.healthCheck();
    
    // Get user's containers
    const userContainers = dockerService.listContainers(userId);
    
    // Get active executions for user
    const userExecutions = Array.from(activeExecutions.values())
      .filter(execution => execution.userId === userId);

    // Get resource monitoring for active containers
    const containerResources = await Promise.allSettled(
      userContainers.map(async container => {
        try {
          const resources = await dockerService.monitorContainerResources(container.id);
          return {
            containerId: container.id,
            ...resources
          };
        } catch (error) {
          return {
            containerId: container.id,
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      docker: dockerHealth,
      containers: {
        active: userContainers.length,
        details: userContainers,
        resources: containerResources.map(result => result.value || result.reason)
      },
      executions: {
        active: userExecutions.filter(e => e.status === 'running').length,
        queued: userExecutions.filter(e => e.status === 'queued').length,
        total: userExecutions.length
      }
    });

  } catch (error) {
    logger.error('Container status request failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message,
      docker: { status: 'unhealthy', error: error.message }
    });
  }
});

/**
 * @route   GET /api/v1/execution/:executionId/resources
 * @desc    Get real-time resource usage for execution
 * @access  Private
 */
router.get('/:executionId/resources', authMiddleware, async (req, res) => {
  try {
    const { executionId } = req.params;
    const userId = req.user.id;

    const execution = activeExecutions.get(executionId);
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }

    // Check ownership
    if (execution.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!execution.container || execution.status !== 'running') {
      return res.status(400).json({
        success: false,
        message: 'No active container for this execution'
      });
    }

    const resources = await dockerService.monitorContainerResources(execution.container.id);
    const securityAudit = await dockerService.auditContainerSecurity(execution.container.id);

    res.json({
      success: true,
      executionId,
      resources,
      security: securityAudit
    });

  } catch (error) {
    logger.error('Resource monitoring request failed', { 
      executionId: req.params.executionId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/v1/execution/maintenance/cleanup
 * @desc    Trigger manual maintenance cleanup
 * @access  Private
 */
router.post('/maintenance/cleanup', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Only allow maintenance for admin users or in development
    if (process.env.NODE_ENV !== 'development' && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Maintenance operations require admin privileges'
      });
    }

    const cleanupResult = await dockerService.performMaintenanceCleanup();

    logger.info('Manual maintenance cleanup triggered', { userId, cleanupResult });

    res.json({
      success: true,
      message: 'Maintenance cleanup completed',
      result: cleanupResult
    });

  } catch (error) {
    logger.error('Maintenance cleanup request failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Clean up old executions periodically
 */
setInterval(() => {
  const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
  
  for (const [executionId, execution] of activeExecutions.entries()) {
    if (execution.createdAt.getTime() < cutoff && 
        ['completed', 'failed', 'timeout', 'terminated'].includes(execution.status)) {
      activeExecutions.delete(executionId);
    }
  }
}, 60 * 60 * 1000); // Run every hour

export default router;
