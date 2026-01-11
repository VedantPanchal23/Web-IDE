import { jwtService } from '../services/jwt.service.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

/**
 * Authentication middleware to verify JWT tokens
 * Adds user information to req.user if valid token is provided
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookies
    let token = null;

    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Fallback to cookie if no Bearer token
    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required. Please log in.',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Verify the token
    const decoded = jwtService.verifyToken(token);
    
    logger.debug('JWT token decoded', { decoded });
    
    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.',
        code: 'TOKEN_INVALID'
      });
    }

    // Get user from database
    const user = await User.findById(decoded.userId).select('-refreshToken');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please log in again.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Add user information to request object
    req.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      profilePicture: user.profilePicture,
      accessToken: user.accessToken,
      driveRefreshToken: user.driveRefreshToken,
      role: user.role,
      isActive: user.isActive
    };

    // Update user's last activity
    user.lastActivityAt = new Date();
    await user.save();

    logger.info('User authenticated successfully', {
      userId: user._id,
      email: user.email,
      endpoint: `${req.method} ${req.originalUrl}`
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error.message,
      endpoint: `${req.method} ${req.originalUrl}`,
      userAgent: req.headers['user-agent']
    });

    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format. Please log in again.',
        code: 'TOKEN_MALFORMED'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.',
      code: 'AUTH_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user information if token is provided, but doesn't require it
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookies
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      // No token provided, continue without authentication
      req.user = null;
      return next();
    }

    // Try to verify the token
    const decoded = jwtService.verifyToken(token);
    
    if (decoded && decoded.userId) {
      const user = await User.findById(decoded.userId).select('-refreshToken');
      
      if (user && user.isActive) {
        req.user = {
          id: user._id,
          email: user.email,
          name: user.name,
          profilePicture: user.profilePicture,
          accessToken: user.accessToken,
          driveRefreshToken: user.driveRefreshToken,
          role: user.role,
          isActive: user.isActive
        };

        // Update last activity
        user.lastActivityAt = new Date();
        await user.save();
      }
    }

    next();
  } catch (error) {
    // In optional auth, we don't fail on token errors
    logger.warn('Optional authentication failed', {
      error: error.message,
      endpoint: `${req.method} ${req.originalUrl}`
    });
    
    req.user = null;
    next();
  }
};

/**
 * Admin role middleware
 * Requires authentication and admin role
 */
export const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
};

/**
 * Rate limiting middleware for authenticated users
 * Provides higher limits for authenticated users
 */
export const authRateLimitMiddleware = (req, res, next) => {
  // This can be used with express-rate-limit to provide different limits
  // based on authentication status
  if (req.user) {
    req.rateLimit = {
      max: 1000, // Higher limit for authenticated users
      windowMs: 15 * 60 * 1000 // 15 minutes
    };
  } else {
    req.rateLimit = {
      max: 100, // Lower limit for anonymous users
      windowMs: 15 * 60 * 1000 // 15 minutes
    };
  }
  
  next();
};