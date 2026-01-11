import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import './CodeExecution.css';

const CodeExecution = ({ 
  code, 
  language, 
  projectId, 
  files = [],
  onExecutionStart,
  onExecutionComplete,
  onOutputUpdate,
  className = '',
  style = {}
}) => {
  const { user } = useAuth();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionId, setExecutionId] = useState(null);
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [executionTime, setExecutionTime] = useState(null);
  const pollInterval = useRef(null);
  const [executionHistory, setExecutionHistory] = useState([]);

  // Execute code
  const executeCode = useCallback(async () => {
    if (!code?.trim()) {
      setError('No code to execute');
      return;
    }

    if (!user) {
      setError('Authentication required');
      return;
    }

    try {
      setIsExecuting(true);
      setError(null);
      setOutput('');
      setExecutionTime(null);

      if (onExecutionStart) {
        onExecutionStart();
      }

      // Special handling for HTML files
      if (language === 'html' || language === 'htm') {
        setIsExecuting(false);
        setOutput('Opening HTML file in new tab...');
        
        // Create a blob URL from the HTML content
        const blob = new Blob([code], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        
        // Clean up blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        if (onExecutionComplete) {
          onExecutionComplete({ 
            output: '✅ HTML opened in new browser tab',
            status: 'completed'
          });
        }
        return;
      }

      // Special handling for JSX/TSX files
      if (language === 'jsx' || language === 'tsx' || language === 'javascriptreact' || language === 'typescriptreact') {
        setIsExecuting(false);
        setError('⚠️ JSX/React files cannot be executed directly. They need to be part of a React application with a build system (Webpack, Vite, etc.).\n\nTry:\n1. Create a React project\n2. Use the terminal to run: npx create-react-app my-app\n3. Add your component to the project\n4. Run: npm start');
        
        if (onExecutionComplete) {
          onExecutionComplete({ 
            error: 'JSX requires React environment',
            status: 'failed'
          });
        }
        return;
      }

      // Start execution
      const response = await fetch('/api/v1/execution/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          code,
          language,
          projectId,
          files,
          timeout: 30000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Execution failed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Execution failed');
      }

      setExecutionId(result.executionId);

      // Start polling for results
      startPolling(result.executionId);

    } catch (err) {
      console.error('Execution error:', err);
      setError(err.message);
      setIsExecuting(false);
      
      if (onExecutionComplete) {
        onExecutionComplete({ error: err.message });
      }
    }
  }, [code, language, projectId, files, user, onExecutionStart, onExecutionComplete]);

  // Poll for execution status
  const startPolling = useCallback((execId) => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }

    const startTime = Date.now();

    pollInterval.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/execution/${execId}/status`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to get execution status');
        }

        const result = await response.json();
        
        if (result.success) {
          // Update output if changed
          if (result.output !== output) {
            setOutput(result.output || '');
            
            if (onOutputUpdate) {
              onOutputUpdate(result.output || '');
            }
          }

          // Update error if present
          if (result.error) {
            setError(result.error);
          }

          // Check if execution is complete
          if (['completed', 'failed', 'timeout', 'terminated'].includes(result.status)) {
            clearInterval(pollInterval.current);
            setIsExecuting(false);
            
            const endTime = Date.now();
            const duration = result.duration || (endTime - startTime);
            setExecutionTime(duration);

            // Add to history
            const historyEntry = {
              id: execId,
              language,
              status: result.status,
              output: result.output || '',
              error: result.error,
              duration,
              timestamp: new Date(result.createdAt)
            };

            setExecutionHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10

            if (onExecutionComplete) {
              onExecutionComplete({
                status: result.status,
                output: result.output || '',
                error: result.error,
                duration
              });
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(pollInterval.current);
        setIsExecuting(false);
        setError('Failed to get execution status');
        
        if (onExecutionComplete) {
          onExecutionComplete({ error: 'Failed to get execution status' });
        }
      }
    }, 1000); // Poll every second
  }, [output, onOutputUpdate, onExecutionComplete, language]);

  // Terminate execution
  const terminateExecution = useCallback(async () => {
    if (!executionId) return;

    try {
      const response = await fetch(`/api/v1/execution/${executionId}/terminate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        clearInterval(pollInterval.current);
        setIsExecuting(false);
        setError('Execution terminated by user');
        
        if (onExecutionComplete) {
          onExecutionComplete({ status: 'terminated', error: 'Execution terminated by user' });
        }
      }
    } catch (err) {
      console.error('Termination error:', err);
    }
  }, [executionId, onExecutionComplete]);

  // Clear output
  const clearOutput = useCallback(() => {
    setOutput('');
    setError(null);
    setExecutionTime(null);
  }, []);

  // Format duration
  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'failed': return '#F44336';
      case 'timeout': return '#FF9800';
      case 'terminated': return '#9E9E9E';
      default: return '#2196F3';
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);

  return (
    <div className={`code-execution ${className}`} style={style}>
      <div className="execution-controls">
        <button
          className={`run-button ${isExecuting ? 'executing' : ''}`}
          onClick={executeCode}
          disabled={isExecuting || !code?.trim()}
          title="Run code"
        >
          {isExecuting ? (
            <>
              <span className="spinner">⟳</span>
              Running...
            </>
          ) : (
            <>
              <span className="play-icon">▶️</span>
              Run Code
            </>
          )}
        </button>

        {isExecuting && (
          <button
            className="stop-button"
            onClick={terminateExecution}
            title="Stop execution"
          >
            <span className="stop-icon">⏹️</span>
            Stop
          </button>
        )}

        <button
          className="clear-button"
          onClick={clearOutput}
          disabled={!output && !error}
          title="Clear output"
        >
          <span className="clear-icon">🗑️</span>
          Clear
        </button>

        {executionTime && (
          <div className="execution-time">
            <span className="time-icon">⏱️</span>
            {formatDuration(executionTime)}
          </div>
        )}
      </div>

      <div className="execution-output">
        {isExecuting && (
          <div className="execution-status">
            <div className="status-line">
              <span className="status-icon">🚀</span>
              <span className="status-text">Executing {language} code...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="execution-error">
            <div className="error-header">
              <span className="error-icon">❌</span>
              <span className="error-title">Execution Error</span>
            </div>
            <pre className="error-content">{error}</pre>
          </div>
        )}

        {output && (
          <div className="execution-result">
            <div className="result-header">
              <span className="result-icon">📄</span>
              <span className="result-title">Output</span>
            </div>
            {language === 'html' || language === 'htm' ? (
              <div className="result-content html-output">
                {output}
              </div>
            ) : (
              <pre className="result-content">{output}</pre>
            )}
          </div>
        )}

        {!isExecuting && !output && !error && (
          <div className="execution-placeholder">
            <div className="placeholder-content">
              <span className="placeholder-icon">💻</span>
              <span className="placeholder-text">Click "Run Code" to execute your {language} code</span>
            </div>
          </div>
        )}
      </div>

      {executionHistory.length > 0 && (
        <div className="execution-history">
          <div className="history-header">
            <span className="history-icon">📚</span>
            <span className="history-title">Recent Executions</span>
          </div>
          <div className="history-list">
            {executionHistory.map((entry) => (
              <div key={entry.id} className="history-entry">
                <div className="entry-header">
                  <span className="entry-language">{entry.language}</span>
                  <span 
                    className="entry-status"
                    style={{ color: getStatusColor(entry.status) }}
                  >
                    {entry.status}
                  </span>
                  <span className="entry-time">
                    {formatDuration(entry.duration)}
                  </span>
                </div>
                {entry.error ? (
                  <div className="entry-error">{entry.error}</div>
                ) : (
                  <div className="entry-output">
                    {entry.output.substring(0, 100)}
                    {entry.output.length > 100 && '...'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeExecution;