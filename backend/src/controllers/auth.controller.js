import express from 'express';
import { logger } from '../utils/logger.js';
import { googleDriveService } from '../services/googleDrive.service.js';
import { driveFileService } from '../services/driveFile.service.js';
import { jwtService } from '../services/jwt.service.js';
import { authenticateToken, refreshTokenMiddleware } from '../middleware/auth.middleware.js';
import { User } from '../models/User.js';

const router = express.Router();

/**
 * @route   GET /api/v1/auth/status
 * @desc    Check authentication service status
 * @access  Public
 */
router.get('/status', (req, res) => {
  try {
    const config = {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasGoogleRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
      hasCorsOrigin: !!process.env.CORS_ORIGIN,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      corsOrigin: process.env.CORS_ORIGIN
    };
    
    logger.info('Auth status check requested', config);
    
    res.json({
      success: true,
      message: 'Authentication service is running',
      config
    });
  } catch (error) {
    logger.error('Auth status check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication service error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/auth/google
 * @desc    Initiate Google OAuth flow
 * @access  Public
 */
router.get('/google', (req, res) => {
  try {
    logger.info('Google OAuth initiation requested', {
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      origin: req.get('Origin')
    });

    const state = `auth_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    logger.info('Generating OAuth URL', {
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      corsOrigin: process.env.CORS_ORIGIN,
      state
    });
    
    const authUrl = googleDriveService.getAuthUrl(state);

    // Store state in session or cache for verification (simplified for demo)
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000 // 10 minutes
    });

    res.redirect(authUrl);
  } catch (error) {
    logger.error('Google OAuth initiation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Google OAuth'
    });
  }
});

/**
 * @route   GET /api/v1/auth/google/reauth
 * @desc    Force re-authentication with Google Drive
 * @access  Private (requires existing auth)
 */
router.get('/google/reauth', authenticateToken, (req, res) => {
  try {
    logger.info('Google Drive re-authentication requested', { userId: req.user._id });

    const state = `reauth_${req.user._id}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    // Get authorization URL (already includes consent prompt and offline access)
    const authUrl = googleDriveService.getAuthUrl(state);

    // Store state in session or cache for verification
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000 // 10 minutes
    });

    res.redirect(authUrl);
  } catch (error) {
    logger.error('Google Drive re-authentication failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Google Drive re-authentication'
    });
  }
});

/**
 * @route   GET /api/v1/auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const storedState = req.cookies?.oauth_state;

    logger.info('Google OAuth callback received', { 
      code: code ? 'present' : 'missing', 
      state,
      error: error || 'none'
    });

    // Handle OAuth error
    if (error) {
      logger.error('OAuth error received:', { error, userId: 'unknown' });
      return res.redirect(`${process.env.CORS_ORIGIN}/?error=${encodeURIComponent(error)}`);
    }

    // Validate state parameter
    if (!state || !storedState || state !== storedState) {
      logger.error('Invalid state parameter', { state, storedState });
      return res.redirect(`${process.env.CORS_ORIGIN}/?error=invalid_state`);
    }

    // Validate authorization code
    if (!code) {
      logger.error('No authorization code received');
      return res.redirect(`${process.env.CORS_ORIGIN}/?error=no_code`);
    }

    // Exchange code for tokens
    const tokens = await googleDriveService.getTokens(code);
    logger.info('Received OAuth tokens', { 
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresAt: tokens.expiry_date 
    });
    
    // Get user profile
    const googleProfile = await googleDriveService.getUserProfile(tokens.access_token);

    // Find or create user
    let user = await User.findByGoogleId(googleProfile.id);
    
    if (user) {
      // Update existing user
      logger.info('Updating existing user with tokens', { 
        userId: user._id,
        currentHasToken: !!user.driveAccessToken,
        newTokenPresent: !!tokens.access_token
      });
      
      // Update Drive tokens
      user.driveAccessToken = tokens.access_token;
      user.driveRefreshToken = tokens.refresh_token;
      user.driveTokenType = tokens.token_type || 'Bearer';
      user.driveTokenExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
      
      user.lastLoginAt = new Date();
      user.loginCount += 1;
      await user.save();
      
      // Verify tokens were saved by reloading user
      const reloadedUser = await User.findById(user._id).select('+driveAccessToken +driveRefreshToken +driveTokenExpiresAt');
      logger.info('After saving user with tokens', {
        userId: user._id,
        hasAccessToken: !!reloadedUser.driveAccessToken,
        hasRefreshToken: !!reloadedUser.driveRefreshToken,
        tokenExpiresAt: reloadedUser.driveTokenExpiresAt,
        isExpired: reloadedUser.isTokenExpired()
      });
    } else {
      // Create new user
      user = await User.createFromGoogle(googleProfile, tokens);
      
      // Try to create AI-IDE projects folder in Drive (optional)
      try {
        const driveClient = googleDriveService.getDriveClient(tokens.access_token);
        const projectsFolder = await googleDriveService.createProjectsFolder(driveClient);
        user.driveProjectsFolderId = projectsFolder.id;
        await user.save();
        logger.info('Created Drive projects folder for new user', { userId: user._id });
      } catch (driveError) {
        // Log the error but don't fail authentication
        logger.warn('Could not create Drive projects folder - Drive API may not be enabled', {
          userId: user._id,
          error: driveError.message
        });
        // Save user without Drive folder ID
        await user.save();
      }
    }

    // Generate JWT tokens
    const tokenPayload = {
      userId: user._id,
      email: user.email,
      googleId: user.googleId
    };

    const jwtTokens = jwtService.generateTokenPair(tokenPayload);

    // Set refresh token cookie
    res.cookie('refreshToken', jwtTokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Clear OAuth state cookie
    res.clearCookie('oauth_state');

    // ==================== CRITICAL FIX: Initialize Drive Service ====================
    // Initialize the Drive file service with the user's tokens so it can perform operations
    logger.info('🔧 Initializing Drive service with user tokens', { userId: user._id });
    try {
      await driveFileService.initialize(
        tokens.access_token, 
        tokens.refresh_token,
        tokens.expiry_date
      );
      logger.info('✅ Drive service initialized successfully', { userId: user._id });
    } catch (initError) {
      // Log but don't fail - service will try to re-initialize on first operation
      logger.warn('⚠️ Failed to initialize Drive service during OAuth', { 
        userId: user._id,
        error: initError.message 
      });
    }
    // ================================================================================

    // Redirect to frontend with access token
    const redirectUrl = `${process.env.CORS_ORIGIN}/?token=${jwtTokens.accessToken}`;
    res.redirect(redirectUrl);

  } catch (error) {
    logger.error('OAuth callback error:', { 
      error: error.message, 
      stack: error.stack,
      userId: 'unknown'
    });
    res.redirect(`${process.env.CORS_ORIGIN}/?error=callback_failed`);
  }
});

/**
 * @route   GET /api/v1/auth/drive-status
 * @desc    Check current user's Google Drive authentication status
 * @access  Private
 */
router.get('/drive-status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+driveAccessToken +driveRefreshToken +driveTokenExpiresAt');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('Drive status check', {
      userId: req.user._id,
      hasAccessToken: !!user.driveAccessToken,
      hasRefreshToken: !!user.driveRefreshToken,
      tokenExpiresAt: user.driveTokenExpiresAt,
      isExpired: user.isTokenExpired(),
      accessTokenLength: user.driveAccessToken ? user.driveAccessToken.length : 0,
      refreshTokenLength: user.driveRefreshToken ? user.driveRefreshToken.length : 0
    });

    res.json({
      success: true,
      data: {
        isDriveConnected: !!user.driveAccessToken && !user.isTokenExpired(),
        hasAccessToken: !!user.driveAccessToken,
        hasRefreshToken: !!user.driveRefreshToken,
        tokenExpiresAt: user.driveTokenExpiresAt,
        isExpired: user.isTokenExpired(),
        requiresReauth: !user.driveAccessToken || user.isTokenExpired(),
        tokenLength: user.driveAccessToken ? user.driveAccessToken.length : 0
      }
    });
  } catch (error) {
    logger.error('Drive status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check Drive status'
    });
  }
});

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh authentication token
 * @access  Private
 */
router.post('/refresh', refreshTokenMiddleware);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and clear session
 * @access  Private
 */
router.post('/logout', authenticateToken, (req, res) => {
  try {
    logger.info('User logout requested', { userId: req.user._id });

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout'
    });
  }
});

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Get user with Drive tokens (req.user is already the user object from middleware)
    const userWithDriveTokens = await User.findById(req.user._id).select('+driveAccessToken +driveRefreshToken +driveTokenExpiresAt');
    
    if (!userWithDriveTokens) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check Drive authentication status
    const driveAuthStatus = {
      hasAccessToken: !!userWithDriveTokens.driveAccessToken,
      hasRefreshToken: !!userWithDriveTokens.driveRefreshToken,
      tokenExpiresAt: userWithDriveTokens.driveTokenExpiresAt,
      isTokenExpired: userWithDriveTokens.isTokenExpired(),
      requiresReauth: !userWithDriveTokens.driveAccessToken || userWithDriveTokens.isTokenExpired()
    };

    logger.info('User profile requested with Drive status', {
      reqUserId: req.user._id,
      reqUserIdType: typeof req.user._id,
      reqUserIdString: String(req.user._id),
      foundUserId: userWithDriveTokens._id,
      email: userWithDriveTokens.email,
      driveAuthStatus
    });

    res.json({
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        user: {
          id: userWithDriveTokens._id,
          email: userWithDriveTokens.email,
          name: userWithDriveTokens.name,
          picture: userWithDriveTokens.picture,
          preferences: userWithDriveTokens.preferences,
          lastLoginAt: userWithDriveTokens.lastLoginAt,
          createdAt: userWithDriveTokens.createdAt,
          driveAuthStatus
          // Note: refreshToken is intentionally excluded for security
        }
      }
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

/**
 * @route   PUT /api/v1/auth/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { theme, fontSize, language, defaultLanguage } = req.body;
    const user = req.user;

    // Update preferences
    if (theme) user.preferences.theme = theme;
    if (fontSize) user.preferences.fontSize = fontSize;
    if (language) user.preferences.language = language;
    if (defaultLanguage) user.preferences.defaultLanguage = defaultLanguage;

    await user.save();

    logger.info('User preferences updated', { userId: user._id });

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        preferences: user.preferences
      }
    });
  } catch (error) {
    logger.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
});



export default router;
