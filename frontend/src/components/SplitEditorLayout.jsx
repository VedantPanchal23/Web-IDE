import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { apiService } from '../services/api';
import EnhancedMonacoEditor from './EnhancedMonacoEditor';
import FileTabManager from './FileTabManager';
import EditorToolbar from './EditorToolbar';
import './SplitEditorLayout.css';

/**
 * SplitEditorLayout Component
 * 
 * Provides split editor functionality similar to VS Code:
 * - Horizontal/vertical split layouts
 * - Drag-to-resize panes
 * - Independent file tabs per pane
 * - Independent Monaco editor instances
 * - Optional sync scrolling between panes
 * - Keyboard shortcuts: Ctrl+\ to split, Ctrl+W to close pane
 */
const SplitEditorLayout = ({ theme, fontSize, fontFamily, autoSave, autoSaveDelay }) => {
  const state = useProject();
  const { openTabs, currentFile, openFile, createFile, setCurrentFile, currentProject, fileTree } = state;
  
  // Split configuration
  const [splitLayout, setSplitLayout] = useState('none'); // 'none', 'horizontal', 'vertical'
  const [paneCount, setPaneCount] = useState(1); // 1, 2, or 3
  const [panes, setPanes] = useState([
    { id: 'pane-1', currentFile: null, width: 100, height: 100 }
  ]);
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizingPane, setResizingPane] = useState(null);
  const containerRef = useRef(null);
  
  // Sync scrolling
  const [syncScrolling, setSyncScrolling] = useState(false);
  const editorRefs = useRef({});
  
  // Active pane
  const [activePaneId, setActivePaneId] = useState('pane-1');

  // Update active pane with current file
  useEffect(() => {
    if (currentFile) {
      setPanes(prev => {
        const newPanes = [...prev];
        // Find the active pane and update its file
        const activePaneIndex = newPanes.findIndex(p => p.id === activePaneId);
        if (activePaneIndex >= 0) {
          newPanes[activePaneIndex].currentFile = currentFile;
        }
        return newPanes;
      });
    }
  }, [currentFile, activePaneId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+\ - Split editor
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault();
        handleSplitEditor();
      }
      // Ctrl+W - Close active pane
      else if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        handleClosePaneByKey();
      }
      // Ctrl+K Ctrl+\ - Split vertically (VS Code style)
      else if (e.ctrlKey && e.key === 'k') {
        // Wait for next key
        const handleNextKey = (e2) => {
          if (e2.ctrlKey && e2.key === '\\') {
            e2.preventDefault();
            handleSplitEditor('vertical');
          }
          window.removeEventListener('keydown', handleNextKey);
        };
        window.addEventListener('keydown', handleNextKey);
        setTimeout(() => window.removeEventListener('keydown', handleNextKey), 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panes, activePaneId]);

  // Listen for split editor command from command palette
  useEffect(() => {
    const handleSplitCommand = (e) => {
      const direction = e.detail?.direction || 'vertical';
      handleSplitEditor(direction);
    };

    document.addEventListener('split-editor', handleSplitCommand);
    return () => document.removeEventListener('split-editor', handleSplitCommand);
  }, []);

  // Listen for file operation commands from header menu
  useEffect(() => {
    const handleCreateNewFile = async (e) => {
      const { fileName } = e.detail;
      if (fileName) {
        try {
          // Create file directly using ProjectContext with proper format
          const fileData = {
            name: fileName,
            type: 'file',
            path: `/${fileName}`,
            parentId: null,
            content: ''
          };
          const newFile = await createFile(fileData);
          if (newFile) {
            // Open the newly created file
            setCurrentFile(newFile);
            console.log(`✅ File created: ${fileName}`);
          }
        } catch (error) {
          console.error('Error creating file:', error);
          alert(`Failed to create file: ${error.message}`);
        }
      }
    };

    const handleLoadFileFromDevice = (e) => {
      const { name, content } = e.detail;
      if (name && content !== undefined) {
        // Create a temporary file object for loaded file
        const loadedFile = {
          id: `local-${Date.now()}`,
          name: name,
          path: name,
          content: content,
          isLocal: true // Mark as local file (not saved to server yet)
        };
        
        // Set as current file - this will trigger tab opening
        setCurrentFile(loadedFile);
        
        console.log(`File loaded from device: ${name}`);
      }
    };

    const handleDownloadCurrentFile = () => {
      if (!currentFile) {
        alert('No file is currently open');
        return;
      }
      
      // Create blob and download
      const blob = new Blob([currentFile.content || ''], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFile.name || 'file.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const handleDownloadProjectZip = async () => {
      if (!currentProject) {
        alert('No project is currently open');
        return;
      }

      try {
        // Import JSZip dynamically
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        // Function to recursively add files from file tree
        const addFilesToZip = async (files, parentPath = '') => {
          for (const file of files) {
            if (file.type === 'folder') {
              // Create folder in zip
              const folderPath = parentPath ? `${parentPath}/${file.name}` : file.name;
              zip.folder(folderPath);
              
              // Recursively add children
              if (file.children && file.children.length > 0) {
                await addFilesToZip(file.children, folderPath);
              }
            } else if (file.type === 'file') {
              // Fetch file content and add to zip
              const filePath = parentPath ? `${parentPath}/${file.name}` : file.name;
              try {
                const response = await apiService.getFileContent(currentProject.id, file.id);
                zip.file(filePath, response.data.content || '');
              } catch (error) {
                console.error(`Failed to fetch file: ${file.name}`, error);
                // Add empty file if fetch fails
                zip.file(filePath, '');
              }
            }
          }
        };

        // Show loading indicator
        const loadingMsg = document.createElement('div');
        loadingMsg.textContent = 'Preparing project download...';
        loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#323233;color:#fff;padding:20px;border-radius:8px;z-index:10000;';
        document.body.appendChild(loadingMsg);

        // Add all files from file tree
        const fileTree = state.fileTree || [];
        await addFilesToZip(fileTree);

        // Generate zip file
        const content = await zip.generateAsync({ type: 'blob' });
        
        // Remove loading indicator
        document.body.removeChild(loadingMsg);

        // Download
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProject.name || 'project'}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`✅ Project downloaded: ${currentProject.name}.zip`);
      } catch (error) {
        console.error('Error creating ZIP:', error);
        alert('Failed to create ZIP file: ' + error.message);
      }
    };

    document.addEventListener('create-new-file', handleCreateNewFile);
    document.addEventListener('load-file-from-device', handleLoadFileFromDevice);
    document.addEventListener('download-current-file', handleDownloadCurrentFile);
    document.addEventListener('download-project-zip', handleDownloadProjectZip);

    return () => {
      document.removeEventListener('create-new-file', handleCreateNewFile);
      document.removeEventListener('load-file-from-device', handleLoadFileFromDevice);
      document.removeEventListener('download-current-file', handleDownloadCurrentFile);
      document.removeEventListener('download-project-zip', handleDownloadProjectZip);
    };
  }, [currentFile, openTabs, createFile, setCurrentFile, currentProject, fileTree, state]);

  const handleSplitEditor = (direction) => {
    if (panes.length >= 3) {
      console.warn('Maximum 3 panes supported');
      return;
    }

    // Determine layout
    const newLayout = direction || (splitLayout === 'none' ? 'vertical' : splitLayout);
    
    // Calculate new pane sizes
    const newPaneCount = panes.length + 1;
    const newSize = 100 / newPaneCount;
    
    // Resize existing panes
    const updatedPanes = panes.map(pane => ({
      ...pane,
      width: newLayout === 'vertical' ? newSize : pane.width,
      height: newLayout === 'horizontal' ? newSize : pane.height
    }));

    // Create new pane
    const newPane = {
      id: `pane-${newPaneCount}`,
      currentFile: currentFile, // Clone current file to new pane
      width: newLayout === 'vertical' ? newSize : 100,
      height: newLayout === 'horizontal' ? newSize : 100
    };

    setPanes([...updatedPanes, newPane]);
    setPaneCount(newPaneCount);
    setSplitLayout(newLayout);
    setActivePaneId(newPane.id);

    console.log(`Split editor ${newLayout}ly - ${newPaneCount} panes`);
  };

  const handleClosePaneByKey = () => {
    if (panes.length === 1) {
      console.warn('Cannot close the last pane');
      return;
    }

    handleClosePane(activePaneId);
  };

  const handleClosePane = (paneId) => {
    if (panes.length === 1) return;

    const remainingPanes = panes.filter(p => p.id !== paneId);
    const newPaneCount = remainingPanes.length;
    const newSize = 100 / newPaneCount;

    // Redistribute sizes
    const resizedPanes = remainingPanes.map(pane => ({
      ...pane,
      width: splitLayout === 'vertical' ? newSize : 100,
      height: splitLayout === 'horizontal' ? newSize : 100
    }));

    setPanes(resizedPanes);
    setPaneCount(newPaneCount);

    // Update active pane if needed
    if (activePaneId === paneId) {
      setActivePaneId(resizedPanes[0].id);
    }

    // Reset layout if only one pane left
    if (newPaneCount === 1) {
      setSplitLayout('none');
    }

    console.log(`Closed pane ${paneId} - ${newPaneCount} panes remaining`);
  };

  const handleResizeStart = (paneIndex, e) => {
    e.preventDefault();
    setIsResizing(true);
    setResizingPane(paneIndex);
  };

  const handleResizeMove = (e) => {
    if (!isResizing || resizingPane === null || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    if (splitLayout === 'vertical') {
      // Vertical split - resize width
      const mouseX = e.clientX - rect.left;
      const percentage = (mouseX / rect.width) * 100;

      setPanes(prev => {
        const newPanes = [...prev];
        const totalBefore = newPanes.slice(0, resizingPane + 1).reduce((sum, p) => sum + p.width, 0);
        const totalAfter = newPanes.slice(resizingPane + 1).reduce((sum, p) => sum + p.width, 0);

        if (percentage > 10 && percentage < totalBefore + totalAfter - 10) {
          const diff = percentage - totalBefore;
          newPanes[resizingPane].width += diff;
          newPanes[resizingPane + 1].width -= diff;
        }

        return newPanes;
      });
    } else {
      // Horizontal split - resize height
      const mouseY = e.clientY - rect.top;
      const percentage = (mouseY / rect.height) * 100;

      setPanes(prev => {
        const newPanes = [...prev];
        const totalBefore = newPanes.slice(0, resizingPane + 1).reduce((sum, p) => sum + p.height, 0);
        const totalAfter = newPanes.slice(resizingPane + 1).reduce((sum, p) => sum + p.height, 0);

        if (percentage > 10 && percentage < totalBefore + totalAfter - 10) {
          const diff = percentage - totalBefore;
          newPanes[resizingPane].height += diff;
          newPanes[resizingPane + 1].height -= diff;
        }

        return newPanes;
      });
    }
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizingPane(null);
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, resizingPane]);

  const handlePaneFileChange = (paneId, file) => {
    setPanes(prev => prev.map(pane => 
      pane.id === paneId ? { ...pane, currentFile: file } : pane
    ));
    setActivePaneId(paneId);
  };

  const handleSyncScrollToggle = () => {
    setSyncScrolling(!syncScrolling);
    console.log(`Sync scrolling ${!syncScrolling ? 'enabled' : 'disabled'}`);
  };

  const handleEditorScroll = (paneId, scrollTop, scrollLeft) => {
    if (!syncScrolling) return;

    // Sync scroll to other panes
    Object.entries(editorRefs.current).forEach(([id, ref]) => {
      if (id !== paneId && ref && ref.syncScroll) {
        ref.syncScroll(scrollTop, scrollLeft);
      }
    });
  };

  const getPaneStyle = (pane) => {
    if (splitLayout === 'vertical') {
      return {
        width: `${pane.width}%`,
        height: '100%'
      };
    } else if (splitLayout === 'horizontal') {
      return {
        width: '100%',
        height: `${pane.height}%`
      };
    }
    return { width: '100%', height: '100%' };
  };

  return (
    <div 
      className={`split-editor-layout ${splitLayout}`}
      ref={containerRef}
    >
      {/* Editor Panes */}
      <div className={`panes-container ${splitLayout}`}>
        {panes.map((pane, index) => (
          <React.Fragment key={pane.id}>
            <div
              className={`editor-pane ${activePaneId === pane.id ? 'active' : ''}`}
              style={getPaneStyle(pane)}
              onClick={() => setActivePaneId(pane.id)}
            >
              {/* Pane Header */}
              <div className="pane-header">
                <FileTabManager
                  theme={theme}
                  paneId={pane.id}
                  currentFile={pane.currentFile}
                  onFileChange={(file) => handlePaneFileChange(pane.id, file)}
                />
                
                {panes.length > 1 && (
                  <button
                    className="close-pane-header-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClosePane(pane.id);
                    }}
                    title="Close pane"
                  >
                    ✖
                  </button>
                )}
              </div>

              {/* Pane Editor */}
              <div className="pane-editor">
                <EnhancedMonacoEditor
                  ref={(ref) => editorRefs.current[pane.id] = ref}
                  theme={theme}
                  fontSize={fontSize}
                  fontFamily={fontFamily}
                  autoSave={autoSave}
                  autoSaveDelay={autoSaveDelay}
                  file={pane.currentFile}
                  onScroll={(scrollTop, scrollLeft) => handleEditorScroll(pane.id, scrollTop, scrollLeft)}
                />
              </div>
            </div>

            {/* Resize Handle */}
            {index < panes.length - 1 && (
              <div
                className={`resize-handle ${splitLayout}`}
                onMouseDown={(e) => handleResizeStart(index, e)}
              >
                <div className="resize-handle-indicator" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Instructions Overlay (shown when empty) */}
      {panes.length === 1 && !panes[0].currentFile && (
        <div className="split-editor-empty">
          <div className="empty-content">
            <div className="empty-icon">📄</div>
            <div className="empty-title">No File Open</div>
            <div className="empty-instructions">
              <p>Select a file from the Explorer to start editing</p>
              <p className="keyboard-hint">
                Press <kbd>Ctrl</kbd>+<kbd>\</kbd> to split editor
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SplitEditorLayout;
