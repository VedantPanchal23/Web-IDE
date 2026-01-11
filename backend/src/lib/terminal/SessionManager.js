import { logger } from '../../utils/logger.js';

/**
 * Terminal Session Manager
 * Handles terminal session persistence and recovery
 */
class TerminalSessionManager {
  constructor() {
    this.sessions = new Map(); // Store session metadata
    this.sessionTimeout = 60 * 1000; // 1 minute timeout for recovery
  }

  /**
   * Create a session record
   */
  createSession(terminalId, sessionData) {
    const session = {
      terminalId,
      userId: sessionData.userId,
      projectId: sessionData.projectId,
      language: sessionData.language,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
      recoveryData: {
        containerId: sessionData.containerId,
        workingDirectory: '/workspace'
      }
    };

    this.sessions.set(terminalId, session);
    logger.info('Terminal session created', { terminalId, userId: sessionData.userId });
    return session;
  }

  /**
   * Update session activity
   */
  updateActivity(terminalId) {
    const session = this.sessions.get(terminalId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Mark session as disconnected
   */
  markDisconnected(terminalId) {
    const session = this.sessions.get(terminalId);
    if (session) {
      session.status = 'disconnected';
      session.disconnectedAt = new Date();
      logger.info('Terminal session marked as disconnected', { terminalId });
    }
  }

  /**
   * Check if session can be recovered
   */
  canRecover(terminalId) {
    const session = this.sessions.get(terminalId);
    if (!session) return false;

    if (session.status === 'active') {
      return true; // Session is still active
    }

    if (session.status === 'disconnected') {
      const timeSinceDisconnect = Date.now() - session.disconnectedAt.getTime();
      return timeSinceDisconnect < this.sessionTimeout;
    }

    return false;
  }

  /**
   * Get session data for recovery
   */
  getSessionData(terminalId) {
    return this.sessions.get(terminalId);
  }

  /**
   * Remove session
   */
  removeSession(terminalId) {
    const session = this.sessions.get(terminalId);
    if (session) {
      this.sessions.delete(terminalId);
      logger.info('Terminal session removed', { terminalId });
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [terminalId, session] of this.sessions.entries()) {
      if (session.status === 'disconnected') {
        const timeSinceDisconnect = now - session.disconnectedAt.getTime();
        if (timeSinceDisconnect > this.sessionTimeout) {
          expiredSessions.push(terminalId);
        }
      }
    }

    expiredSessions.forEach(terminalId => {
      this.removeSession(terminalId);
    });

    return expiredSessions.length;
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId) {
    return Array.from(this.sessions.values()).filter(
      session => session.userId === userId && session.status === 'active'
    );
  }

  /**
   * Get session statistics
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      disconnectedSessions: sessions.filter(s => s.status === 'disconnected').length,
      sessionsByUser: sessions.reduce((acc, session) => {
        acc[session.userId] = (acc[session.userId] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

export default new TerminalSessionManager();