import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  VscSync, VscRefresh, VscCloud, VscCloudUpload, VscCloudDownload,
  VscCheck, VscError, VscWarning, VscLoading, VscPlay, VscDebugPause
} from 'react-icons/vsc';
import './SyncStatus.css';

/**
 * SyncStatus Component
 * Displays sync engine status and provides manual sync controls
 */
const SyncStatus = ({ projectId, className }) => {
  const { isAuthenticated, user } = useAuth();
  const [syncStatus, setSyncStatus] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch sync and queue status
  const fetchStatus = async () => {
    if (!isAuthenticated) {
      console.log('Sync status: User not authenticated, skipping status fetch');
      return;
    }

    try {
      const [syncResponse, queueResponse] = await Promise.all([
        apiService.get('/sync/status'),
        apiService.get('/sync/queue/status')
      ]);

      if (syncResponse && syncResponse.data && syncResponse.data.success) {
        setSyncStatus(syncResponse.data.status);
      }

      if (queueResponse && queueResponse.data && queueResponse.data.success) {
        setQueueStatus(queueResponse.data.queue);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
      // Handle authentication errors
      if (error.response && error.response.status === 401) {
        console.warn('Sync status: Authentication required');
      }
    }
  };

  // Auto-refresh status
  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 10000); // Every 10 seconds
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Manual sync trigger
  const triggerManualSync = async (direction = 'bidirectional') => {
    if (!projectId) {
      alert('No project selected');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.post('/sync/manual', {
        projectId,
        direction
      });

      if (response.data.success) {
        alert(`Manual sync initiated: ${response.data.syncId}`);
        // Refresh status after a short delay
        setTimeout(fetchStatus, 2000);
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      alert('Failed to initiate manual sync');
    } finally {
      setLoading(false);
    }
  };

  // Toggle background sync
  const toggleBackgroundSync = async () => {
    if (!syncStatus) return;

    try {
      const response = await apiService.post('/sync/settings', {
        backgroundSyncEnabled: !syncStatus.backgroundSyncRunning
      });

      if (response.data.success) {
        setSyncStatus(prev => ({
          ...prev,
          backgroundSyncRunning: !prev.backgroundSyncRunning
        }));
      }
    } catch (error) {
      console.error('Failed to toggle background sync:', error);
      alert('Failed to update sync settings');
    }
  };

  if (!syncStatus && !queueStatus) {
    return (
      <div className={`sync-status loading ${className || ''}`}>
        <div className="status-item">
          <VscLoading className="spin-icon" />
          <span>Loading sync status...</span>
        </div>
      </div>
    );
  }

  const totalQueueItems = (queueStatus?.uploadQueue?.length || 0) + 
                         (queueStatus?.downloadQueue?.length || 0);
  
  const processingItems = queueStatus?.processing?.count || 0;

  return (
    <div className={`sync-status ${className || ''}`}>
      {/* Header */}
      <div className="sync-status-header">
        <h4>
          <VscCloud style={{ marginRight: '8px' }} />
          Cloud Sync
        </h4>
        <button 
          className="btn btn-small btn-icon"
          onClick={fetchStatus}
          title="Refresh status"
        >
          <VscRefresh />
        </button>
      </div>

      {/* Background Sync Status */}
      <div className="status-section">
        <div className="status-item">
          <span className="status-label">Background Sync:</span>
          <span className={`status-value ${syncStatus?.backgroundSyncRunning ? 'active' : 'inactive'}`}>
            {syncStatus?.backgroundSyncRunning ? (
              <><VscCheck /> Running</>
            ) : (
              <><VscDebugPause /> Stopped</>
            )}
          </span>
          <button
            className={`btn btn-tiny ${syncStatus?.backgroundSyncRunning ? 'btn-warning' : 'btn-success'}`}
            onClick={toggleBackgroundSync}
            title={syncStatus?.backgroundSyncRunning ? 'Stop background sync' : 'Start background sync'}
          >
            {syncStatus?.backgroundSyncRunning ? <><VscDebugPause /> Stop</> : <><VscPlay /> Start</>}
          </button>
        </div>

        {syncStatus?.lastSync && (
          <div className="status-item">
            <span className="status-label">Last Sync:</span>
            <span className="status-value">
              {new Date(syncStatus.lastSync).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Queue Status */}
      <div className="status-section">
        <div className="section-header">Queue Status</div>
        
        <div className="status-item">
          <span className="status-label">Queued Operations:</span>
          <span className="status-value">{totalQueueItems}</span>
        </div>

        <div className="status-item">
          <span className="status-label">Processing:</span>
          <span className="status-value">{processingItems}</span>
        </div>

        {queueStatus?.uploadQueue?.length > 0 && (
          <div className="queue-details">
            <div className="queue-type">
              <VscCloudUpload /> Upload Queue ({queueStatus.uploadQueue.length})
            </div>
            {queueStatus.uploadQueue.slice(0, 3).map((item, index) => (
              <div key={index} className="queue-item">
                <span className="file-name">{item.fileName}</span>
                <span className={`status-badge ${item.status}`}>{item.status}</span>
              </div>
            ))}
            {queueStatus.uploadQueue.length > 3 && (
              <div className="queue-more">
                ... and {queueStatus.uploadQueue.length - 3} more
              </div>
            )}
          </div>
        )}

        {queueStatus?.downloadQueue?.length > 0 && (
          <div className="queue-details">
            <div className="queue-type">
              <VscCloudDownload /> Download Queue ({queueStatus.downloadQueue.length})
            </div>
            {queueStatus.downloadQueue.slice(0, 3).map((item, index) => (
              <div key={index} className="queue-item">
                <span className="file-name">{item.fileName}</span>
                <span className={`status-badge ${item.status}`}>{item.status}</span>
              </div>
            ))}
            {queueStatus.downloadQueue.length > 3 && (
              <div className="queue-more">
                ... and {queueStatus.downloadQueue.length - 3} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Sync Controls */}
      <div className="status-section">
        <div className="section-header">Manual Sync</div>
        
        <div className="manual-sync-controls">
          <button
            className="btn btn-primary btn-small"
            onClick={() => triggerManualSync('bidirectional')}
            disabled={loading || !projectId}
            title="Sync both ways (upload local changes, download remote changes)"
          >
            {loading ? <VscLoading className="spin-icon" /> : <VscSync />} Full Sync
          </button>

          <button
            className="btn btn-success btn-small"
            onClick={() => triggerManualSync('upload')}
            disabled={loading || !projectId}
            title="Upload local changes to remote"
          >
            <VscCloudUpload /> Upload Only
          </button>

          <button
            className="btn btn-info btn-small"
            onClick={() => triggerManualSync('download')}
            disabled={loading || !projectId}
            title="Download remote changes to local"
          >
            <VscCloudDownload /> Download Only
          </button>
        </div>

        {!projectId && (
          <div className="sync-warning">
            <VscWarning /> Select a project to enable manual sync
          </div>
        )}
      </div>

      {/* Last Refresh */}
      <div className="status-footer">
        <small className="last-refresh">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </small>
      </div>
    </div>
  );
};

export default SyncStatus;