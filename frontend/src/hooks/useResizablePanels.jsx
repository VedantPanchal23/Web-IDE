import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ResizablePanels.css';

/**
 * Resizable Panels Hook
 * Provides drag-to-resize functionality for IDE panels
 */
export const useResizablePanel = (initialSize, minSize, maxSize, storageKey) => {
  const [size, setSize] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return parseInt(saved, 10);
    }
    return initialSize;
  });

  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      if (resizeRef.current) {
        const rect = resizeRef.current.getBoundingClientRect();
        const newSize = resizeRef.current.dataset.orientation === 'horizontal' 
          ? e.clientX - rect.left
          : rect.bottom - e.clientY;
        
        const clampedSize = Math.max(minSize, Math.min(maxSize, newSize));
        setSize(clampedSize);
        
        if (storageKey) {
          localStorage.setItem(storageKey, clampedSize.toString());
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minSize, maxSize, storageKey]);

  return {
    size,
    setSize,
    isResizing,
    handleMouseDown,
    resizeRef
  };
};

/**
 * Resizable Sidebar Component
 */
export const ResizableSidebar = ({ children, isVisible, onToggle }) => {
  const { size, isResizing, handleMouseDown, resizeRef } = useResizablePanel(
    260, // initial
    200, // min
    600, // max
    'ide-sidebar-width'
  );

  if (!isVisible) return null;

  return (
    <div 
      className="ide-sidebar resizable-panel"
      style={{ width: `${size}px` }}
      ref={resizeRef}
      data-orientation="horizontal"
    >
      {children}
      <div 
        className={`resize-handle resize-handle-right ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="resize-handle-indicator" />
      </div>
    </div>
  );
};

/**
 * Resizable Terminal Component
 */
export const ResizableTerminal = ({ children, isVisible, isCollapsed, isMaximized, onToggle }) => {
  const { size, setSize, isResizing, handleMouseDown, resizeRef } = useResizablePanel(
    200, // initial
    100, // min
    window.innerHeight * 0.8, // max (80vh)
    'ide-terminal-height'
  );

  useEffect(() => {
    if (isCollapsed) {
      setSize(35); // header height only
    } else if (isMaximized) {
      setSize(window.innerHeight - 100);
    }
  }, [isCollapsed, isMaximized, setSize]);

  if (!isVisible) return null;

  const height = isCollapsed ? 35 : isMaximized ? window.innerHeight - 100 : size;

  return (
    <div 
      className={`ide-terminal resizable-panel ${isCollapsed ? 'collapsed' : ''} ${isMaximized ? 'maximized' : ''}`}
      style={{ height: `${height}px` }}
      ref={resizeRef}
      data-orientation="vertical"
    >
      <div 
        className={`resize-handle resize-handle-top ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleMouseDown}
        style={{ display: isCollapsed || isMaximized ? 'none' : 'block' }}
      >
        <div className="resize-handle-indicator" />
      </div>
      {children}
    </div>
  );
};

/**
 * Panel Position Manager Hook
 * Allows panels to be positioned left, right, bottom
 */
export const usePanelPosition = (initialPosition = 'left', storageKey) => {
  const [position, setPosition] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return saved;
    }
    return initialPosition;
  });

  const changePosition = useCallback((newPosition) => {
    setPosition(newPosition);
    if (storageKey) {
      localStorage.setItem(storageKey, newPosition);
    }
  }, [storageKey]);

  return { position, changePosition };
};

/**
 * Draggable Panel Component
 * Allows panels to be repositioned
 */
export const DraggablePanel = ({ 
  children, 
  title, 
  position = 'left',
  onPositionChange,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  const handleDragStart = (e) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', position);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className={`draggable-panel ${className} ${isDragging ? 'dragging' : ''}`}
      ref={dragRef}
    >
      <div 
        className="draggable-panel-header"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <span className="panel-drag-indicator">⋮⋮</span>
        <span className="panel-title">{title}</span>
      </div>
      <div className="draggable-panel-content">
        {children}
      </div>
    </div>
  );
};

/**
 * Drop Zone Component
 * Accepts draggable panels
 */
export const DropZone = ({ 
  position, 
  onDrop, 
  children,
  className = '' 
}) => {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsOver(false);
    const draggedPosition = e.dataTransfer.getData('text/plain');
    if (onDrop) {
      onDrop(draggedPosition, position);
    }
  };

  return (
    <div 
      className={`drop-zone ${className} ${isOver ? 'drop-zone-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
};

/**
 * Terminal State Manager Hook
 */
export const useTerminalState = (storageKey = 'ide-terminal-state') => {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { isVisible: true, isCollapsed: false, isMaximized: false, position: 'bottom' };
      }
    }
    return { isVisible: true, isCollapsed: false, isMaximized: false, position: 'bottom' };
  });

  const updateState = useCallback((updates) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      localStorage.setItem(storageKey, JSON.stringify(newState));
      return newState;
    });
  }, [storageKey]);

  const toggleVisibility = useCallback(() => {
    updateState({ isVisible: !state.isVisible });
  }, [state.isVisible, updateState]);

  const toggleCollapse = useCallback(() => {
    updateState({ 
      isCollapsed: !state.isCollapsed,
      isMaximized: false 
    });
  }, [state.isCollapsed, updateState]);

  const toggleMaximize = useCallback(() => {
    updateState({ 
      isMaximized: !state.isMaximized,
      isCollapsed: false 
    });
  }, [state.isMaximized, updateState]);

  const setPosition = useCallback((position) => {
    updateState({ position });
  }, [updateState]);

  return {
    ...state,
    updateState,
    toggleVisibility,
    toggleCollapse,
    toggleMaximize,
    setPosition
  };
};

/**
 * Sidebar State Manager Hook
 */
export const useSidebarState = (storageKey = 'ide-sidebar-state') => {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { isVisible: true, position: 'left' };
      }
    }
    return { isVisible: true, position: 'left' };
  });

  const updateState = useCallback((updates) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      localStorage.setItem(storageKey, JSON.stringify(newState));
      return newState;
    });
  }, [storageKey]);

  const toggleVisibility = useCallback(() => {
    updateState({ isVisible: !state.isVisible });
  }, [state.isVisible, updateState]);

  const setPosition = useCallback((position) => {
    updateState({ position });
  }, [updateState]);

  return {
    ...state,
    updateState,
    toggleVisibility,
    setPosition
  };
};

export default {
  useResizablePanel,
  ResizableSidebar,
  ResizableTerminal,
  usePanelPosition,
  DraggablePanel,
  DropZone,
  useTerminalState,
  useSidebarState
};
