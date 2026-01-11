import { useEffect, useState, useCallback, useRef } from 'react';
import fileWatcherClient from '../services/fileWatcherClient';

/**
 * React Hook for File Watcher
 * Provides real-time file system event handling
 * 
 * @param {Object} options - Hook options
 * @param {string} options.projectId - Project ID to watch
 * @param {boolean} options.enabled - Enable/disable file watching
 * @param {Function} options.onFileAdded - Callback for file added events
 * @param {Function} options.onFileChanged - Callback for file changed events
 * @param {Function} options.onFileDeleted - Callback for file deleted events
 * @param {Function} options.onDirAdded - Callback for directory added events
 * @param {Function} options.onDirDeleted - Callback for directory deleted events
 * @param {Function} options.onError - Callback for error events
 * @returns {Object} - File watcher state and controls
 */
export const useFileWatcher = (options = {}) => {
  const {
    projectId,
    enabled = true,
    onFileAdded,
    onFileChanged,
    onFileDeleted,
    onDirAdded,
    onDirDeleted,
    onError
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('disconnected');
  
  const unsubscribersRef = useRef([]);
  const lastProjectIdRef = useRef(null);

  // Update status based on connection and registration state
  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
    } else if (error) {
      setStatus('error');
    } else if (isRegistered) {
      setStatus('watching');
    } else if (isConnected) {
      setStatus('connected');
    } else {
      setStatus('disconnected');
    }
  }, [enabled, isConnected, isRegistered, error]);

  // Connect to file watcher
  useEffect(() => {
    if (!enabled) return;

    // Connect to WebSocket
    fileWatcherClient.connect();

    // Setup event handlers
    const unsubConnection = fileWatcherClient.on('connection', (data) => {
      setIsConnected(data.connected);
      setError(null);
    });

    const unsubDisconnection = fileWatcherClient.on('disconnection', (data) => {
      setIsConnected(false);
      setIsRegistered(false);
    });

    const unsubConnectionFailed = fileWatcherClient.on('connection-failed', (data) => {
      setError(data.error);
    });

    const unsubRegistered = fileWatcherClient.on('registered', (data) => {
      setIsRegistered(true);
      setError(null);
    });

    const unsubUnregistered = fileWatcherClient.on('unregistered', (data) => {
      setIsRegistered(false);
    });

    const unsubError = fileWatcherClient.on('error', (data) => {
      setError(data.error);
      if (onError) {
        onError(data);
      }
    });

    unsubscribersRef.current.push(
      unsubConnection,
      unsubDisconnection,
      unsubConnectionFailed,
      unsubRegistered,
      unsubUnregistered,
      unsubError
    );

    return () => {
      // Cleanup event handlers
      unsubscribersRef.current.forEach(unsub => unsub());
      unsubscribersRef.current = [];
    };
  }, [enabled, onError]);

  // Register/unregister project
  useEffect(() => {
    if (!enabled || !isConnected || !projectId) return;

    // Unregister previous project if changed
    if (lastProjectIdRef.current && lastProjectIdRef.current !== projectId) {
      fileWatcherClient.unregisterProject();
      setIsRegistered(false);
    }

    // Register new project
    const register = async () => {
      try {
        await fileWatcherClient.registerProject(projectId);
        lastProjectIdRef.current = projectId;
      } catch (err) {
        console.error('Failed to register file watcher:', err);
        setError(err.message);
      }
    };

    register();

    return () => {
      if (projectId) {
        fileWatcherClient.unregisterProject();
        setIsRegistered(false);
        lastProjectIdRef.current = null;
      }
    };
  }, [enabled, isConnected, projectId]);

  // Setup file system event handlers
  useEffect(() => {
    if (!enabled) return;

    const handlers = [];

    if (onFileAdded) {
      const unsubFileAdded = fileWatcherClient.on('file-added', (data) => {
        setEvents(prev => [...prev.slice(-49), { type: 'file-added', data, timestamp: Date.now() }]);
        onFileAdded(data);
      });
      handlers.push(unsubFileAdded);
    }

    if (onFileChanged) {
      const unsubFileChanged = fileWatcherClient.on('file-changed', (data) => {
        setEvents(prev => [...prev.slice(-49), { type: 'file-changed', data, timestamp: Date.now() }]);
        onFileChanged(data);
      });
      handlers.push(unsubFileChanged);
    }

    if (onFileDeleted) {
      const unsubFileDeleted = fileWatcherClient.on('file-deleted', (data) => {
        setEvents(prev => [...prev.slice(-49), { type: 'file-deleted', data, timestamp: Date.now() }]);
        onFileDeleted(data);
      });
      handlers.push(unsubFileDeleted);
    }

    if (onDirAdded) {
      const unsubDirAdded = fileWatcherClient.on('dir-added', (data) => {
        setEvents(prev => [...prev.slice(-49), { type: 'dir-added', data, timestamp: Date.now() }]);
        onDirAdded(data);
      });
      handlers.push(unsubDirAdded);
    }

    if (onDirDeleted) {
      const unsubDirDeleted = fileWatcherClient.on('dir-deleted', (data) => {
        setEvents(prev => [...prev.slice(-49), { type: 'dir-deleted', data, timestamp: Date.now() }]);
        onDirDeleted(data);
      });
      handlers.push(unsubDirDeleted);
    }

    return () => {
      handlers.forEach(unsub => unsub());
    };
  }, [enabled, onFileAdded, onFileChanged, onFileDeleted, onDirAdded, onDirDeleted]);

  // Get event history
  const getEventHistory = useCallback(() => {
    return fileWatcherClient.getEventHistory();
  }, []);

  // Clear event history
  const clearEventHistory = useCallback(() => {
    fileWatcherClient.clearEventHistory();
    setEvents([]);
  }, []);

  // Manually reconnect
  const reconnect = useCallback(() => {
    fileWatcherClient.disconnect();
    setTimeout(() => {
      fileWatcherClient.connect();
    }, 100);
  }, []);

  return {
    // State
    isConnected,
    isRegistered,
    status,
    error,
    events,
    
    // Methods
    getEventHistory,
    clearEventHistory,
    reconnect,
    
    // Raw client for advanced usage
    client: fileWatcherClient
  };
};

export default useFileWatcher;
