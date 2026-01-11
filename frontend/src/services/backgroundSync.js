import { apiService } from './api';

/**
 * Background Sync Service
 * Manages automatic file synchronization between local and Google Drive
 */
class BackgroundSyncService {
  constructor() {
    this.isRunning = false;
    this.currentProjectId = null;
    this.syncInterval = 30000; // 30 seconds
    this.intervalId = null;
    this.lastSyncResult = null;
    this.syncListeners = new Set();
    this.errorListeners = new Set();
  }

  /**
   * Start background sync for a project
   * @param {string} projectId - Project ID to sync
   * @param {number} intervalMs - Sync interval in milliseconds (default: 30s)
   */
  async start(projectId, intervalMs = 30000) {
    if (this.isRunning && this.currentProjectId === projectId) {
      console.log('Background sync already running for this project');
      return;
    }

    // Stop existing sync if running
    if (this.isRunning) {
      this.stop();
    }

    this.currentProjectId = projectId;
    this.syncInterval = intervalMs;
    this.isRunning = true;

    console.log(`🔄 Starting background sync for project ${projectId} (interval: ${intervalMs}ms)`);

    // Start backend background sync
    try {
      const response = await apiService.post('/sync/background/start', {
        projectId,
        intervalMs
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to start background sync');
      }

      console.log('✅ Backend background sync started');
    } catch (error) {
      console.error('Failed to start backend background sync:', error);
      this.notifyError({ type: 'start-failed', error: error.message });
    }

    // Run initial sync immediately
    await this.runSync();

    // Setup interval for periodic syncs
    this.intervalId = setInterval(() => {
      this.runSync();
    }, intervalMs);

    this.notifyListeners({ type: 'started', projectId, intervalMs });
  }

  /**
   * Stop background sync
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('⏸️ Stopping background sync');

    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Stop backend background sync
    if (this.currentProjectId) {
      try {
        await apiService.post('/sync/background/stop', {
          projectId: this.currentProjectId
        });
        console.log('✅ Backend background sync stopped');
      } catch (error) {
        console.error('Failed to stop backend background sync:', error);
      }
    }

    const projectId = this.currentProjectId;
    this.isRunning = false;
    this.currentProjectId = null;

    this.notifyListeners({ type: 'stopped', projectId });
  }

  /**
   * Run a single sync operation
   */
  async runSync() {
    if (!this.currentProjectId) {
      return;
    }

    const projectId = this.currentProjectId;
    const startTime = Date.now();

    try {
      console.log(`🔄 Running sync for project ${projectId}...`);

      this.notifyListeners({ type: 'sync-started', projectId });

      const response = await apiService.post('/sync/project', { projectId });

      if (!response.success) {
        throw new Error(response.message || 'Sync failed');
      }

      const duration = Date.now() - startTime;
      const result = {
        success: true,
        projectId,
        stats: response.stats,
        duration,
        timestamp: new Date().toISOString()
      };

      this.lastSyncResult = result;

      console.log(`✅ Sync completed in ${duration}ms`, response.stats);

      this.notifyListeners({
        type: 'sync-completed',
        projectId,
        result
      });

      return result;

    } catch (error) {
      console.error('❌ Sync failed:', error);

      const result = {
        success: false,
        projectId,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      this.lastSyncResult = result;

      this.notifyError({
        type: 'sync-failed',
        projectId,
        error: error.message
      });

      this.notifyListeners({
        type: 'sync-failed',
        projectId,
        error: error.message
      });

      return result;
    }
  }

  /**
   * Manually trigger a sync
   */
  async manualSync(projectId) {
    const previousProjectId = this.currentProjectId;
    this.currentProjectId = projectId || this.currentProjectId;

    if (!this.currentProjectId) {
      throw new Error('No project ID provided');
    }

    const result = await this.runSync();
    
    // Restore previous project ID if different
    if (projectId && projectId !== previousProjectId) {
      this.currentProjectId = previousProjectId;
    }

    return result;
  }

  /**
   * Get sync status
   */
  async getStatus(projectId) {
    try {
      const response = await apiService.get(`/sync/status/${projectId || this.currentProjectId}`);
      return response;
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get overall engine status
   */
  async getEngineStatus() {
    try {
      const response = await apiService.get('/sync/engine/status');
      return response;
    } catch (error) {
      console.error('Failed to get engine status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Subscribe to sync events
   * @param {Function} callback - Callback function to handle sync events
   * @returns {Function} Unsubscribe function
   */
  on(callback) {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  /**
   * Subscribe to error events
   * @param {Function} callback - Callback function to handle errors
   * @returns {Function} Unsubscribe function
   */
  onError(callback) {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }

  /**
   * Notify all sync listeners
   */
  notifyListeners(event) {
    this.syncListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  /**
   * Notify all error listeners
   */
  notifyError(error) {
    this.errorListeners.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  /**
   * Get last sync result
   */
  getLastSyncResult() {
    return this.lastSyncResult;
  }

  /**
   * Check if sync is running
   */
  isActive() {
    return this.isRunning;
  }

  /**
   * Get current project ID
   */
  getCurrentProjectId() {
    return this.currentProjectId;
  }

  /**
   * Get sync interval
   */
  getSyncInterval() {
    return this.syncInterval;
  }
}

// Export singleton instance
const backgroundSyncService = new BackgroundSyncService();
export default backgroundSyncService;
export { backgroundSyncService };
