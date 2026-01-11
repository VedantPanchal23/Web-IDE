import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { logger } from '../utils/logger.js';

class GoogleDriveService {
  constructor() {
    this.oauth2Client = null;
    this.drive = null;
  }

  // Initialize the service lazily when first needed
  _initialize() {
    if (this.oauth2Client) return; // Already initialized

    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error(
        'Missing required Google OAuth configuration. Please check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.'
      );
    }

    this.oauth2Client = new OAuth2Client(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    // Scopes for Google Drive API with minimal permissions
    this.scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/drive.file' // Only files created by the app
    ];
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  getAuthUrl(state = null) {
    this._initialize();
    try {
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: this.scopes,
        prompt: 'consent',
        state: state || `auth_${Date.now()}`
      });

      logger.info('Generated Google OAuth authorization URL');
      return authUrl;
    } catch (error) {
      logger.error('Error generating auth URL:', error);
      throw new Error('Failed to generate authorization URL');
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code) {
    this._initialize();
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      logger.info('Successfully exchanged authorization code for tokens');
      return tokens;
    } catch (error) {
      logger.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(accessToken) {
    this._initialize();
    try {
      const oauth2Client = new OAuth2Client();
      oauth2Client.setCredentials({ access_token: accessToken });

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data } = await oauth2.userinfo.get();

      logger.info('Retrieved user profile information', {
        userId: data.id,
        email: data.email
      });

      return {
        id: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture,
        verified_email: data.verified_email
      };
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  /**
   * Initialize Google Drive API client
   */
  getDriveClient(accessToken) {
    this._initialize();
    try {
      const oauth2Client = new OAuth2Client();
      oauth2Client.setCredentials({ access_token: accessToken });

      return google.drive({ version: 'v3', auth: oauth2Client });
    } catch (error) {
      logger.error('Error initializing Drive client:', error);
      throw new Error('Failed to initialize Drive client');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    this._initialize();
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      logger.info('Successfully refreshed access token');
      return credentials;
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Create AI-IDE projects folder in user's Drive
   */
  async createProjectsFolder(driveClient) {
    try {
      const folderMetadata = {
        name: 'AI-IDE Projects',
        mimeType: 'application/vnd.google-apps.folder',
        description: 'AI-IDE project files and folders'
      };

      const folder = await driveClient.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      logger.info('Created AI-IDE projects folder', {
        folderId: folder.data.id
      });

      return folder.data;
    } catch (error) {
      logger.error('Error creating projects folder:', error);
      throw new Error('Failed to create projects folder');
    }
  }

  /**
   * Verify token validity
   */
  async verifyToken(accessToken) {
    this._initialize();
    try {
      const oauth2Client = new OAuth2Client();
      oauth2Client.setCredentials({ access_token: accessToken });

      const tokenInfo = await oauth2Client.getTokenInfo(accessToken);
      return tokenInfo;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return null;
    }
  }
}

export const googleDriveService = new GoogleDriveService();