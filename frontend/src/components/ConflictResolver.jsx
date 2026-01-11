import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './ConflictResolver.css';

/**
 * ConflictResolver Component
 * Handles file sync conflict detection and resolution
 */
const ConflictResolver = ({ projectId, onConflictResolved, className }) => {
  const { isAuthenticated, user } = useAuth();
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(new Set());
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [showDiffViewer, setShowDiffViewer] = useState(false);

  // Fetch conflicts on component mount and when projectId changes
  useEffect(() => {
    if (isAuthenticated && projectId) {
      fetchConflicts();
    }
  }, [isAuthenticated, projectId]);

  /**
   * Fetch conflicts from the API
   */
  const fetchConflicts = async () => {
    if (!isAuthenticated) {
      console.log('Conflict resolver: User not authenticated, skipping conflicts fetch');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.get('/sync/conflicts', {
        params: projectId ? { projectId } : {}
      });

      if (response.data && response.data.success) {
        setConflicts(response.data.conflicts);
      }
    } catch (error) {
      console.error('Failed to fetch conflicts:', error);
      if (error.response && error.response.status === 401) {
        console.warn('Conflict resolver: Authentication required');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resolve a conflict with the specified strategy
   */
  const resolveConflict = async (fileId, strategy, content = null) => {
    setResolving(prev => new Set([...prev, fileId]));

    try {
      const response = await apiService.post(`/sync/conflicts/${fileId}/resolve`, {
        strategy,
        content
      });

      if (response.data.success) {
        // Remove resolved conflict from list
        setConflicts(prev => prev.filter(conflict => conflict.fileId !== fileId));
        
        // Close diff viewer if this conflict was selected
        if (selectedConflict?.fileId === fileId) {
          setSelectedConflict(null);
          setShowDiffViewer(false);
        }

        // Notify parent component
        if (onConflictResolved) {
          onConflictResolved(fileId, strategy);
        }
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      alert('Failed to resolve conflict. Please try again.');
    } finally {
      setResolving(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  /**
   * Show diff viewer for a conflict
   */
  const showConflictDetails = (conflict) => {
    setSelectedConflict(conflict);
    setShowDiffViewer(true);
  };

  /**
   * Get conflict type display information
   */
  const getConflictTypeInfo = (conflictType) => {
    switch (conflictType) {
      case 'modify-modify':
        return {
          label: 'Simultaneous Modifications',
          description: 'Both local and remote versions were modified',
          icon: '⚡',
          severity: 'high'
        };
      case 'content-diverged':
        return {
          label: 'Content Diverged',
          description: 'Local and remote content have diverged significantly',
          icon: '🔀',
          severity: 'medium'
        };
      case 'delete-modify':
        return {
          label: 'Delete vs Modify',
          description: 'File was deleted locally but modified remotely',
          icon: '🗑️',
          severity: 'high'
        };
      default:
        return {
          label: 'Unknown Conflict',
          description: 'An unknown type of conflict occurred',
          icon: '❓',
          severity: 'medium'
        };
    }
  };

  if (loading) {
    return (
      <div className={`conflict-resolver loading ${className || ''}`}>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span>Loading conflicts...</span>
        </div>
      </div>
    );
  }

  if (conflicts.length === 0) {
    return (
      <div className={`conflict-resolver empty ${className || ''}`}>
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <h3>No Conflicts</h3>
          <p>All files are synchronized successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`conflict-resolver ${className || ''}`}>
      <div className="conflict-header">
        <h3>
          <span className="conflict-icon">⚠️</span>
          Sync Conflicts ({conflicts.length})
        </h3>
        <button 
          className="btn btn-secondary"
          onClick={fetchConflicts}
          disabled={loading}
        >
          🔄 Refresh
        </button>
      </div>

      <div className="conflict-list">
        {conflicts.map((conflict) => {
          const typeInfo = getConflictTypeInfo(conflict.conflictType);
          const isResolving = resolving.has(conflict.fileId);

          return (
            <div 
              key={conflict.fileId} 
              className={`conflict-item severity-${typeInfo.severity}`}
            >
              <div className="conflict-info">
                <div className="conflict-header-row">
                  <div className="conflict-type">
                    <span className="type-icon">{typeInfo.icon}</span>
                    <span className="type-label">{typeInfo.label}</span>
                  </div>
                  <div className="file-name">{conflict.fileName}</div>
                </div>
                
                <div className="conflict-details">
                  <div className="file-path">{conflict.filePath}</div>
                  <div className="conflict-description">{typeInfo.description}</div>
                  {conflict.conflictReason && (
                    <div className="conflict-reason">{conflict.conflictReason}</div>
                  )}
                </div>
              </div>

              <div className="conflict-actions">
                <button
                  className="btn btn-info btn-small"
                  onClick={() => showConflictDetails(conflict)}
                  disabled={isResolving}
                >
                  📊 View Diff
                </button>

                <div className="resolution-buttons">
                  <button
                    className="btn btn-success btn-small"
                    onClick={() => resolveConflict(conflict.fileId, 'keep-local')}
                    disabled={isResolving}
                    title="Keep the local version"
                  >
                    {isResolving ? '⏳' : '💻'} Keep Local
                  </button>

                  <button
                    className="btn btn-warning btn-small"
                    onClick={() => resolveConflict(conflict.fileId, 'keep-remote')}
                    disabled={isResolving}
                    title="Keep the remote version"
                  >
                    {isResolving ? '⏳' : '☁️'} Keep Remote
                  </button>

                  {(conflict.conflictType === 'modify-modify' || conflict.conflictType === 'content-diverged') && (
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => resolveConflict(conflict.fileId, 'merge')}
                      disabled={isResolving}
                      title="Attempt automatic merge"
                    >
                      {isResolving ? '⏳' : '🔀'} Auto Merge
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Diff Viewer Modal */}
      {showDiffViewer && selectedConflict && (
        <DiffViewerModal
          conflict={selectedConflict}
          onClose={() => {
            setShowDiffViewer(false);
            setSelectedConflict(null);
          }}
          onResolve={resolveConflict}
          isResolving={resolving.has(selectedConflict.fileId)}
        />
      )}
    </div>
  );
};

/**
 * DiffViewerModal Component
 * Shows a detailed diff between local and remote versions
 */
const DiffViewerModal = ({ conflict, onClose, onResolve, isResolving }) => {
  const [mergedContent, setMergedContent] = useState('');
  const [showMergeEditor, setShowMergeEditor] = useState(false);

  const conflictData = conflict.conflictData || {};
  const localContent = conflictData.localVersion?.content || '';
  const remoteContent = conflictData.remoteVersion?.content || '';

  /**
   * Handle manual merge resolution
   */
  const handleManualResolve = () => {
    if (mergedContent.trim()) {
      onResolve(conflict.fileId, 'manual', mergedContent);
    }
  };

  /**
   * Initialize merge editor with combined content
   */
  const initializeMergeEditor = () => {
    // Simple merge initialization - in practice, you might want to use a proper diff algorithm
    const mergedLines = [];
    const localLines = localContent.split('\n');
    const remoteLines = remoteContent.split('\n');
    
    mergedLines.push('<<<<<<< Local Version');
    mergedLines.push(...localLines);
    mergedLines.push('=======');
    mergedLines.push(...remoteLines);
    mergedLines.push('>>>>>>> Remote Version');
    
    setMergedContent(mergedLines.join('\n'));
    setShowMergeEditor(true);
  };

  return (
    <div className="diff-viewer-modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Conflict Resolution: {conflict.fileName}</h3>
          <button className="btn btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!showMergeEditor ? (
            <div className="diff-comparison">
              <div className="version-panel local-version">
                <div className="version-header">
                  <h4>💻 Local Version</h4>
                  <span className="version-info">
                    Modified: {new Date(conflictData.localVersion?.modifiedAt).toLocaleString()}
                  </span>
                </div>
                <pre className="version-content">{localContent}</pre>
              </div>

              <div className="version-panel remote-version">
                <div className="version-header">
                  <h4>☁️ Remote Version</h4>
                  <span className="version-info">
                    Modified: {new Date(conflictData.remoteVersion?.modifiedAt).toLocaleString()}
                  </span>
                </div>
                <pre className="version-content">{remoteContent}</pre>
              </div>
            </div>
          ) : (
            <div className="merge-editor">
              <div className="merge-header">
                <h4>🔀 Manual Merge Editor</h4>
                <p>Edit the content below to resolve the conflict, then click "Apply Merge".</p>
              </div>
              <textarea
                className="merge-textarea"
                value={mergedContent}
                onChange={(e) => setMergedContent(e.target.value)}
                rows={20}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!showMergeEditor ? (
            <div className="resolution-actions">
              <button
                className="btn btn-success"
                onClick={() => onResolve(conflict.fileId, 'keep-local')}
                disabled={isResolving}
              >
                Keep Local Version
              </button>

              <button
                className="btn btn-warning"
                onClick={() => onResolve(conflict.fileId, 'keep-remote')}
                disabled={isResolving}
              >
                Keep Remote Version
              </button>

              <button
                className="btn btn-info"
                onClick={() => onResolve(conflict.fileId, 'merge')}
                disabled={isResolving}
              >
                Auto Merge
              </button>

              <button
                className="btn btn-primary"
                onClick={initializeMergeEditor}
                disabled={isResolving}
              >
                Manual Merge
              </button>
            </div>
          ) : (
            <div className="merge-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowMergeEditor(false)}
                disabled={isResolving}
              >
                Back to Diff
              </button>

              <button
                className="btn btn-success"
                onClick={handleManualResolve}
                disabled={isResolving || !mergedContent.trim()}
              >
                {isResolving ? 'Applying...' : 'Apply Merge'}
              </button>
            </div>
          )}

          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolver;