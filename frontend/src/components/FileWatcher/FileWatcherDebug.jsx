import React, { useState, useEffect } from 'react';
import useFileWatcher from '../../hooks/useFileWatcher';
import './FileWatcherDebug.css';

/**
 * File Watcher Debug Panel
 * Developer tool for monitoring file watcher events and status
 */
const FileWatcherDebug = ({ projectId }) => {
  const {
    isConnected,
    isRegistered,
    status,
    error,
    events,
    getEventHistory,
    clearEventHistory,
    reconnect,
    client
  } = useFileWatcher({
    projectId,
    enabled: true
  });

  const [showHistory, setShowHistory] = useState(false);
  const [fullHistory, setFullHistory] = useState([]);
  const [clientStatus, setClientStatus] = useState(null);

  // Update full history periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setFullHistory(getEventHistory());
      setClientStatus(client.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, [getEventHistory, client]);

  const formatJSON = (obj) => {
    return JSON.stringify(obj, null, 2);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEventColor = (eventType) => {
    switch (eventType) {
      case 'file-added':
        return '#22c55e';
      case 'file-changed':
        return '#3b82f6';
      case 'file-deleted':
        return '#ef4444';
      case 'dir-added':
        return '#8b5cf6';
      case 'dir-deleted':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="file-watcher-debug">
      <div className="debug-header">
        <h3>🔍 File Watcher Debug</h3>
        <div className="debug-actions">
          <button onClick={() => setShowHistory(!showHistory)} className="debug-btn">
            {showHistory ? 'Hide' : 'Show'} History
          </button>
          <button onClick={clearEventHistory} className="debug-btn">
            Clear Events
          </button>
          <button onClick={reconnect} className="debug-btn">
            Reconnect
          </button>
        </div>
      </div>

      <div className="debug-section">
        <h4>Connection Status</h4>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">State:</span>
            <span className="status-value" style={{ color: isConnected ? '#22c55e' : '#ef4444' }}>
              {status}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Connected:</span>
            <span className="status-value">{isConnected ? '✅' : '❌'}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Registered:</span>
            <span className="status-value">{isRegistered ? '✅' : '❌'}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Socket ID:</span>
            <span className="status-value">{clientStatus?.socketId || 'N/A'}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Project ID:</span>
            <span className="status-value">{projectId || 'N/A'}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Reconnect Attempts:</span>
            <span className="status-value">{clientStatus?.reconnectAttempts || 0}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="debug-section error-section">
          <h4>Error</h4>
          <pre className="error-pre">{error}</pre>
        </div>
      )}

      <div className="debug-section">
        <h4>Recent Events ({events.length})</h4>
        <div className="events-list">
          {events.length === 0 ? (
            <div className="no-events">No events yet</div>
          ) : (
            events.slice().reverse().map((event, index) => (
              <div 
                key={index} 
                className="event-item"
                style={{ borderLeftColor: getEventColor(event.type) }}
              >
                <div className="event-header">
                  <span className="event-type" style={{ color: getEventColor(event.type) }}>
                    {event.type}
                  </span>
                  <span className="event-time">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                <div className="event-body">
                  <pre>{formatJSON(event.data)}</pre>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showHistory && (
        <div className="debug-section">
          <h4>Full Event History ({fullHistory.length})</h4>
          <div className="history-list">
            {fullHistory.length === 0 ? (
              <div className="no-events">No history</div>
            ) : (
              fullHistory.map((event, index) => (
                <div key={index} className="history-item">
                  <div className="history-header">
                    <span className="history-type">{event.type}</span>
                    <span className="history-time">{event.timestamp}</span>
                  </div>
                  <pre className="history-data">{formatJSON(event.data)}</pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="debug-section">
        <h4>Client Status</h4>
        <pre className="status-pre">{formatJSON(clientStatus)}</pre>
      </div>
    </div>
  );
};

export default FileWatcherDebug;
