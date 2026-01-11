import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { VscCircleFilled, VscTrash, VscClose, VscWarning, VscTerminal } from 'react-icons/vsc';
import '@xterm/xterm/css/xterm.css';
import './Terminal.css';

const TerminalComponent = ({ 
  userId, 
  projectId, 
  language = 'bash',
  theme = 'dark',
  terminalId: externalTerminalId, // Terminal ID from MultiTerminal
  onConnectionChange,
  className = '',
  style = {},
  hideHeader = false,
  isVisible = true
}) => {
  const terminalRef = useRef(null);
  const terminalInstance = useRef(null);
  const websocketRef = useRef(null);
  const fitAddon = useRef(null);
  const currentTerminalIdRef = useRef(null);
  const previousLanguageRef = useRef(language);
  const [isConnected, setIsConnected] = useState(false);
  const [terminalId, setTerminalId] = useState(null);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');

  // Terminal theme configurations
  const terminalThemes = {
    dark: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      selection: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5'
    },
    light: {
      background: '#ffffff',
      foreground: '#333333',
      cursor: '#333333',
      selection: '#add6ff',
      black: '#000000',
      red: '#cd3131',
      green: '#00bc00',
      yellow: '#949800',
      blue: '#0451a5',
      magenta: '#bc05bc',
      cyan: '#0598bc',
      white: '#555555',
      brightBlack: '#666666',
      brightRed: '#cd3131',
      brightGreen: '#14ce14',
      brightYellow: '#b5ba00',
      brightBlue: '#0451a5',
      brightMagenta: '#bc05bc',
      brightCyan: '#0598bc',
      brightWhite: '#a5a5a5'
    }
  };

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current) return;

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Cascadia Code, Fira Code, Consolas, Courier New, monospace',
      theme: terminalThemes[theme] || terminalThemes.dark,
      cols: 80,
      rows: 24
    });

    // Add addons
    fitAddon.current = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    terminal.loadAddon(fitAddon.current);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);

    // Open terminal
    terminal.open(terminalRef.current);
    
    // Wait for terminal to be ready before fitting
    setTimeout(() => {
      if (fitAddon.current && terminalRef.current) {
        fitAddon.current.fit();
      }
    }, 100);

    terminalInstance.current = terminal;

    // Handle input - improved with better error handling
    terminal.onData(data => {
      try {
        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
          const currentTerminalId = currentTerminalIdRef.current;
          if (currentTerminalId) {
            websocketRef.current.send(JSON.stringify({
              type: 'input',
              terminalId: currentTerminalId,
              data: data
            }));
          } else {
            // Terminal not ready yet, but don't lose the input
            console.debug('Terminal not ready for input, buffering...');
          }
        } else {
          console.debug('WebSocket not ready for input');
        }
      } catch (error) {
        console.error('Error sending terminal input:', error);
      }
    });

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        const currentTerminalId = currentTerminalIdRef.current;
        if (currentTerminalId) {
          websocketRef.current.send(JSON.stringify({
            type: 'resize',
            terminalId: currentTerminalId,
            cols: cols,
            rows: rows
          }));
        }
      }
    });

    return () => {
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
        terminalInstance.current = null;
      }
    };
  }, []); // Remove terminalId dependency to prevent terminal recreation

  // Update terminal theme when theme prop changes
  useEffect(() => {
    if (terminalInstance.current) {
      const newTheme = terminalThemes[theme] || terminalThemes.dark;
      
      // Update theme by setting each property individually
      const terminal = terminalInstance.current;
      
      // Set each theme property
      Object.keys(newTheme).forEach(key => {
        terminal.options[key] = newTheme[key];
      });
      
      // Force a refresh by calling refresh
      terminal.refresh(0, terminal.rows - 1);
    }
  }, [theme]);

  // Re-fit terminal when it becomes visible
  useEffect(() => {
    if (isVisible && terminalInstance.current && fitAddon.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        try {
          if (fitAddon.current && terminalRef.current) {
            fitAddon.current.fit();
            // Refresh the terminal display
            terminalInstance.current.refresh(0, terminalInstance.current.rows - 1);
          }
        } catch (error) {
          console.debug('Terminal fit error:', error.message);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
    }

    setConnectionState('connecting');
    setError(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'development' ? 'localhost:3001' : window.location.host;
    const wsUrl = `${protocol}//${host}/terminal`;

    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;

    ws.onopen = () => {
      setError(null);

      // Use the terminalId from MultiTerminal if provided, otherwise generate one
      const sessionId = externalTerminalId || `${userId}-${projectId || 'default'}-${language}-${Date.now()}`;
      ws.send(JSON.stringify({
        type: 'create',
        userId: userId,
        projectId: projectId || null,
        language: language,
        sessionId: sessionId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = (event) => {
      // Common close codes:
      // 1000 = Normal closure
      // 1005 = No status received (normal for some browsers)
      // 1006 = Abnormal closure
      const isNormalClose = [1000, 1005, 1006].includes(event.code);
      
      if (!isNormalClose) {
        console.log('Terminal WebSocket disconnected:', event.code, event.reason);
      }
      
      setIsConnected(false);
      setTerminalId(null);
      currentTerminalIdRef.current = null;
      setConnectionState('disconnected');
      
      // Clear terminal ID from instance
      if (terminalInstance.current) {
        delete terminalInstance.current.terminalId;
      }
      
      if (onConnectionChange) {
        onConnectionChange(false);
      }

      // Don't auto-reconnect to prevent loops
      // User can manually reconnect if needed
    };

    ws.onerror = (error) => {
      // WebSocket errors are usually followed by onclose, so we don't need to log both
      // Only set error state, don't spam console
      setError('Connection failed - Make sure backend server is running on port 3001');
      setIsConnected(false);
    };
  }, [userId, projectId, language, externalTerminalId, onConnectionChange]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message) => {
    switch (message.type) {
      case 'created':
        setTerminalId(message.terminalId);
        currentTerminalIdRef.current = message.terminalId;
        setIsConnected(true);
        setConnectionState('connected');
        setError(null);
        
        // Store terminalId on the terminal instance and prepare terminal
        if (terminalInstance.current) {
          terminalInstance.current.terminalId = message.terminalId;
          terminalInstance.current.clear();
          
          // Auto-focus the terminal when it's ready
          setTimeout(() => {
            if (terminalInstance.current) {
              terminalInstance.current.focus();
            }
          }, 100);
        }
        
        if (onConnectionChange) {
          onConnectionChange(true);
        }
        break;

      case 'output':
        // Use ref for immediate comparison
        if (terminalInstance.current && message.terminalId === currentTerminalIdRef.current) {
          terminalInstance.current.write(message.data);
        } else if (message.terminalId !== currentTerminalIdRef.current) {
          console.warn('Received output for different terminal:', message.terminalId, 'current:', currentTerminalIdRef.current);
        }
        break;

      case 'destroyed':
        if (message.terminalId === currentTerminalIdRef.current) {
          setTerminalId(null);
          currentTerminalIdRef.current = null;
          setIsConnected(false);
          setConnectionState('disconnected');
          
          if (terminalInstance.current) {
            terminalInstance.current.write('\r\n\r\n💀 Terminal session ended\r\n');
            delete terminalInstance.current.terminalId;
          }
        }
        break;

      case 'disconnected':
        if (message.terminalId === currentTerminalIdRef.current) {
          setIsConnected(false);
          setConnectionState('disconnected');
          // Don't show reconnecting messages - terminal should stay connected
        }
        break;

      case 'error':
        // Only log real errors, not transient session end messages
        if (message.error === 'TERMINAL_NOT_FOUND') {
          console.error('Terminal error:', message.message);
        }
        
        // Handle terminal not found - don't auto-reconnect to prevent loops
        if (message.error === 'TERMINAL_NOT_FOUND') {
          setTerminalId(null);
          currentTerminalIdRef.current = null;
          setIsConnected(false);
          setConnectionState('error');
          
          if (terminalInstance.current) {
            terminalInstance.current.write('\r\n⚠️ Terminal session expired\r\n');
            terminalInstance.current.write('Please refresh or reconnect manually\r\n');
            delete terminalInstance.current.terminalId;
          }
        } else {
          setError(message.message);
          setConnectionState('error');
          
          if (terminalInstance.current) {
            terminalInstance.current.write(`\r\n❌ Error: ${message.message}\r\n`);
          }
        }
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }, [onConnectionChange]);

  // Connect on mount with delay - Only connect once
  useEffect(() => {
    let isMounted = true;
    
    if (userId) {
      // Add small delay to ensure backend is ready
      const timer = setTimeout(() => {
        if (isMounted) {
          connect();
        }
      }, 500);
      
      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (websocketRef.current) {
          websocketRef.current.close(1000, 'Component unmounting');
          websocketRef.current = null;
        }
      };
    }
  }, [userId, projectId, language]);

  // Focus terminal when clicked - improved focus handling
  const handleFocus = useCallback(() => {
    if (terminalInstance.current) {
      try {
        terminalInstance.current.focus();
        // Ensure terminal is visible and properly fitted
        if (fitAddon.current) {
          setTimeout(() => fitAddon.current.fit(), 10);
        }
      } catch (error) {
        console.error('Error focusing terminal:', error);
      }
    }
  }, []);

  // Handle window resize and keyboard shortcuts
  useEffect(() => {
    const handleResize = () => {
      if (fitAddon.current && terminalInstance.current) {
        fitAddon.current.fit();
      }
    };

    const handleKeydown = (event) => {
      // Ctrl+` to focus terminal (common VS Code shortcut)
      if (event.ctrlKey && event.key === '`') {
        event.preventDefault();
        handleFocus();
      }
    };

    const handleSendCommand = (event) => {
      const { command } = event.detail;
      if (command && websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        const currentTerminalId = currentTerminalIdRef.current;
        if (currentTerminalId) {
          // Send command with newline to execute it
          websocketRef.current.send(JSON.stringify({
            type: 'input',
            terminalId: currentTerminalId,
            data: command + '\n'
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeydown);
    document.addEventListener('send-terminal-command', handleSendCommand);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('send-terminal-command', handleSendCommand);
    };
  }, [handleFocus]);

  // Disconnect terminal
  const disconnect = useCallback(() => {
    const currentId = currentTerminalIdRef.current;
    if (websocketRef.current && currentId) {
      try {
        websocketRef.current.send(JSON.stringify({
          type: 'destroy',
          terminalId: currentId
        }));
      } catch (error) {
        console.error('Error sending destroy message:', error);
      }
    }
    
    // Close WebSocket connection
    if (websocketRef.current) {
      try {
        websocketRef.current.close(1000, 'User disconnected');
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      websocketRef.current = null;
    }
    
    // Clear state immediately
    setTerminalId(null);
    currentTerminalIdRef.current = null;
    setIsConnected(false);
    setConnectionState('disconnected');
  }, []);

  // Clear terminal
  const clear = useCallback(() => {
    if (terminalInstance.current) {
      terminalInstance.current.clear();
    }
  }, []);

  // Note: Auto-switching disabled - using universal container with all languages
  // useEffect(() => {
  //   if (language !== previousLanguageRef.current) {
  //     console.log('🔄 Auto-switching terminal language from', previousLanguageRef.current, 'to', language);
  //     previousLanguageRef.current = language;
  //     
  //     // Disconnect and reconnect with new language
  //     if (isConnected) {
  //       disconnect();
  //       // Wait longer for cleanup before reconnecting (1.5 seconds)
  //       setTimeout(() => {
  //         console.log('🔌 Reconnecting with new language:', language);
  //         connect();
  //       }, 1500);
  //     } else {
  //       // If not connected, just connect with new language
  //       connect();
  //     }
  //   }
  // }, [language, isConnected, disconnect, connect]);

  return (
    <div 
      className={`terminal-container ${className}`} 
      style={style}
      onClick={handleFocus}
    >
      {error && (
        <div className="terminal-error">
          <span className="error-icon"><VscWarning /></span>
          <span className="error-message">{error}</span>
          <button 
            className="retry-button"
            onClick={connect}
          >
            Retry
          </button>
        </div>
      )}
      
      {!hideHeader && (
        <div className="terminal-header">
          <div className="terminal-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              <VscCircleFilled 
                style={{ 
                  color: connectionState === 'connected' ? '#238636' : 
                         connectionState === 'connecting' || connectionState === 'reconnecting' ? '#d29922' : '#f85149'
                }} 
              />
            </span>
            <span className="status-text">
              {connectionState === 'connected' ? (
                <>
                  <VscTerminal style={{ marginRight: '6px' }} />
                  Connected - Universal Dev Environment (Python • Node.js • Java • C++)
                </>
              ) : 
               connectionState === 'connecting' ? 'Connecting...' :
               connectionState === 'reconnecting' ? 'Reconnecting...' :
               connectionState === 'error' ? 'Error' : 'Disconnected'}
              {terminalId && connectionState === 'connected' && ` - ID: ${terminalId.slice(-8)}`}
            </span>
          </div>
          
          <div className="terminal-controls">
            <button 
              className="control-button"
              onClick={clear}
              title="Clear terminal"
            >
              <VscTrash />
            </button>
            <button 
              className="control-button"
              onClick={disconnect}
              title="Disconnect"
              disabled={!isConnected}
            >
              <VscClose />
            </button>
          </div>
        </div>
      )}
      
      <div 
        ref={terminalRef} 
        className="terminal-content"
        style={{ height: 'calc(100% - 40px)' }}
      />
    </div>
  );
};

export default TerminalComponent;