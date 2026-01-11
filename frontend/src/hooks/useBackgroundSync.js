import { useState, useEffect, useCallback } from 'react';
import backgroundSyncService from '../services/backgroundSync';

/**
 * React Hook for Background Sync
 * 
 * @param {Object} options - Hook options
 * @param {string} options.projectId - Project ID to sync
 * @param {boolean} options.autoStart - Automatically start sync on mount
 * @param {number} options.interval - Sync interval in milliseconds
 * @returns {Object} Sync state and controls
 */
export const useBackgroundSync = (options = {}) => {
  const {
    projectId,
    autoStart = false,
    interval = 30000
  } = options;

  const [isRunning, setIsRunning] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [engineStatus, setEngineStatus] = useState(null);

  // Start background sync
  const start = useCallback(async (customInterval) => {
    if (!projectId) {
      console.error('Cannot start sync: no project ID');
      return;
    }

    try {
      await backgroundSyncService.start(projectId, customInterval || interval);
      setIsRunning(true);
      setError(null);
    } catch (err) {
      console.error('Failed to start background sync:', err);
      setError(err.message);
    }
  }, [projectId, interval]);

  // Stop background sync
  const stop = useCallback(async () => {
    try {
      await backgroundSyncService.stop();
      setIsRunning(false);
    } catch (err) {
      console.error('Failed to stop background sync:', err);
      setError(err.message);
    }
  }, []);

  // Manual sync trigger
  const sync = useCallback(async () => {
    if (!projectId) {
      console.error('Cannot sync: no project ID');
      return;
    }

    try {
      setIsSyncing(true);
      setError(null);
      const result = await backgroundSyncService.manualSync(projectId);
      setLastSyncResult(result);
      return result;
    } catch (err) {
      console.error('Manual sync failed:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [projectId]);

  // Refresh engine status
  const refreshStatus = useCallback(async () => {
    try {
      const status = await backgroundSyncService.getEngineStatus();
      setEngineStatus(status);
      return status;
    } catch (err) {
      console.error('Failed to get engine status:', err);
    }
  }, []);

  // Subscribe to sync events
  useEffect(() => {
    const unsubscribe = backgroundSyncService.on((event) => {
      switch (event.type) {
        case 'started':
          setIsRunning(true);
          setError(null);
          break;
        case 'stopped':
          setIsRunning(false);
          break;
        case 'sync-started':
          setIsSyncing(true);
          break;
        case 'sync-completed':
          setIsSyncing(false);
          setLastSyncResult(event.result);
          setError(null);
          break;
        case 'sync-failed':
          setIsSyncing(false);
          setError(event.error);
          break;
        default:
          break;
      }
    });

    const unsubscribeError = backgroundSyncService.onError((err) => {
      setError(err.error || err.message);
    });

    return () => {
      unsubscribe();
      unsubscribeError();
    };
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && projectId && !isRunning) {
      start();
    }

    return () => {
      if (autoStart && isRunning) {
        stop();
      }
    };
  }, [autoStart, projectId]); // Intentionally excluding start/stop to avoid loops

  // Periodically refresh engine status
  useEffect(() => {
    if (isRunning) {
      refreshStatus();
      const intervalId = setInterval(refreshStatus, 10000); // Refresh every 10s
      return () => clearInterval(intervalId);
    }
  }, [isRunning, refreshStatus]);

  return {
    // State
    isRunning,
    isSyncing,
    lastSyncResult,
    error,
    engineStatus,
    
    // Methods
    start,
    stop,
    sync,
    refreshStatus,
    
    // Service reference
    service: backgroundSyncService
  };
};

export default useBackgroundSync;
