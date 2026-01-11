import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

class JWTService {
  constructor() {
    this.secret = null;
    this.expiresIn = null;
    this.refreshExpiresIn = null;
  }

  // Initialize the service lazily when first needed
  _initialize() {
    if (this.secret) return; // Already initialized

    this.secret = process.env.JWT_SECRET;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    if (!this.secret) {
      throw new Error(
        'Missing JWT_SECRET environment variable. Please set a secure JWT secret.'
      );
    }
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload) {
    this._initialize();
    try {
      const token = jwt.sign(payload, this.secret, {
        expiresIn: this.expiresIn,
        issuer: 'ai-ide',
        audience: 'ai-ide-users'
      });

      logger.info('Generated access token', { userId: payload.userId });
      return token;
    } catch (error) {
      logger.error('Error generating access token:', error);
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload) {
    this._initialize();
    try {
      const token = jwt.sign(payload, this.secret, {
        expiresIn: this.refreshExpiresIn,
        issuer: 'ai-ide',
        audience: 'ai-ide-refresh'
      });

      logger.info('Generated refresh token', { userId: payload.userId });
      return token;
    } catch (error) {
      logger.error('Error generating refresh token:', error);
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Verify and decode token
   */
  verifyToken(token, isRefreshToken = false) {
    this._initialize();
    try {
      const audience = isRefreshToken ? 'ai-ide-refresh' : 'ai-ide-users';

      const decoded = jwt.verify(token, this.secret, {
        issuer: 'ai-ide',
        audience: audience
      });

      logger.debug('Token verified successfully', { userId: decoded.userId });
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logger.warn('Token expired', { error: error.message });
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        logger.warn('Invalid token', { error: error.message });
        throw new Error('Invalid token');
      } else {
        logger.error('Token verification error:', error);
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(payload) {
    this._initialize();
    try {
      const accessToken = this.generateAccessToken(payload);
      const refreshToken = this.generateRefreshToken(payload);

      return {
        accessToken,
        refreshToken,
        expiresIn: this.expiresIn
      };
    } catch (error) {
      logger.error('Error generating token pair:', error);
      throw new Error('Failed to generate token pair');
    }
  }

  /**
   * Decode token without verification (for expired tokens)
   */
  decodeToken(token) {
    this._initialize();
    try {
      return jwt.decode(token);
    } catch (error) {
      logger.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    this._initialize();
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return true;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token) {
    this._initialize();
    try {
      const decoded = this.decodeToken(token);
      return decoded?.exp ? new Date(decoded.exp * 1000) : null;
    } catch (error) {
      return null;
    }
  }
}

export const jwtService = new JWTService();