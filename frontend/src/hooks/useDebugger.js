import { useState, useEffect, useCallback } from 'react';

/**
 * React Hook for Debug State Management
 * 
 * @param {Object} options - Hook options
 * @param {string} options.language - Programming language being debugged
 * @param {Function} options.onDebugEvent - Callback for debug events
 * @returns {Object} Debug state and controls
 */
export const useDebugger = (options = {}) => {
  const {
    language = 'javascript',
    onDebugEvent
  } = options;

  const [isDebugging, setIsDebugging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [breakpoints, setBreakpoints] = useState([]);
  const [variables, setVariables] = useState([]);
  const [callStack, setCallStack] = useState([]);
  const [currentLine, setCurrentLine] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);

  // Add breakpoint
  const addBreakpoint = useCallback((file, line, condition = null) => {
    const id = `${file}:${line}`;
    const existingBp = breakpoints.find(bp => bp.id === id);
    
    if (existingBp) {
      console.warn('Breakpoint already exists at this location');
      return;
    }

    const newBreakpoint = {
      id,
      file,
      line,
      condition,
      enabled: true
    };

    setBreakpoints(prev => [...prev, newBreakpoint]);

    if (onDebugEvent) {
      onDebugEvent({ type: 'breakpoint-added', breakpoint: newBreakpoint });
    }
  }, [breakpoints, onDebugEvent]);

  // Remove breakpoint
  const removeBreakpoint = useCallback((id) => {
    setBreakpoints(prev => prev.filter(bp => bp.id !== id));

    if (onDebugEvent) {
      onDebugEvent({ type: 'breakpoint-removed', id });
    }
  }, [onDebugEvent]);

  // Toggle breakpoint
  const toggleBreakpoint = useCallback((id) => {
    setBreakpoints(prev => prev.map(bp => 
      bp.id === id ? { ...bp, enabled: !bp.enabled } : bp
    ));

    if (onDebugEvent) {
      onDebugEvent({ type: 'breakpoint-toggled', id });
    }
  }, [onDebugEvent]);

  // Start debugging
  const startDebugging = useCallback(() => {
    setIsDebugging(true);
    setIsPaused(false);

    if (onDebugEvent) {
      onDebugEvent({ type: 'debug-start' });
    }
  }, [onDebugEvent]);

  // Stop debugging
  const stopDebugging = useCallback(() => {
    setIsDebugging(false);
    setIsPaused(false);
    setVariables([]);
    setCallStack([]);
    setCurrentLine(null);
    setCurrentFile(null);

    if (onDebugEvent) {
      onDebugEvent({ type: 'debug-stop' });
    }
  }, [onDebugEvent]);

  // Pause execution
  const pause = useCallback(() => {
    setIsPaused(true);

    if (onDebugEvent) {
      onDebugEvent({ type: 'debug-pause' });
    }
  }, [onDebugEvent]);

  // Continue execution
  const continueExecution = useCallback(() => {
    if (!isDebugging) {
      startDebugging();
    } else {
      setIsPaused(false);

      if (onDebugEvent) {
        onDebugEvent({ type: 'debug-continue' });
      }
    }
  }, [isDebugging, startDebugging, onDebugEvent]);

  // Step over
  const stepOver = useCallback(() => {
    if (onDebugEvent) {
      onDebugEvent({ type: 'debug-step-over' });
    }
  }, [onDebugEvent]);

  // Step into
  const stepInto = useCallback(() => {
    if (onDebugEvent) {
      onDebugEvent({ type: 'debug-step-into' });
    }
  }, [onDebugEvent]);

  // Step out
  const stepOut = useCallback(() => {
    if (onDebugEvent) {
      onDebugEvent({ type: 'debug-step-out' });
    }
  }, [onDebugEvent]);

  // Update debug state (called by external debugger)
  const updateDebugState = useCallback((state) => {
    if (state.variables !== undefined) setVariables(state.variables);
    if (state.callStack !== undefined) setCallStack(state.callStack);
    if (state.currentLine !== undefined) setCurrentLine(state.currentLine);
    if (state.currentFile !== undefined) setCurrentFile(state.currentFile);
    if (state.isPaused !== undefined) setIsPaused(state.isPaused);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isDebugging) return;

      // F5 - Continue
      if (e.key === 'F5') {
        e.preventDefault();
        continueExecution();
      }
      // F9 - Toggle breakpoint (would need current file/line context)
      // F10 - Step over
      else if (e.key === 'F10') {
        e.preventDefault();
        stepOver();
      }
      // F11 - Step into
      else if (e.key === 'F11') {
        e.preventDefault();
        stepInto();
      }
      // Shift+F11 - Step out
      else if (e.key === 'F11' && e.shiftKey) {
        e.preventDefault();
        stepOut();
      }
      // Shift+F5 - Stop debugging
      else if (e.key === 'F5' && e.shiftKey) {
        e.preventDefault();
        stopDebugging();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDebugging, continueExecution, stepOver, stepInto, stepOut, stopDebugging]);

  return {
    // State
    isDebugging,
    isPaused,
    breakpoints,
    variables,
    callStack,
    currentLine,
    currentFile,
    language,

    // Actions
    addBreakpoint,
    removeBreakpoint,
    toggleBreakpoint,
    startDebugging,
    stopDebugging,
    pause,
    continueExecution,
    stepOver,
    stepInto,
    stepOut,
    updateDebugState
  };
};

export default useDebugger;
