import React from 'react';
import './FileWatcherStatus.css';

/**
 * File Watcher Status Indicator Component
 * Shows real-time connection status and recent file events
 */
const FileWatcherStatus = ({ status, events = [], error, onClearEvents, compact = false }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'watching':
        return '👁️';
      case 'connected':
        return '🔗';
      case 'disconnected':
        return '⚫';
      case 'error':
        return '❌';
      case 'disabled':
        return '⏸️';
      default:
        return '⚫';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'watching':
        return '#22c55e'; // green
      case 'connected':
        return '#3b82f6'; // blue
      case 'disconnected':
        return '#6b7280'; // gray
      case 'error':
        return '#ef4444'; // red
      case 'disabled':
        return '#f59e0b'; // amber
      default:
        return '#6b7280';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'watching':
        return 'Watching';
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      case 'disabled':
        return 'Disabled';
      default:
        return 'Unknown';
    }
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'file-added':
        return '📄';
      case 'file-changed':
        return '📝';
      case 'file-deleted':
        return '🗑️';
      case 'dir-added':
        return '📁';
      case 'dir-deleted':
        return '🗂️';
      default:
        return '📋';
    }
  };

  const getEventLabel = (eventType) => {
    switch (eventType) {
      case 'file-added':
        return 'Added';
      case 'file-changed':
        return 'Changed';
      case 'file-deleted':
        return 'Deleted';
      case 'dir-added':
        return 'Dir Added';
      case 'dir-deleted':
        return 'Dir Deleted';
      default:
        return eventType;
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString();
  };

  if (compact) {
    return (
      <div className="file-watcher-status-compact">
        <span 
          className="status-indicator" 
          style={{ color: getStatusColor() }}
          title={getStatusText()}
        >
          {getStatusIcon()}
        </span>
        {events.length > 0 && (
          <span className="event-count" title="Recent events">
            {events.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="file-watcher-status">
      <div className="status-header">
        <div className="status-info">
          <span 
            className="status-indicator" 
            style={{ color: getStatusColor() }}
          >
            {getStatusIcon()}
          </span>
          <span className="status-text">{getStatusText()}</span>
        </div>
        {events.length > 0 && (
          <button 
            className="clear-events-btn" 
            onClick={onClearEvents}
            title="Clear events"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="status-error">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
        </div>
      )}

      {events.length > 0 && (
        <div className="events-list">
          <div className="events-header">
            Recent Events ({events.length})
          </div>
          <div className="events-container">
            {events.slice().reverse().map((event, index) => (
              <div key={index} className="event-item">
                <span className="event-icon">{getEventIcon(event.type)}</span>
                <span className="event-label">{getEventLabel(event.type)}</span>
                <span className="event-path" title={event.data.filePath || event.data.dirPath}>
                  {(event.data.filePath || event.data.dirPath || '').split('/').pop()}
                </span>
                <span className="event-time">{formatTimestamp(event.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && status === 'watching' && (
        <div className="no-events">
          No file changes detected
        </div>
      )}
    </div>
  );
};

export default FileWatcherStatus;
