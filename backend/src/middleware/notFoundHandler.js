import { logger } from '../utils/logger.js';

export const notFoundHandler = (req, res, _next) => {
  logger.warn('Route not found:', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /health',
      'POST /api/v1/auth/google',
      'GET /api/v1/auth/google/callback',
      'GET /api/v1/projects',
      'POST /api/v1/projects',
      'GET /api/v1/projects/:id/files',
      'PUT /api/v1/projects/:id/files/*path',
      'POST /api/v1/runner/:projectId/start',
      'GET /api/v1/sync/status/:projectId'
    ]
  });
};
