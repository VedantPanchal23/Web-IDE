import React, { useState, useEffect, useCallback } from 'react';
import { 
  ResizableSidebar, 
  ResizableTerminal,
  useTerminalState,
  useSidebarState 
} from '../hooks/useResizablePanels';
import '../ResizablePanels.css';

/**
 * Enhanced IDE Layout with VS Code-like flexibility
 * - Resizable panels
 * - Repositionable sidebars and terminal
 * - Persistent state
 */
const EnhancedIDELayout = ({ 
  sidebarContent,
  editorContent,
  terminalContent,
  activityBar,
  statusBar,
  onLayoutChange
}) => {
  // Terminal state management
  const terminalState = useTerminalState();
  const sidebarState = useSidebarState();

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);

  // Handle context menu
  const handleContextMenu = useCallback((e, panelType) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      panelType
    });
  }, []);

  // Close context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Notify layout changes
  useEffect(() => {
    if (onLayoutChange) {
      onLayoutChange({
        sidebar: sidebarState,
        terminal: terminalState
      });
    }
  }, [sidebarState, terminalState, onLayoutChange]);

  // Render context menu
  const renderContextMenu = () => {
    if (!contextMenu) return null;

    const { x, y, panelType } = contextMenu;

    if (panelType === 'terminal') {
      return (
        <div 
          className="panel-context-menu"
          style={{ left: x, top: y }}
        >
          <div 
            className="panel-context-menu-item"
            onClick={() => {
              terminalState.setPosition('bottom');
              setContextMenu(null);
            }}
          >
            <span>📐</span>
            <span>Move to Bottom</span>
          </div>
          <div 
            className="panel-context-menu-item"
            onClick={() => {
              terminalState.setPosition('left');
              setContextMenu(null);
            }}
          >
            <span>⬅️</span>
            <span>Move to Left</span>
          </div>
          <div 
            className="panel-context-menu-item"
            onClick={() => {
              terminalState.setPosition('right');
              setContextMenu(null);
            }}
          >
            <span>➡️</span>
            <span>Move to Right</span>
          </div>
          <div className="panel-context-menu-separator" />
          <div 
            className="panel-context-menu-item"
            onClick={() => {
              terminalState.toggleCollapse();
              setContextMenu(null);
            }}
          >
            <span>{terminalState.isCollapsed ? '⬆️' : '⬇️'}</span>
            <span>{terminalState.isCollapsed ? 'Expand' : 'Collapse'}</span>
          </div>
          <div 
            className="panel-context-menu-item"
            onClick={() => {
              terminalState.toggleMaximize();
              setContextMenu(null);
            }}
          >
            <span>{terminalState.isMaximized ? '🗗' : '🗖'}</span>
            <span>{terminalState.isMaximized ? 'Restore' : 'Maximize'}</span>
          </div>
          <div className="panel-context-menu-separator" />
          <div 
            className="panel-context-menu-item"
            onClick={() => {
              terminalState.toggleVisibility();
              setContextMenu(null);
            }}
          >
            <span>👁️</span>
            <span>Hide Terminal</span>
          </div>
        </div>
      );
    }

    if (panelType === 'sidebar') {
      return (
        <div 
          className="panel-context-menu"
          style={{ left: x, top: y }}
        >
          <div 
            className="panel-context-menu-item"
            onClick={() => {
              sidebarState.setPosition('left');
              setContextMenu(null);
            }}
          >
            <span>⬅️</span>
            <span>Move to Left</span>
          </div>
          <div 
            className="panel-context-menu-item"
            onClick={() => {
              sidebarState.setPosition('right');
              setContextMenu(null);
            }}
          >
            <span>➡️</span>
            <span>Move to Right</span>
          </div>
          <div className="panel-context-menu-separator" />
          <div 
            className="panel-context-menu-item"
            onClick={() => {
              sidebarState.toggleVisibility();
              setContextMenu(null);
            }}
          >
            <span>👁️</span>
            <span>Hide Sidebar</span>
          </div>
        </div>
      );
    }

    return null;
  };

  // Enhanced sidebar header with controls
  const renderSidebarHeader = () => (
    <div 
      className="ide-sidebar-header"
      onContextMenu={(e) => handleContextMenu(e, 'sidebar')}
    >
      <span>{sidebarContent?.title || 'Explorer'}</span>
      <div className="sidebar-controls">
        <button
          className="sidebar-control-btn"
          onClick={() => sidebarState.setPosition(
            sidebarState.position === 'left' ? 'right' : 'left'
          )}
          title={`Move to ${sidebarState.position === 'left' ? 'right' : 'left'}`}
        >
          {sidebarState.position === 'left' ? '➡️' : '⬅️'}
        </button>
        <button
          className="sidebar-control-btn"
          onClick={() => sidebarState.toggleVisibility()}
          title="Hide Sidebar"
        >
          ✕
        </button>
      </div>
    </div>
  );

  // Enhanced terminal header with controls
  const renderTerminalHeader = () => (
    <div 
      className="ide-terminal-header"
      onContextMenu={(e) => handleContextMenu(e, 'terminal')}
    >
      <div className="terminal-header-left">
        <span>Terminal</span>
        <span className="position-indicator">
          {terminalState.position}
        </span>
      </div>
      <div className="terminal-controls">
        <button
          className="terminal-control-btn"
          onClick={() => terminalState.setPosition('left')}
          title="Move to Left"
        >
          ⬅️
        </button>
        <button
          className="terminal-control-btn"
          onClick={() => terminalState.setPosition('bottom')}
          title="Move to Bottom"
        >
          ⬇️
        </button>
        <button
          className="terminal-control-btn"
          onClick={() => terminalState.setPosition('right')}
          title="Move to Right"
        >
          ➡️
        </button>
        <span style={{ width: '1px', height: '16px', background: '#3c3c3c', margin: '0 4px' }} />
        <button
          className={`terminal-control-btn ${terminalState.isCollapsed ? 'active' : ''}`}
          onClick={() => terminalState.toggleCollapse()}
          title={terminalState.isCollapsed ? 'Expand' : 'Collapse'}
        >
          {terminalState.isCollapsed ? '⬆️' : '⬇️'}
        </button>
        <button
          className={`terminal-control-btn ${terminalState.isMaximized ? 'active' : ''}`}
          onClick={() => terminalState.toggleMaximize()}
          title={terminalState.isMaximized ? 'Restore' : 'Maximize'}
        >
          {terminalState.isMaximized ? '🗗' : '🗖'}
        </button>
        <button
          className="terminal-control-btn"
          onClick={() => terminalState.toggleVisibility()}
          title="Hide Terminal"
        >
          ✕
        </button>
      </div>
    </div>
  );

  // Render layout based on positions
  const renderLayout = () => {
    const sidebar = sidebarState.isVisible && (
      <ResizableSidebar
        isVisible={sidebarState.isVisible}
        onToggle={sidebarState.toggleVisibility}
      >
        {renderSidebarHeader()}
        <div className="ide-sidebar-content">
          {sidebarContent?.content}
        </div>
      </ResizableSidebar>
    );

    const terminal = terminalState.isVisible && (
      <ResizableTerminal
        isVisible={terminalState.isVisible}
        isCollapsed={terminalState.isCollapsed}
        isMaximized={terminalState.isMaximized}
        onToggle={terminalState.toggleVisibility}
      >
        {renderTerminalHeader()}
        {!terminalState.isCollapsed && (
          <div className="ide-terminal-content">
            {terminalContent}
          </div>
        )}
      </ResizableTerminal>
    );

    const editor = (
      <div className="ide-content">
        {editorContent}
      </div>
    );

    // Bottom terminal (default)
    if (terminalState.position === 'bottom') {
      return (
        <>
          <div className="ide-main" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {activityBar}
            {sidebarState.position === 'left' && sidebar}
            {editor}
            {sidebarState.position === 'right' && sidebar}
          </div>
          {terminal}
        </>
      );
    }

    // Left terminal
    if (terminalState.position === 'left') {
      return (
        <div className="ide-main" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {activityBar}
          {terminal}
          {sidebarState.position === 'left' && sidebar}
          {editor}
          {sidebarState.position === 'right' && sidebar}
        </div>
      );
    }

    // Right terminal
    if (terminalState.position === 'right') {
      return (
        <div className="ide-main" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {activityBar}
          {sidebarState.position === 'left' && sidebar}
          {editor}
          {sidebarState.position === 'right' && sidebar}
          {terminal}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="ide-layout-flexible">
      {renderLayout()}
      {renderContextMenu()}
      {statusBar}
    </div>
  );
};

export default EnhancedIDELayout;
