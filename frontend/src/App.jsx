import React, { useState, useEffect } from 'react';
import { VscTerminal } from 'react-icons/vsc';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider, useProject } from './context/ProjectContext';
import Homepage from './components/Homepage';
import ProjectDashboard from './components/ProjectDashboard';
import UserProfile from './components/UserProfile';
import EnhancedMonacoEditor from './components/EnhancedMonacoEditor';
import EnhancedFileTree from './components/EnhancedFileTree';
import ProjectManager from './components/ProjectManager';
import FileTabManager from './components/FileTabManager';
import ConflictResolver from './components/ConflictResolver';
import SyncStatus from './components/SyncStatus';
import MultiTerminal from './components/MultiTerminal';
import Terminal from './components/Terminal';
import CodeExecution from './components/CodeExecution';
import EditorToolbar from './components/EditorToolbar';
import CommandPalette from './components/CommandPalette';
import WorkspaceSearch from './components/WorkspaceSearch';
import SourceControl from './components/SourceControl';
import Extensions from './components/Extensions';
import AIAssistant from './components/AIAssistant';
import SplitEditorLayout from './components/SplitEditorLayout';
import NotificationToast from './components/NotificationToast';
import IDEHeader from './components/IDEHeader';
import SettingsPanel from './components/SettingsPanel';
import { apiService } from './services/api';
import './IDE.css';

function IDEInterface() {
  return (
    <ProjectProvider>
      <IDEContent />
    </ProjectProvider>
  );
}

function IDEContent() {
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState('JetBrains Mono, Cascadia Code, Fira Code, Consolas, Courier New, monospace');
  const [activeActivityTab, setActiveActivityTab] = useState('explorer');
  const [syncStatus, setSyncStatus] = useState(null);
  const [conflictCount, setConflictCount] = useState(0);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteMode, setCommandPaletteMode] = useState('command'); // 'command' or 'file'
  const [isWorkspaceSearchOpen, setIsWorkspaceSearchOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const { currentProject } = useProject();

  // Apply theme to entire document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Shift+P - Command Palette
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setCommandPaletteMode('command');
        setIsCommandPaletteOpen(true);
      }
      // Ctrl+P - Quick File Open
      else if (e.ctrlKey && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteMode('file');
        setIsCommandPaletteOpen(true);
      }
      // Ctrl+Shift+F - Workspace Search
      else if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setActiveActivityTab('search');
        setIsWorkspaceSearchOpen(true);
      }
      // Ctrl+Shift+I - AI Assistant
      else if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        setActiveActivityTab('ai');
      }
      // Ctrl+B - Toggle Sidebar
      else if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setIsSidebarVisible(prev => !prev);
      }
      // Ctrl+` - Toggle Terminal
      else if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setIsTerminalVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for custom events from command palette
  useEffect(() => {
    const handleToggleSidebar = () => setIsSidebarVisible(prev => !prev);
    const handleToggleTerminal = () => setIsTerminalVisible(prev => !prev);
    const handleToggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    const handleOpenWorkspaceSearch = () => {
      setActiveActivityTab('search');
      setIsWorkspaceSearchOpen(true);
    };
    const handleOpenSettings = () => setIsSettingsPanelOpen(true);

    document.addEventListener('toggle-sidebar', handleToggleSidebar);
    document.addEventListener('toggle-terminal', handleToggleTerminal);
    document.addEventListener('toggle-theme', handleToggleTheme);
    document.addEventListener('open-workspace-search', handleOpenWorkspaceSearch);
    document.addEventListener('ide-action', (e) => {
      if (e.detail?.action === 'open-settings') {
        handleOpenSettings();
      }
    });

    return () => {
      document.removeEventListener('toggle-sidebar', handleToggleSidebar);
      document.removeEventListener('toggle-terminal', handleToggleTerminal);
      document.removeEventListener('toggle-theme', handleToggleTheme);
      document.removeEventListener('open-workspace-search', handleOpenWorkspaceSearch);
    };
  }, []);

  // Fetch sync status and conflicts periodically
  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        const projectId = currentProject?.id || currentProject?._id;
        const [statusResponse, conflictsResponse] = await Promise.all([
          apiService.get('/sync/status'),
          apiService.get('/sync/conflicts', {
            params: projectId ? { projectId } : {}
          })
        ]);

        if (statusResponse.success) {
          setSyncStatus(statusResponse.status);
        }

        if (conflictsResponse.success) {
          setConflictCount(conflictsResponse.conflicts.length);
        }
      } catch (error) {
        console.error('Failed to fetch sync status:', error);
      }
    };

    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [currentProject]);

  const handleConflictResolved = () => {
    // Refresh conflict count after resolution
    setConflictCount(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="ide-container">
      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        mode={commandPaletteMode}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        onClose={() => setIsSettingsPanelOpen(false)}
        theme={theme}
        setTheme={setTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        fontFamily={fontFamily}
        setFontFamily={setFontFamily}
      />

      {/* Top Header with Professional Menus */}
      <IDEHeader
        onOpenProjects={() => setIsProjectManagerOpen(true)}
        theme={theme}
        setTheme={setTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />

      {/* Main IDE Layout */}
      <div className="ide-main">
        {/* Activity Bar */}
        <div className="ide-activity-bar">
          <div
            className={`activity-item ${activeActivityTab === 'explorer' ? 'active' : ''}`}
            title="Explorer (Ctrl+Shift+E)"
            onClick={() => setActiveActivityTab('explorer')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
          </div>

          <div
            className={`activity-item ${activeActivityTab === 'search' ? 'active' : ''}`}
            title="Search (Ctrl+Shift+F)"
            onClick={() => setActiveActivityTab('search')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </div>

          <div
            className={`activity-item ${activeActivityTab === 'source-control' ? 'active' : ''}`}
            title="Source Control (Ctrl+Shift+G)"
            onClick={() => setActiveActivityTab('source-control')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.007 0C6.12 0 1.1 4.27.157 10.08c-.944 5.813 2.468 11.45 8.054 13.312.19.064.397.033.555-.084.16-.117.25-.304.244-.5v-2.042c-3.33.735-4.037-1.56-4.037-1.56-.22-.726-.694-1.35-1.334-1.756-1.096-.75.074-.735.074-.735.773.103 1.454.557 1.846 1.23.694 1.21 2.23 1.638 3.45.96.056-.61.327-1.178.766-1.605-2.67-.3-5.462-1.335-5.462-6.002-.02-1.193.42-2.35 1.23-3.226-.327-1.015-.295-2.117.088-3.118 0 0 1.008-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.385 1.002.42 2.104.094 3.12.807.876 1.246 2.033 1.226 3.226 0 4.667-2.793 5.702-5.462 6.002.543.584.808 1.35.767 2.128v3.24c-.005.196.085.384.244.5.16.117.365.148.554.084 5.587-1.86 8.998-7.497 8.054-13.312C22.892 4.267 17.884.007 12.008 0z" />
            </svg>
          </div>

          <div
            className={`activity-item ${activeActivityTab === 'sync' ? 'active' : ''}`}
            title="Cloud Sync"
            onClick={() => setActiveActivityTab('sync')}
          >
            <span className="activity-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
              </svg>
              {conflictCount > 0 && (
                <span className="conflict-badge">{conflictCount}</span>
              )}
            </span>
          </div>

          <div
            className={`activity-item ${activeActivityTab === 'ai' ? 'active' : ''}`}
            title="AI Assistant (Ctrl+Shift+I)"
            onClick={() => setActiveActivityTab('ai')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
              <circle cx="16" cy="7" r="1" />
              <circle cx="16" cy="11" r="1" />
            </svg>
          </div>

          <div
            className={`activity-item ${activeActivityTab === 'extensions' ? 'active' : ''}`}
            title="Extensions (Ctrl+Shift+X)"
            onClick={() => setActiveActivityTab('extensions')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
            </svg>
          </div>

          <div className="activity-spacer"></div>
        </div>

        {/* Sidebar */}
        {isSidebarVisible && (
          <SidebarWithResize
            activeActivityTab={activeActivityTab}
            isWorkspaceSearchOpen={isWorkspaceSearchOpen}
            setIsWorkspaceSearchOpen={setIsWorkspaceSearchOpen}
          />
        )}

        {/* Main Content Area */}
        <div className="ide-content">
          {/* Editor with Split Support */}
          <SplitEditorLayout
            theme={theme}
            fontSize={fontSize}
            fontFamily={fontFamily}
            autoSave={true}
            autoSaveDelay={2000}
          />

          {/* Terminal */}
          {isTerminalVisible && (
            <div className="ide-terminal">
              <BottomPanelTabs theme={theme} />
            </div>
          )}
        </div>
      </div>

      {/* Project Manager Modal */}
      <ProjectManager
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
      />
    </div>
  );
}

// Sidebar with Resize Component
function SidebarWithResize({ activeActivityTab, isWorkspaceSearchOpen, setIsWorkspaceSearchOpen }) {
  const { currentProject } = useProject();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('ide-sidebar-width');
    return saved ? parseInt(saved, 10) : 260;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = React.useRef(null);

  const handleConflictResolved = () => {
    // Refresh conflict count after resolution
  };

  // Handle sidebar resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      if (sidebarRef.current) {
        const newWidth = e.clientX - 48; // 48px for activity bar
        const clampedWidth = Math.max(200, Math.min(600, newWidth));
        setSidebarWidth(clampedWidth);
        localStorage.setItem('ide-sidebar-width', clampedWidth.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <div className="ide-sidebar" ref={sidebarRef} style={{ width: `${sidebarWidth}px` }}>
      {/* Resize Handle */}
      <div
        className={`resize-handle resize-handle-right ${isResizing ? 'resizing' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          cursor: 'ew-resize',
          background: 'transparent',
          zIndex: 100
        }}
      >
        <div
          className="resize-handle-indicator"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '2px',
            height: '30px',
            borderRadius: '1px',
            background: isResizing ? '#ffffff' : 'transparent',
            transition: 'background 0.2s ease'
          }}
        />
      </div>

      <div className="ide-sidebar-header">
        {activeActivityTab === 'explorer' && 'Explorer'}
        {activeActivityTab === 'search' && 'Search'}
        {activeActivityTab === 'source-control' && 'Source Control'}
        {activeActivityTab === 'sync' && 'Cloud Sync'}
        {activeActivityTab === 'ai' && 'AI Assistant'}
        {activeActivityTab === 'extensions' && 'Extensions'}
      </div>

      <div className="ide-sidebar-content">
        {activeActivityTab === 'explorer' && <EnhancedFileTree />}

        {activeActivityTab === 'search' && (
          <WorkspaceSearch
            isOpen={true}
            onClose={() => setActiveActivityTab('explorer')}
          />
        )}

        {activeActivityTab === 'source-control' && (
          <SourceControl />
        )}

        {activeActivityTab === 'sync' && (
          <div className="sidebar-panel">
            <SyncStatus
              projectId={currentProject?.id || currentProject?._id}
              className="sidebar-sync-status"
            />

            <ConflictResolver
              projectId={currentProject?.id || currentProject?._id}
              onConflictResolved={handleConflictResolved}
              className="sidebar-conflict-resolver"
            />
          </div>
        )}

        {activeActivityTab === 'ai' && (
          <AIAssistant />
        )}

        {activeActivityTab === 'extensions' && (
          <Extensions />
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [showDashboard, setShowDashboard] = useState(true);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        color: '#e0e0e0',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔄</div>
          <div>Loading AI-IDE...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Homepage />;
  }

  // Show dashboard until user selects a project
  if (showDashboard) {
    return (
      <ProjectProvider>
        <ProjectDashboard onProjectOpen={() => setShowDashboard(false)} />
      </ProjectProvider>
    );
  }

  return <IDEInterface />;
}

// Bottom Panel Tabs Component
function BottomPanelTabs({ theme }) {
  const { currentFile, currentProject } = useProject();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('terminal');
  const [terminalHeight, setTerminalHeight] = useState(() => {
    const saved = localStorage.getItem('ide-terminal-height');
    return saved ? parseInt(saved, 10) : 200;
  });
  const [isResizing, setIsResizing] = useState(false);
  const terminalRef = React.useRef(null);

  // Listen for show-terminal event from Run button
  useEffect(() => {
    const handleShowTerminal = () => setActiveTab('terminal');
    document.addEventListener('show-terminal', handleShowTerminal);
    return () => document.removeEventListener('show-terminal', handleShowTerminal);
  }, []);

  // Handle terminal resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      if (terminalRef.current) {
        const rect = terminalRef.current.getBoundingClientRect();
        const newHeight = window.innerHeight - e.clientY;
        const clampedHeight = Math.max(100, Math.min(window.innerHeight * 0.8, newHeight));
        setTerminalHeight(clampedHeight);
        localStorage.setItem('ide-terminal-height', clampedHeight.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Get language from current file - memoized
  const currentLanguage = React.useMemo(() => {
    if (!currentFile?.name) {
      return 'bash'; // Default to bash
    }

    const extension = currentFile.name.split('.').pop()?.toLowerCase();
    const languageMap = {
      'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript',
      'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'pyx': 'python', 'pyi': 'python',
      'java': 'java', 'class': 'java',
      'c': 'c', 'h': 'c',
      'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'sh': 'bash',
      'bash': 'bash'
    };

    return languageMap[extension] || 'bash';
  }, [currentFile?.name]);

  return (
    <div className="bottom-panel" ref={terminalRef} style={{ height: `${terminalHeight}px` }}>
      {/* Resize Handle */}
      <div
        className={`resize-handle resize-handle-top ${isResizing ? 'resizing' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          cursor: 'ns-resize',
          background: 'transparent',
          zIndex: 100
        }}
      >
        <div
          className="resize-handle-indicator"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '30px',
            height: '2px',
            borderRadius: '1px',
            background: isResizing ? '#ffffff' : 'transparent',
            transition: 'background 0.2s ease'
          }}
        />
      </div>

      <div className="bottom-panel-tabs">
        <button
          className={`tab-button ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => setActiveTab('terminal')}
        >
          <VscTerminal /> Terminal
        </button>
      </div>

      <div className="bottom-panel-content">
        {activeTab === 'terminal' && (
          <MultiTerminal
            userId={user?.id}
            projectId={currentProject?.id || currentProject?._id}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}

// Run and Debug Panel Component
function RunDebugPanel() {
  const { currentFile, currentProject } = useProject();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('execution');

  // Get language from current file - memoized to prevent unnecessary recalculations
  const currentLanguage = React.useMemo(() => {
    if (!currentFile?.name) {
      return 'bash'; // Default to bash for better shell support
    }

    const extension = currentFile.name.split('.').pop()?.toLowerCase();
    const languageMap = {
      'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript',
      'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'pyx': 'python', 'pyi': 'python',
      'java': 'java', 'class': 'java',
      'c': 'c', 'h': 'c',
      'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'sh': 'bash',
      'bash': 'bash'
    };

    return languageMap[extension] || 'bash';
  }, [currentFile?.name]);

  return (
    <div className="run-debug-panel">
      <div className="run-debug-tabs">
        <button
          className={`tab-button ${activeTab === 'execution' ? 'active' : ''}`}
          onClick={() => setActiveTab('execution')}
        >
          <span>🚀</span> Execute
        </button>
        <button
          className={`tab-button ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => setActiveTab('terminal')}
        >
          <span>💻</span> Terminal
        </button>
      </div>

      <div className="run-debug-content">
        {activeTab === 'execution' && (
          <div className="execution-tab">
            {currentFile ? (
              <CodeExecution
                code={currentFile.content || ''}
                language={currentLanguage}
                projectId={currentProject?.id || currentProject?._id}
                files={[{
                  name: currentFile.name || currentFile.path || currentFile.filename || 'unnamed-file.txt',
                  content: currentFile.content || ''
                }]}
                onExecutionStart={() => {
                  console.log('Execution started for', currentFile.name || currentFile.path || 'unknown file');
                }}
                onExecutionComplete={(result) => {
                  console.log('Execution completed:', result);
                }}
              />
            ) : (
              <div className="no-file-selected">
                <div className="placeholder-content">
                  <span className="placeholder-icon">📝</span>
                  <span className="placeholder-text">
                    Select a file to run code
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="terminal-tab">
            <Terminal
              userId={user?.id}
              projectId={currentProject?.id || currentProject?._id}
              language={currentLanguage}
            />
          </div>
        )}
      </div>

      {/* Global notification toast */}
      <NotificationToast />
    </div>
  );
}

export default App;
