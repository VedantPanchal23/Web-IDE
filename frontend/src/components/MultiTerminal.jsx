import React, { useState, useEffect } from 'react';
import { VscAdd, VscChevronDown, VscTrash, VscTerminalBash, VscTerminalPowershell, VscCode, VscCircleFilled } from 'react-icons/vsc';
import { SiPython, SiJavascript, SiCplusplus, SiC } from 'react-icons/si';
import Terminal from './Terminal';
import './MultiTerminal.css';

/**
 * MultiTerminal - GitHub Codespaces style multiple terminal support
 * Features:
 * - Multiple terminal tabs
 * - Terminal switching
 * - Named terminals
 * - Kill individual terminals
 * - Keyboard shortcuts (Ctrl+Shift+` for new terminal)
 */
const MultiTerminal = ({ userId, projectId, theme = 'dark', isVisible = true }) => {
  const [terminals, setTerminals] = useState([]);
  const [activeTerminalId, setActiveTerminalId] = useState(null);
  const nextTerminalNumberRef = React.useRef(1);
  const initializedRef = React.useRef(false);

  // Define all functions first
  const createNewTerminal = React.useCallback((language = 'bash') => {
    const newTerminal = {
      id: `terminal-${Date.now()}-${Math.random()}`,
      name: `Terminal ${nextTerminalNumberRef.current}`,
      language: language,
      createdAt: new Date(),
      isConnected: false
    };

    setTerminals(prev => [...prev, newTerminal]);
    setActiveTerminalId(newTerminal.id);
    nextTerminalNumberRef.current += 1;
  }, []);

  const killTerminal = React.useCallback((terminalId) => {
    setTerminals(prev => {
      const updated = prev.filter(t => t.id !== terminalId);
      
      // If killing active terminal, switch to another
      if (terminalId === activeTerminalId && updated.length > 0) {
        setActiveTerminalId(updated[updated.length - 1].id);
      } else if (updated.length === 0) {
        // Clear active terminal if all killed
        setActiveTerminalId(null);
      }
      
      return updated;
    });
  }, [activeTerminalId]);

  const killActiveTerminal = React.useCallback(() => {
    if (activeTerminalId) {
      killTerminal(activeTerminalId);
    }
  }, [activeTerminalId, killTerminal]);

  const clearActiveTerminal = React.useCallback(() => {
    // Clear terminal by sending Ctrl+L
    document.dispatchEvent(new CustomEvent('clear-terminal-output', {
      detail: { terminalId: activeTerminalId }
    }));
  }, [activeTerminalId]);

  const sendCommandToActiveTerminal = React.useCallback((command) => {
    if (activeTerminalId) {
      // Send command to the active terminal
      document.dispatchEvent(new CustomEvent('send-terminal-command', {
        detail: { terminalId: activeTerminalId, command }
      }));
    }
  }, [activeTerminalId]);

  const renameTerminal = React.useCallback((terminalId, newName) => {
    setTerminals(prev =>
      prev.map(t => t.id === terminalId ? { ...t, name: newName } : t)
    );
  }, []);

  const switchToNextTerminal = React.useCallback(() => {
    const currentIndex = terminals.findIndex(t => t.id === activeTerminalId);
    if (currentIndex < terminals.length - 1) {
      setActiveTerminalId(terminals[currentIndex + 1].id);
    }
  }, [terminals, activeTerminalId]);

  const switchToPreviousTerminal = React.useCallback(() => {
    const currentIndex = terminals.findIndex(t => t.id === activeTerminalId);
    if (currentIndex > 0) {
      setActiveTerminalId(terminals[currentIndex - 1].id);
    }
  }, [terminals, activeTerminalId]);

  // Create initial terminal only once on mount
  useEffect(() => {
    if (!initializedRef.current && terminals.length === 0) {
      initializedRef.current = true;
      createNewTerminal();
    }
  }, [createNewTerminal, terminals.length]);

  // Listen for new terminal events from command palette and run commands
  useEffect(() => {
    const handleNewTerminal = () => createNewTerminal();
    const handleKillTerminal = () => killActiveTerminal();
    const handleClearTerminal = () => clearActiveTerminal();
    const handleRunInTerminal = (e) => {
      const { command } = e.detail;
      sendCommandToActiveTerminal(command);
    };

    document.addEventListener('new-terminal', handleNewTerminal);
    document.addEventListener('kill-terminal', handleKillTerminal);
    document.addEventListener('clear-terminal', handleClearTerminal);
    document.addEventListener('run-in-terminal', handleRunInTerminal);

    return () => {
      document.removeEventListener('new-terminal', handleNewTerminal);
      document.removeEventListener('kill-terminal', handleKillTerminal);
      document.removeEventListener('clear-terminal', handleClearTerminal);
      document.removeEventListener('run-in-terminal', handleRunInTerminal);
    };
  }, [createNewTerminal, killActiveTerminal, clearActiveTerminal, sendCommandToActiveTerminal]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e) => {
      // Ctrl+Shift+` - New terminal
      if (e.ctrlKey && e.shiftKey && e.key === '`') {
        e.preventDefault();
        createNewTerminal();
      }
      // Ctrl+Shift+K - Kill terminal
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        killActiveTerminal();
      }
      // Ctrl+PageDown - Next terminal
      if (e.ctrlKey && e.key === 'PageDown') {
        e.preventDefault();
        switchToNextTerminal();
      }
      // Ctrl+PageUp - Previous terminal
      if (e.ctrlKey && e.key === 'PageUp') {
        e.preventDefault();
        switchToPreviousTerminal();
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [createNewTerminal, killActiveTerminal, switchToNextTerminal, switchToPreviousTerminal]);

  const getLanguageIcon = (language) => {
    const iconMap = {
      'bash': <VscTerminalBash style={{ color: '#4eaa25' }} />,
      'python': <SiPython style={{ color: '#3776ab' }} />,
      'javascript': <SiJavascript style={{ color: '#f7df1e' }} />,
      'node': <SiJavascript style={{ color: '#68a063' }} />,
      'java': <VscCode style={{ color: '#ed8b00' }} />,
      'cpp': <SiCplusplus style={{ color: '#00599c' }} />,
      'c': <SiC style={{ color: '#a8b9cc' }} />
    };
    return iconMap[language] || <VscTerminalBash />;
  };

  if (!isVisible) return null;

  return (
    <div className="multi-terminal-container">
      {/* Terminal Tabs */}
      <div className="terminal-tabs">
        <div className="terminal-tabs-list">
          {terminals.map(terminal => (
            <div
              key={terminal.id}
              className={`terminal-tab ${terminal.id === activeTerminalId ? 'active' : ''}`}
              onClick={() => setActiveTerminalId(terminal.id)}
            >
              <span className="terminal-tab-status">
                <VscCircleFilled 
                  style={{ 
                    color: terminal.isConnected ? '#238636' : '#858585',
                    fontSize: '10px'
                  }} 
                />
              </span>
              <span className="terminal-tab-icon">
                {getLanguageIcon(terminal.language)}
              </span>
              <span
                className="terminal-tab-name"
                onDoubleClick={() => {
                  const newName = prompt('Rename terminal:', terminal.name);
                  if (newName) renameTerminal(terminal.id, newName);
                }}
                title="Double-click to rename"
              >
                {terminal.name}
              </span>
              <button
                className="terminal-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  killTerminal(terminal.id);
                }}
                title="Kill Terminal (Ctrl+Shift+K)"
              >
                <VscTrash />
              </button>
            </div>
          ))}
        </div>

        <div className="terminal-actions">
          <button
            className="terminal-action-btn"
            onClick={() => createNewTerminal()}
            title="New Terminal (Ctrl+Shift+`)"
          >
            <VscAdd />
          </button>
          <button
            className="terminal-action-btn"
            onClick={() => killActiveTerminal()}
            title="Kill Active Terminal (Ctrl+Shift+K)"
          >
            <VscTrash />
          </button>
        </div>
      </div>

      {/* Terminal Panels */}
      <div className="terminal-panels">
        {terminals.length === 0 ? (
          <div className="terminal-empty-state">
            <VscTerminalBash size={48} style={{ color: '#858585', marginBottom: '16px' }} />
            <p style={{ color: '#cccccc', fontSize: '14px', marginBottom: '8px' }}>No terminal sessions</p>
            <p style={{ color: '#858585', fontSize: '12px', marginBottom: '16px' }}>
              Click the + button to create a new terminal
            </p>
            <button
              className="terminal-action-btn"
              onClick={() => createNewTerminal()}
              style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}
            >
              <VscAdd style={{ marginRight: '6px' }} />
              New Terminal
            </button>
          </div>
        ) : (
          terminals.map(terminal => (
            <div
              key={terminal.id}
              className={`terminal-panel ${terminal.id === activeTerminalId ? 'active' : 'hidden'}`}
              style={{ 
                display: terminal.id === activeTerminalId ? 'flex' : 'none',
                width: '100%',
                height: '100%',
                position: terminal.id === activeTerminalId ? 'relative' : 'absolute',
                visibility: terminal.id === activeTerminalId ? 'visible' : 'hidden'
              }}
            >
              <Terminal
                key={terminal.id}
                userId={userId}
                projectId={projectId}
                language={terminal.language}
                terminalId={terminal.id}
                theme={theme}
                hideHeader={true}
                isVisible={terminal.id === activeTerminalId}
                onConnectionChange={(isConnected) => {
                  setTerminals(prev =>
                    prev.map(t =>
                      t.id === terminal.id ? { ...t, isConnected } : t
                    )
                  );
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MultiTerminal;
