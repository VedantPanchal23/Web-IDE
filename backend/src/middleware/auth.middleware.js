import { jwtService } from '../services/jwt.service.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { driveFileService } from '../services/driveFile.service.js';

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify the token
    const decoded = jwtService.verifyToken(token);
    
    // Get user from database (include drive tokens for re-initialization)
    const user = await User.findById(decoded.userId)
      .select('+driveAccessToken +driveRefreshToken');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found'
      });
    }

    // Re-initialize Drive service if user has tokens and service not initialized
    if (user.driveAccessToken && !driveFileService.isInitialized()) {
      logger.info('🔧 Re-initializing Drive service for authenticated request', {
        userId: user._id,
        hasRefreshToken: !!user.driveRefreshToken
      });
      try {
        driveFileService.initialize(
          user.driveAccessToken,
          user.driveRefreshToken,
          user.driveTokenExpiresAt?.getTime()
        );
      } catch (initError) {
        logger.warn('⚠️ Drive initialization failed, will retry on next request', {
          error: initError.message,
          userId: user._id
        });
      }
    }

    // Update user activity
    user.lastActiveAt = new Date();
    await user.save();

    // Attach user to request
    req.user = user;
    req.token = token;

    logger.debug('User authenticated successfully', {
      userId: user._id,
      email: user.email
    });

    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (error.message === 'Token expired') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.message === 'Invalid token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Middleware for optional authentication (user may or may not be logged in)
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwtService.verifyToken(token);
    const user = await User.findById(decoded.userId).select('-driveTokens');

    if (user && user.isActive) {
      user.lastActiveAt = new Date();
      await user.save();
      req.user = user;
      req.token = token;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    logger.debug('Optional auth failed, continuing without user:', error.message);
    req.user = null;
    next();
  }
};

/**
 * Middleware to check if user has valid Google Drive tokens
 */
export const requireDriveAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get user with drive tokens
    const user = await User.findById(req.user._id).select('+driveAccessToken');

    if (!user.driveAccessToken) {
      return res.status(403).json({
        success: false,
        message: 'Google Drive access required',
        code: 'DRIVE_ACCESS_REQUIRED'
      });
    }

    // Check if token is expired
    if (user.isTokenExpired()) {
      return res.status(403).json({
        success: false,
        message: 'Google Drive token expired',
        code: 'DRIVE_TOKEN_EXPIRED'
      });
    }

    req.userWithTokens = user;
    next();
  } catch (error) {
    logger.error('Drive access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify Drive access'
    });
  }
};

/**
 * Middleware to extract user ID from token for rate limiting
 */
export const extractUserId = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwtService.decodeToken(token);
      if (decoded && decoded.userId) {
        req.userId = decoded.userId;
      }
    }

    next();
  } catch (error) {
    // Continue without user ID for rate limiting
    next();
  }
};

/**
 * Middleware to refresh expired tokens automatically
 */
export const refreshTokenMiddleware = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const decoded = jwtService.verifyToken(refreshToken, true);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new token pair
    const tokenPayload = {
      userId: user._id,
      email: user.email,
      googleId: user.googleId
    };

    const tokens = jwtService.generateTokenPair(tokenPayload);

    // Set new refresh token cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: tokens.accessToken,
        user: user.toJSON(),
        expiresIn: tokens.expiresIn
      }
    });
  } catch (error) {
    logger.error('Token refresh error:', error);

    if (error.message === 'Token expired') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to refresh token'
    });
  }
};