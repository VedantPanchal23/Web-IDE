import express from 'express';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import aiService from '../services/ai.service.js';

const router = express.Router();

/**
 * @route   GET /api/v1/ai/status
 * @desc    Check AI service availability
 * @access  Public (no auth required)
 */
router.get('/status', async (req, res) => {
  try {
    const available = aiService.isAvailable();
    
    res.json({
      success: true,
      available,
      provider: aiService.defaultProvider,
      isFree: true,
      message: available 
        ? `AI service available using ${aiService.defaultProvider}` 
        : 'AI service not configured. See docs/AI_SETUP_GUIDE.md'
    });
  } catch (error) {
    logger.error('AI status check failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to check AI status'
    });
  }
});

// Apply authentication to all other AI routes (below this line)
router.use(authenticateToken);

/**
 * @route   POST /api/v1/ai/complete
 * @desc    Get code completion suggestion
 * @access  Private
 */
router.post('/complete', async (req, res) => {
  try {
    const { code, cursorPosition, language, filePath, maxTokens } = req.body;

    if (!code || cursorPosition === undefined || !language) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, cursorPosition, language'
      });
    }

    if (!aiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'AI service not configured. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY'
      });
    }

    logger.info('AI completion requested', {
      userId: req.user.id,
      language,
      filePath,
      cursorPosition
    });

    const result = await aiService.getCodeCompletion({
      code,
      cursorPosition,
      language,
      filePath,
      maxTokens
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('AI completion failed', {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'AI completion failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/ai/explain
 * @desc    Explain selected code
 * @access  Private
 */
router.post('/explain', async (req, res) => {
  try {
    const { code, language, context } = req.body;

    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, language'
      });
    }

    if (!aiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'AI service not configured'
      });
    }

    logger.info('Code explanation requested', {
      userId: req.user.id,
      language,
      codeLength: code.length
    });

    const result = await aiService.explainCode({
      code,
      language,
      context
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Code explanation failed', {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Code explanation failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/ai/generate
 * @desc    Generate code from comment/description
 * @access  Private
 */
router.post('/generate', async (req, res) => {
  try {
    const { comment, language, context, filePath } = req.body;

    if (!comment || !language) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: comment, language'
      });
    }

    if (!aiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'AI service not configured'
      });
    }

    logger.info('Code generation requested', {
      userId: req.user.id,
      language,
      filePath
    });

    const result = await aiService.generateCodeFromComment({
      comment,
      language,
      context,
      filePath
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Code generation failed', {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Code generation failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/ai/refactor
 * @desc    Get refactoring suggestions
 * @access  Private
 */
router.post('/refactor', async (req, res) => {
  try {
    const { code, language, context } = req.body;

    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, language'
      });
    }

    if (!aiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'AI service not configured'
      });
    }

    logger.info('Refactoring suggestions requested', {
      userId: req.user.id,
      language,
      codeLength: code.length
    });

    const result = await aiService.getRefactoringSuggestions({
      code,
      language,
      context
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Refactoring suggestions failed', {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'Refactoring suggestions failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/ai/chat
 * @desc    Chat with AI about code
 * @access  Private
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory, codeContext } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    if (!aiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'AI service not configured'
      });
    }

    logger.info('AI chat requested', {
      userId: req.user.id,
      messageLength: message.length,
      hasContext: !!codeContext
    });

    const result = await aiService.chat({
      message,
      conversationHistory: conversationHistory || [],
      codeContext
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('AI chat failed', {
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: 'AI chat failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;
