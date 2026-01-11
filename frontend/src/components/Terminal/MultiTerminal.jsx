import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import './MultiTerminal.css';

/**
 * Multi-Terminal Manager Component
 * Displays and manages multiple terminal sessions
 */
const MultiTerminal = ({ projectId, onTerminalSelect, activeTerminalId }) => {
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [containerInfo, setContainerInfo] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchTerminals();
      // Refresh every 5 seconds
      const interval = setInterval(fetchTerminals, 5000);
      return () => clearInterval(interval);
    }
  }, [projectId]);

  const fetchTerminals = async () => {
    try {
      const response = await apiService.get('/sync/terminals');
      
      if (response.success) {
        const projectTerminals = response.terminals.filter(
          t => t.projectId === projectId
        );
        setTerminals(projectTerminals);
        
        // Extract container info from first terminal
        if (projectTerminals.length > 0) {
          setContainerInfo({
            shared: projectTerminals.length > 1,
            count: projectTerminals.length,
            containerId: projectTerminals[0].containerId
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch terminals:', error);
    }
  };

  const createNewTerminal = async (language = 'bash') => {
    try {
      setLoading(true);
      // This will trigger terminal creation through WebSocket in parent component
      if (onTerminalSelect) {
        onTerminalSelect({ newTerminal: true, language });
      }
    } catch (error) {
      console.error('Failed to create terminal:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getLanguageIcon = (language) => {
    switch (language?.toLowerCase()) {
      case 'python':
        return '🐍';
      case 'javascript':
      case 'node':
        return '📦';
      case 'java':
        return '☕';
      case 'cpp':
      case 'c++':
        return '⚡';
      case 'bash':
      default:
        return '💻';
    }
  };

  return (
    <div className="multi-terminal">
      <div className="multi-terminal-header">
        <div className="header-info">
          <h4>Terminal Sessions</h4>
          {containerInfo && containerInfo.shared && (
            <span className="shared-indicator" title="All terminals share the same container">
              🔗 Shared Container ({containerInfo.count} sessions)
            </span>
          )}
        </div>
        <div className="header-actions">
          <button 
            className="new-terminal-btn"
            onClick={() => createNewTerminal('bash')}
            disabled={loading}
          >
            {loading ? '⏳' : '+'} New Terminal
          </button>
        </div>
      </div>

      <div className="terminals-list">
        {terminals.length === 0 ? (
          <div className="no-terminals">
            <p>No active terminals</p>
            <button onClick={() => createNewTerminal('bash')}>
              Create First Terminal
            </button>
          </div>
        ) : (
          terminals.map((terminal) => (
            <div
              key={terminal.id}
              className={`terminal-item ${activeTerminalId === terminal.id ? 'active' : ''} ${terminal.isActive ? 'running' : 'inactive'}`}
              onClick={() => onTerminalSelect && onTerminalSelect(terminal)}
            >
              <div className="terminal-icon">
                {getLanguageIcon(terminal.language)}
              </div>
              <div className="terminal-info">
                <div className="terminal-language">{terminal.language}</div>
                <div className="terminal-meta">
                  <span className="terminal-id" title={terminal.id}>
                    #{terminal.id.slice(0, 8)}
                  </span>
                  {terminal.lastActivity && (
                    <span className="terminal-time">
                      {formatTimestamp(terminal.lastActivity)}
                    </span>
                  )}
                </div>
              </div>
              <div className="terminal-status">
                {terminal.isActive ? (
                  <span className="status-badge active">●</span>
                ) : (
                  <span className="status-badge inactive">○</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {containerInfo && (
        <div className="container-info">
          <div className="info-label">Container:</div>
          <div className="info-value" title={containerInfo.containerId}>
            {containerInfo.containerId?.slice(0, 12) || 'N/A'}
          </div>
          <div className="info-note">
            All terminals share this container and file system
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiTerminal;
