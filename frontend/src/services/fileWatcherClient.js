import io from 'socket.io-client';
import { apiService } from './api';

/**
 * File Watcher Client Service
 * 
 * Manages WebSocket connection to backend file watcher service
 * Listens for real-time file system events and dispatches them to components
 */
class FileWatcherClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentProjectId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000; // 2 seconds
    this.eventHandlers = new Map(); // event type -> Set of handlers
    this.lastFileEvents = []; // Store recent events for debugging
    this.maxEventHistory = 50;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.socket && this.isConnected) {
      return;
    }

    // Get the base URL without /api/v1 path
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const BACKEND_URL = apiUrl.replace('/api/v1', '');

    this.socket = io(BACKEND_URL, {
      transports: ['polling'], // Use polling only to avoid WebSocket upgrade errors
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelayMax: 10000, // Max 10 seconds between reconnects
      timeout: 10000,
      path: '/socket.io/',
      autoConnect: true,
      forceNew: true
    });

    this.setupEventHandlers();
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ File watcher connected', { socketId: this.socket.id });
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Dispatch connection event
      this.dispatchEvent('connection', { connected: true, socketId: this.socket.id });

      // Re-register if we were watching a project
      if (this.currentProjectId) {
        this.registerProject(this.currentProjectId).catch(error => {
          console.error('Failed to re-register file watcher:', error);
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ File watcher disconnected', { reason });
      this.isConnected = false;
      
      // Dispatch disconnection event
      this.dispatchEvent('disconnection', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      // Suppress transient WebSocket upgrade errors
      const isTransientError = error.message && (
        error.message.includes('websocket error') ||
        error.message.includes('xhr poll error') ||
        error.message.includes('Invalid frame header')
      );
      
      if (!isTransientError) {
        console.error('File watcher connection error:', error.message);
      }
      
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.dispatchEvent('connection-failed', { error: error.message });
      }
    });

    // File watcher events
    this.socket.on('file-watcher:registered', (data) => {
      console.log('✅ File watcher registered', data);
      this.dispatchEvent('registered', data);
    });

    this.socket.on('file-watcher:unregistered', (data) => {
      console.log('✅ File watcher unregistered', data);
      this.currentProjectId = null;
      this.dispatchEvent('unregistered', data);
    });

    this.socket.on('file-watcher:error', (data) => {
      console.error('❌ File watcher error:', data.error);
      this.dispatchEvent('error', data);
    });

    // File system events
    this.socket.on('file-added', (data) => {
      this.addToHistory('file-added', data);
      this.dispatchEvent('file-added', data);
      
      // Also dispatch generic file-change event
      this.dispatchEvent('file-change', { type: 'added', ...data });
    });

    this.socket.on('file-changed', (data) => {
      this.addToHistory('file-changed', data);
      this.dispatchEvent('file-changed', data);
      
      // Also dispatch generic file-change event
      this.dispatchEvent('file-change', { type: 'changed', ...data });
    });

    this.socket.on('file-deleted', (data) => {
      this.addToHistory('file-deleted', data);
      this.dispatchEvent('file-deleted', data);
      
      // Also dispatch generic file-change event
      this.dispatchEvent('file-change', { type: 'deleted', ...data });
    });

    this.socket.on('dir-added', (data) => {
      this.addToHistory('dir-added', data);
      this.dispatchEvent('dir-added', data);
      
      // Also dispatch generic file-change event
      this.dispatchEvent('file-change', { type: 'dir-added', ...data });
    });

    this.socket.on('dir-deleted', (data) => {
      this.addToHistory('dir-deleted', data);
      this.dispatchEvent('dir-deleted', data);
      
      // Also dispatch generic file-change event
      this.dispatchEvent('file-change', { type: 'dir-deleted', ...data });
    });
  }

  /**
   * Register to watch a project
   */
  async registerProject(projectId, containerId = null) {
    if (!this.socket || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    try {
      // Get workspace path and container ID from API
      const response = await apiService.get(`/projects/${projectId}/workspace-path`);
      
      // Check response structure - axios returns data wrapped
      const responseData = response.data || response;
      
      if (!responseData.success) {
        throw new Error(responseData.message || 'Failed to get workspace path');
      }

      const { workspacePath, containerId: projectContainerId } = responseData;

      // Use provided containerId or fall back to API response
      const finalContainerId = containerId || projectContainerId;

      // Send registration request with containerId if available
      this.socket.emit('file-watcher:register', {
        projectId,
        workspacePath,
        containerId: finalContainerId
      });

      this.currentProjectId = projectId;

      console.log('📁 File watcher registered:', { projectId, workspacePath, containerId: finalContainerId });

      return { success: true, projectId, workspacePath, containerId: finalContainerId };
    } catch (error) {
      console.error('Failed to register file watcher:', error);
      throw error;
    }
  }

  /**
   * Unregister from watching current project
   */
  unregisterProject() {
    if (!this.socket || !this.currentProjectId) {
      return;
    }

    this.socket.emit('file-watcher:unregister', {
      projectId: this.currentProjectId
    });

    this.currentProjectId = null;
  }

  /**
   * Add event handler
   */
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType).add(handler);

    // Return unsubscribe function
    return () => {
      this.off(eventType, handler);
    };
  }

  /**
   * Remove event handler
   */
  off(eventType, handler) {
    if (this.eventHandlers.has(eventType)) {
      this.eventHandlers.get(eventType).delete(handler);
    }
  }

  /**
   * Dispatch event to all registered handlers
   */
  dispatchEvent(eventType, data) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }

    // Also dispatch to document for global listeners
    document.dispatchEvent(new CustomEvent(`file-watcher:${eventType}`, {
      detail: data
    }));
  }

  /**
   * Add event to history (for debugging)
   */
  addToHistory(eventType, data) {
    this.lastFileEvents.unshift({
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    });

    // Keep only last N events
    if (this.lastFileEvents.length > this.maxEventHistory) {
      this.lastFileEvents = this.lastFileEvents.slice(0, this.maxEventHistory);
    }
  }

  /**
   * Get event history
   */
  getEventHistory() {
    return this.lastFileEvents;
  }

  /**
   * Clear event history
   */
  clearEventHistory() {
    this.lastFileEvents = [];
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.currentProjectId) {
      this.unregisterProject();
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Check connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      currentProjectId: this.currentProjectId,
      reconnectAttempts: this.reconnectAttempts,
      eventHistory: this.lastFileEvents.length
    };
  }
}

// Export singleton instance
const fileWatcherClient = new FileWatcherClient();
export default fileWatcherClient;
export { fileWatcherClient };
