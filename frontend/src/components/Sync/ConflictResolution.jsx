import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import './ConflictResolution.css';

/**
 * Conflict Resolution UI Component
 * Displays file sync conflicts and allows user to choose resolution strategy
 */
const ConflictResolution = ({ projectId, onResolved }) => {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [compareMode, setCompareMode] = useState(false);

  // Fetch conflicts on mount
  useEffect(() => {
    if (projectId) {
      fetchConflicts();
    }
  }, [projectId]);

  const fetchConflicts = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/sync/conflicts', { projectId });
      
      if (response.success) {
        setConflicts(response.conflicts || []);
      }
    } catch (error) {
      console.error('Failed to fetch conflicts:', error);
    } finally {
      setLoading(false);
    }
  };

  const resolveConflict = async (fileId, strategy, customContent = null) => {
    try {
      setResolving(fileId);

      const payload = {
        strategy,
        ...(customContent && { customContent })
      };

      const response = await apiService.post(`/sync/conflicts/${fileId}/resolve`, payload);

      if (response.success) {
        // Remove resolved conflict from list
        setConflicts(prev => prev.filter(c => c.file._id !== fileId));
        setSelectedConflict(null);
        setCompareMode(false);

        if (onResolved) {
          onResolved({ fileId, strategy });
        }
      } else {
        alert(`Failed to resolve conflict: ${response.message}`);
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      alert(`Error resolving conflict: ${error.message}`);
    } finally {
      setResolving(null);
    }
  };

  const viewConflict = (conflict) => {
    setSelectedConflict(conflict);
    setCompareMode(true);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="conflict-resolution loading">
        <div className="loading-spinner"></div>
        <p>Loading conflicts...</p>
      </div>
    );
  }

  if (conflicts.length === 0) {
    return (
      <div className="conflict-resolution empty">
        <div className="empty-icon">✅</div>
        <h3>No Conflicts</h3>
        <p>All files are synchronized without conflicts.</p>
      </div>
    );
  }

  if (compareMode && selectedConflict) {
    return (
      <div className="conflict-resolution compare-mode">
        <div className="compare-header">
          <button 
            className="back-btn"
            onClick={() => {
              setCompareMode(false);
              setSelectedConflict(null);
            }}
          >
            ← Back to Conflicts
          </button>
          <h3>{selectedConflict.file.name}</h3>
        </div>

        <div className="conflict-info">
          <div className="info-item">
            <strong>Path:</strong> {selectedConflict.file.path}
          </div>
          <div className="info-item">
            <strong>Conflict Type:</strong> {selectedConflict.conflictType}
          </div>
          <div className="info-item">
            <strong>Detected:</strong> {formatTimestamp(selectedConflict.detectedAt)}
          </div>
        </div>

        <div className="compare-panel">
          <div className="version-panel local">
            <div className="version-header">
              <h4>📄 Local Version</h4>
              <div className="version-meta">
                <span>Modified: {formatTimestamp(selectedConflict.localVersion.lastModified)}</span>
                <span>Size: {formatSize(selectedConflict.localVersion.size)}</span>
              </div>
            </div>
            <pre className="version-content">
              {selectedConflict.localVersion.content || '(No content)'}
            </pre>
          </div>

          <div className="version-panel remote">
            <div className="version-header">
              <h4>☁️ Remote Version (Google Drive)</h4>
              <div className="version-meta">
                <span>Modified: {formatTimestamp(selectedConflict.remoteVersion.lastModified)}</span>
                <span>Size: {formatSize(selectedConflict.remoteVersion.size)}</span>
              </div>
            </div>
            <pre className="version-content">
              {selectedConflict.remoteVersion.content || '(No content)'}
            </pre>
          </div>
        </div>

        <div className="resolution-actions">
          <h4>Choose Resolution:</h4>
          <div className="action-buttons">
            <button
              className="resolution-btn keep-local"
              onClick={() => resolveConflict(selectedConflict.file._id, 'keep-local')}
              disabled={resolving === selectedConflict.file._id}
            >
              {resolving === selectedConflict.file._id ? '⏳' : '📄'} Keep Local
            </button>
            <button
              className="resolution-btn keep-remote"
              onClick={() => resolveConflict(selectedConflict.file._id, 'keep-remote')}
              disabled={resolving === selectedConflict.file._id}
            >
              {resolving === selectedConflict.file._id ? '⏳' : '☁️'} Keep Remote
            </button>
            <button
              className="resolution-btn merge"
              onClick={() => resolveConflict(selectedConflict.file._id, 'merge')}
              disabled={resolving === selectedConflict.file._id}
            >
              {resolving === selectedConflict.file._id ? '⏳' : '🔀'} Auto Merge
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="conflict-resolution">
      <div className="conflicts-header">
        <h3>⚠️ Sync Conflicts ({conflicts.length})</h3>
        <button className="refresh-btn" onClick={fetchConflicts}>
          🔄 Refresh
        </button>
      </div>

      <div className="conflicts-list">
        {conflicts.map((conflict) => (
          <div key={conflict.file._id} className="conflict-item">
            <div className="conflict-icon">⚠️</div>
            <div className="conflict-details">
              <div className="conflict-name">{conflict.file.name}</div>
              <div className="conflict-path">{conflict.file.path}</div>
              <div className="conflict-meta">
                <span className="conflict-type">{conflict.conflictType}</span>
                <span className="conflict-time">
                  Detected: {formatTimestamp(conflict.detectedAt)}
                </span>
              </div>
            </div>
            <div className="conflict-actions">
              <button
                className="view-btn"
                onClick={() => viewConflict(conflict)}
              >
                🔍 Compare
              </button>
              <button
                className="quick-resolve-btn keep-local"
                onClick={() => resolveConflict(conflict.file._id, 'keep-local')}
                disabled={resolving === conflict.file._id}
                title="Keep local version"
              >
                📄
              </button>
              <button
                className="quick-resolve-btn keep-remote"
                onClick={() => resolveConflict(conflict.file._id, 'keep-remote')}
                disabled={resolving === conflict.file._id}
                title="Keep remote version"
              >
                ☁️
              </button>
              <button
                className="quick-resolve-btn merge"
                onClick={() => resolveConflict(conflict.file._id, 'merge')}
                disabled={resolving === conflict.file._id}
                title="Auto merge"
              >
                🔀
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="conflicts-footer">
        <p>Choose how to resolve each conflict above.</p>
      </div>
    </div>
  );
};

export default ConflictResolution;
