import express from 'express';
import { logger } from '../utils/logger.js';
import lspService from '../services/lsp.service.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper function to get installation instructions for language servers
function getInstallationHelp(language) {
  const helpMap = {
    python: {
      command: 'pip install python-lsp-server',
      description: 'Install Python Language Server Protocol implementation'
    },
    javascript: {
      command: 'npm install -g typescript-language-server typescript',
      description: 'Install TypeScript Language Server for JavaScript/TypeScript support'
    },
    typescript: {
      command: 'npm install -g typescript-language-server typescript',
      description: 'Install TypeScript Language Server'
    }
  };
  return helpMap[language] || { command: 'N/A', description: 'Language server not available' };
}

/**
 * @route   POST /api/v1/lsp/:language/initialize
 * @desc    Initialize Language Server Protocol session
 * @access  Private
 */
router.post('/:language/initialize', authMiddleware, async (req, res) => {
  try {
    const { language } = req.params;
    const { projectId, workspaceRoot } = req.body;
    const userId = req.user.id;

    if (!projectId || !workspaceRoot) {
      return res.status(400).json({
        success: false,
        message: 'projectId and workspaceRoot are required'
      });
    }

    logger.info('LSP initialization requested', { userId, language, projectId, workspaceRoot });

    const server = await lspService.startLanguageServer(userId, projectId, language, workspaceRoot);
    
    if (!server) {
      return res.json({
        success: false,
        message: `Language server for ${language} is not available. Please install the required language server.`,
        language,
        projectId,
        installationHelp: getInstallationHelp(language)
      });
    }

    res.json({
      success: true,
      message: 'Language server initialized successfully',
      serverId: server.id,
      language,
      projectId,
      capabilities: server.capabilities,
      status: server.status
    });

  } catch (error) {
    logger.error('LSP initialization failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/v1/lsp/:serverId/completion
 * @desc    Get code completion suggestions
 * @access  Private
 */
router.post('/:serverId/completion', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { textDocument, position, context } = req.body;

    if (!textDocument || !position) {
      return res.status(400).json({
        success: false,
        message: 'textDocument and position are required'
      });
    }

    logger.info('LSP completion requested', {
      serverId,
      uri: textDocument.uri,
      position
    });

    const request = {
      jsonrpc: '2.0',
      method: 'textDocument/completion',
      params: {
        textDocument: textDocument,
        position: position,
        context: context || {}
      }
    };

    const response = await lspService.handleLSPRequest(serverId, request);

    res.json({
      success: true,
      completions: response.result || [],
      serverId
    });

  } catch (error) {
    logger.error('LSP completion failed', { serverId: req.params.serverId, error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/v1/lsp/:serverId/hover
 * @desc    Get hover information
 * @access  Private
 */
router.post('/:serverId/hover', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { textDocument, position } = req.body;

    if (!textDocument || !position) {
      return res.status(400).json({
        success: false,
        message: 'textDocument and position are required'
      });
    }

    const request = {
      jsonrpc: '2.0',
      method: 'textDocument/hover',
      params: {
        textDocument: textDocument,
        position: position
      }
    };

    const response = await lspService.handleLSPRequest(serverId, request);

    res.json({
      success: true,
      hover: response.result,
      serverId
    });

  } catch (error) {
    logger.error('LSP hover failed', { serverId: req.params.serverId, error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/v1/lsp/:serverId/definition
 * @desc    Go to definition
 * @access  Private
 */
router.post('/:serverId/definition', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { textDocument, position } = req.body;

    if (!textDocument || !position) {
      return res.status(400).json({
        success: false,
        message: 'textDocument and position are required'
      });
    }

    const request = {
      jsonrpc: '2.0',
      method: 'textDocument/definition',
      params: {
        textDocument: textDocument,
        position: position
      }
    };

    const response = await lspService.handleLSPRequest(serverId, request);

    res.json({
      success: true,
      locations: response.result || [],
      serverId
    });

  } catch (error) {
    logger.error('LSP definition failed', { serverId: req.params.serverId, error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/lsp/servers
 * @desc    List active language servers
 * @access  Private
 */
router.get('/servers', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const servers = lspService.listLanguageServers(userId);

    res.json({
      success: true,
      servers: servers
    });

  } catch (error) {
    logger.error('LSP server listing failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/v1/lsp/:serverId
 * @desc    Shutdown LSP server
 * @access  Private
 */
router.delete('/:serverId', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const server = lspService.languageServers.get(serverId);
    if (server && server.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await lspService.stopLanguageServer(serverId);

    res.json({
      success: true,
      message: 'Language server stopped',
      serverId
    });

  } catch (error) {
    logger.error('LSP shutdown failed', { serverId: req.params.serverId, error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;