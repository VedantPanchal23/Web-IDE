import React from 'react';
import useBackgroundSync from '../../hooks/useBackgroundSync';
import './SyncStatus.css';

/**
 * Sync Status Component
 * Shows current synchronization state and controls
 */
const SyncStatus = ({ projectId, compact = false }) => {
  const {
    isRunning,
    isSyncing,
    lastSyncResult,
    error,
    engineStatus,
    start,
    stop,
    sync
  } = useBackgroundSync({ projectId });

  const getStatusIcon = () => {
    if (error) return '❌';
    if (isSyncing) return '🔄';
    if (isRunning) return '✅';
    return '⏸️';
  };

  const getStatusText = () => {
    if (error) return 'Error';
    if (isSyncing) return 'Syncing...';
    if (isRunning) return 'Active';
    return 'Stopped';
  };

  const getStatusColor = () => {
    if (error) return '#ef4444';
    if (isSyncing) return '#3b82f6';
    if (isRunning) return '#22c55e';
    return '#6b7280';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (compact) {
    return (
      <div className="sync-status-compact">
        <span 
          className="status-indicator"
          style={{ color: getStatusColor() }}
          title={getStatusText()}
        >
          {getStatusIcon()}
        </span>
        <span className="status-text">{getStatusText()}</span>
      </div>
    );
  }

  return (
    <div className="sync-status">
      <div className="sync-header">
        <div className="sync-info">
          <span 
            className="status-indicator" 
            style={{ color: getStatusColor() }}
          >
            {getStatusIcon()}
          </span>
          <div className="status-details">
            <div className="status-label">Background Sync</div>
            <div className="status-value">{getStatusText()}</div>
          </div>
        </div>
        <div className="sync-controls">
          {!isRunning ? (
            <button className="sync-btn start" onClick={() => start()}>
              ▶️ Start
            </button>
          ) : (
            <button className="sync-btn stop" onClick={stop}>
              ⏸️ Stop
            </button>
          )}
          <button 
            className="sync-btn manual" 
            onClick={sync}
            disabled={isSyncing}
          >
            {isSyncing ? '⏳' : '🔄'} Sync Now
          </button>
        </div>
      </div>

      {error && (
        <div className="sync-error">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
        </div>
      )}

      {lastSyncResult && (
        <div className="sync-result">
          <div className="result-header">
            <span>Last Sync</span>
            <span className="result-time">
              {formatTimestamp(lastSyncResult.timestamp)}
            </span>
          </div>
          {lastSyncResult.success ? (
            <div className="result-stats">
              <div className="stat-item">
                <span className="stat-icon">📁</span>
                <span className="stat-label">Checked:</span>
                <span className="stat-value">{lastSyncResult.stats?.filesChecked || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">⬆️</span>
                <span className="stat-label">Uploaded:</span>
                <span className="stat-value">{lastSyncResult.stats?.filesUploaded || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">⬇️</span>
                <span className="stat-label">Downloaded:</span>
                <span className="stat-value">{lastSyncResult.stats?.filesDownloaded || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">⚠️</span>
                <span className="stat-label">Conflicts:</span>
                <span className="stat-value">{lastSyncResult.stats?.conflictsDetected || 0}</span>
              </div>
            </div>
          ) : (
            <div className="result-error">
              Failed: {lastSyncResult.error}
            </div>
          )}
        </div>
      )}

      {engineStatus && (
        <div className="engine-status">
          <div className="engine-header">Engine Status</div>
          <div className="engine-stats">
            <div className="engine-stat">
              <span>Active Projects:</span>
              <span>{engineStatus.activeProjectsCount || 0}</span>
            </div>
            <div className="engine-stat">
              <span>Queue Size:</span>
              <span>{engineStatus.totalQueueSize || 0}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatus;
