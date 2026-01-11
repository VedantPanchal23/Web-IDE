import React, { useState, useEffect, useCallback } from 'react';
import './DebugPanel.css';

/**
 * Debug Panel Component
 * Provides debugging interface with breakpoints, variables, and call stack
 */
const DebugPanel = ({ 
  onBreakpointToggle, 
  onStepOver, 
  onStepInto, 
  onStepOut, 
  onContinue,
  onPause,
  onStop,
  debugState = {}
}) => {
  const {
    isDebugging = false,
    isPaused = false,
    breakpoints = [],
    variables = [],
    callStack = [],
    currentLine = null,
    currentFile = null
  } = debugState;

  const [selectedTab, setSelectedTab] = useState('breakpoints');
  const [watchExpressions, setWatchExpressions] = useState([]);
  const [newWatchExpr, setNewWatchExpr] = useState('');

  const addWatchExpression = () => {
    if (newWatchExpr.trim()) {
      setWatchExpressions([...watchExpressions, { expr: newWatchExpr, value: null }]);
      setNewWatchExpr('');
    }
  };

  const removeWatchExpression = (index) => {
    setWatchExpressions(watchExpressions.filter((_, i) => i !== index));
  };

  const formatValue = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getVariableType = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h3>🐛 Debugger</h3>
        <div className="debug-status">
          {isDebugging ? (
            <span className="status-badge debugging">
              {isPaused ? '⏸️ Paused' : '▶️ Running'}
            </span>
          ) : (
            <span className="status-badge stopped">⏹️ Stopped</span>
          )}
        </div>
      </div>

      <div className="debug-controls">
        {!isDebugging ? (
          <button className="debug-btn start" onClick={onContinue}>
            ▶️ Start Debugging
          </button>
        ) : (
          <>
            {isPaused ? (
              <>
                <button className="debug-btn continue" onClick={onContinue} title="Continue (F5)">
                  ▶️
                </button>
                <button className="debug-btn step-over" onClick={onStepOver} title="Step Over (F10)">
                  ⤵️
                </button>
                <button className="debug-btn step-into" onClick={onStepInto} title="Step Into (F11)">
                  ⬇️
                </button>
                <button className="debug-btn step-out" onClick={onStepOut} title="Step Out (Shift+F11)">
                  ⬆️
                </button>
              </>
            ) : (
              <button className="debug-btn pause" onClick={onPause} title="Pause">
                ⏸️
              </button>
            )}
            <button className="debug-btn stop" onClick={onStop} title="Stop Debugging">
              ⏹️
            </button>
          </>
        )}
      </div>

      {currentFile && currentLine !== null && (
        <div className="debug-location">
          <div className="location-label">Current Location:</div>
          <div className="location-file">{currentFile}</div>
          <div className="location-line">Line {currentLine}</div>
        </div>
      )}

      <div className="debug-tabs">
        <button
          className={`debug-tab ${selectedTab === 'breakpoints' ? 'active' : ''}`}
          onClick={() => setSelectedTab('breakpoints')}
        >
          🔴 Breakpoints ({breakpoints.length})
        </button>
        <button
          className={`debug-tab ${selectedTab === 'variables' ? 'active' : ''}`}
          onClick={() => setSelectedTab('variables')}
        >
          📊 Variables ({variables.length})
        </button>
        <button
          className={`debug-tab ${selectedTab === 'callstack' ? 'active' : ''}`}
          onClick={() => setSelectedTab('callstack')}
        >
          📚 Call Stack ({callStack.length})
        </button>
        <button
          className={`debug-tab ${selectedTab === 'watch' ? 'active' : ''}`}
          onClick={() => setSelectedTab('watch')}
        >
          👁️ Watch ({watchExpressions.length})
        </button>
      </div>

      <div className="debug-content">
        {selectedTab === 'breakpoints' && (
          <div className="breakpoints-panel">
            {breakpoints.length === 0 ? (
              <div className="empty-state">
                <p>No breakpoints set</p>
                <p className="hint">Click in the editor gutter to add breakpoints</p>
              </div>
            ) : (
              <div className="breakpoints-list">
                {breakpoints.map((bp, index) => (
                  <div key={index} className={`breakpoint-item ${bp.enabled ? 'enabled' : 'disabled'}`}>
                    <button
                      className="bp-toggle"
                      onClick={() => onBreakpointToggle && onBreakpointToggle(bp.id)}
                    >
                      {bp.enabled ? '🔴' : '⚪'}
                    </button>
                    <div className="bp-info">
                      <div className="bp-file">{bp.file}</div>
                      <div className="bp-line">Line {bp.line}</div>
                      {bp.condition && (
                        <div className="bp-condition">if: {bp.condition}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'variables' && (
          <div className="variables-panel">
            {variables.length === 0 ? (
              <div className="empty-state">
                <p>No variables in current scope</p>
                <p className="hint">Start debugging to see variables</p>
              </div>
            ) : (
              <div className="variables-list">
                {variables.map((variable, index) => (
                  <div key={index} className="variable-item">
                    <div className="variable-name">
                      <span className="var-icon">{getVariableType(variable.value) === 'object' ? '📦' : '📌'}</span>
                      {variable.name}
                    </div>
                    <div className="variable-type">{getVariableType(variable.value)}</div>
                    <div className="variable-value">
                      <pre>{formatValue(variable.value)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'callstack' && (
          <div className="callstack-panel">
            {callStack.length === 0 ? (
              <div className="empty-state">
                <p>No call stack available</p>
                <p className="hint">Pause execution to see call stack</p>
              </div>
            ) : (
              <div className="callstack-list">
                {callStack.map((frame, index) => (
                  <div key={index} className={`callstack-item ${index === 0 ? 'current' : ''}`}>
                    <div className="frame-index">{index + 1}</div>
                    <div className="frame-info">
                      <div className="frame-function">{frame.function || '(anonymous)'}</div>
                      <div className="frame-location">
                        {frame.file}:{frame.line}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'watch' && (
          <div className="watch-panel">
            <div className="watch-add">
              <input
                type="text"
                className="watch-input"
                placeholder="Add expression to watch..."
                value={newWatchExpr}
                onChange={(e) => setNewWatchExpr(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addWatchExpression()}
              />
              <button className="watch-btn-add" onClick={addWatchExpression}>
                +
              </button>
            </div>
            <div className="watch-list">
              {watchExpressions.length === 0 ? (
                <div className="empty-state">
                  <p>No watch expressions</p>
                  <p className="hint">Add expressions to monitor their values</p>
                </div>
              ) : (
                watchExpressions.map((watch, index) => (
                  <div key={index} className="watch-item">
                    <button
                      className="watch-remove"
                      onClick={() => removeWatchExpression(index)}
                    >
                      ×
                    </button>
                    <div className="watch-expr">{watch.expr}</div>
                    <div className="watch-value">
                      {watch.value !== null ? formatValue(watch.value) : '(not evaluated)'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugPanel;
