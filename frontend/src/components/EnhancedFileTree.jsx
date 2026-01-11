import { useState, useEffect, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import { FileIcon } from './icons/FileIcons';
import { VscNewFile, VscNewFolder, VscTrash, VscEdit, VscRefresh, VscEllipsis, VscFolder, VscWarning, VscCheck, VscError, VscInfo, VscSync, VscCloudDownload } from 'react-icons/vsc';
import { fileWatcherClient } from '../services/fileWatcherClient';
import { apiService } from '../services/api';
import './EnhancedFileTree.css';

const SyncStatusIcon = ({ status }) => {
  const iconMap = {
    'synced': { icon: VscCheck, color: '#238636' },
    'syncing': { icon: VscRefresh, color: '#1f6feb' },
    'conflict': { icon: VscWarning, color: '#fb8500' },
    'error': { icon: VscError, color: '#f85149' },
    'offline': { icon: VscInfo, color: '#656d76' }
  };
  
  const IconComponent = iconMap[status]?.icon;
  const color = iconMap[status]?.color || '#656d76';
  
  return IconComponent ? (
    <span 
      style={{ 
        marginLeft: '4px', 
        color, 
        fontSize: '10px',
        fontWeight: 'bold',
        display: 'inline-flex',
        alignItems: 'center'
      }}
      title={`Sync status: ${status}`}
    >
      <IconComponent />
    </span>
  ) : null;
};

const FileTreeItem = ({ 
  file, 
  level = 0, 
  onSelect, 
  onToggle, 
  onRename, 
  onDelete,
  onCreateFile,
  onCreateFolder,
  selectedFileId,
  expandedFolders 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(file.name);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const isFolder = file.type === 'folder';
  const isExpanded = expandedFolders.has(file.id);
  const isSelected = selectedFileId === file.id;

  const handleClick = (e) => {
    e.stopPropagation();
    
    // Always select the item (file or folder)
    onSelect(file);
    
    // If it's a folder, also toggle expand/collapse
    if (isFolder) {
      onToggle(file.id);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleRename = () => {
    setIsEditing(true);
    setShowContextMenu(false);
  };

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    if (editName.trim() && editName !== file.name) {
      onRename(file.id, editName.trim());
    }
    setIsEditing(false);
    setEditName(file.name);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${file.name}?`)) {
      onDelete(file.id);
    }
    setShowContextMenu(false);
  };

  const handleCreateFile = () => {
    const fileName = prompt('Enter file name:');
    if (fileName && fileName.trim()) {
      onCreateFile(file.id, fileName.trim());
    }
    setShowContextMenu(false);
  };

  const handleCreateFolder = () => {
    const folderName = prompt('Enter folder name:');
    if (folderName && folderName.trim()) {
      onCreateFolder(file.id, folderName.trim());
    }
    setShowContextMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          paddingLeft: `${8 + level * 16}px`,
          cursor: 'pointer',
          backgroundColor: isSelected ? 'var(--file-tree-selected, #264f78)' : 'transparent',
          borderRadius: '3px',
          margin: '1px 4px',
          fontSize: '14px',
          color: 'var(--file-tree-text, #f0f6fc)',
          userSelect: 'none',
          transition: 'background-color 0.1s ease',
          border: isSelected ? '1px solid var(--file-tree-selected-border, #005fb8)' : '1px solid transparent'
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = 'var(--file-tree-hover, #2a2d2e)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        {isFolder && (
          <span 
            style={{ 
              marginRight: '4px',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.1s ease'
            }}
          >
            ▶
          </span>
        )}
        
        <FileIcon file={file} isOpen={isExpanded} />
        
        {isEditing ? (
          <form onSubmit={handleRenameSubmit} style={{ flex: 1 }}>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              autoFocus
              style={{
                background: 'transparent',
                border: '1px solid var(--accent-color, #58a6ff)',
                borderRadius: '2px',
                color: 'var(--text-primary, #f0f6fc)',
                fontSize: '14px',
                padding: '0 2px',
                outline: 'none',
                width: '100%'
              }}
            />
          </form>
        ) : (
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {file.name}
          </span>
        )}
        
        {/* Temporarily hide sync status icons - Google Drive sync issues don't affect core functionality */}
        {/* <SyncStatusIcon status={file.syncStatus} /> */}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenuPos.x,
            top: contextMenuPos.y,
            background: '#252526',
            border: '1px solid #454545',
            borderRadius: '5px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.16)',
            zIndex: 1000,
            minWidth: '180px',
            padding: '4px 0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
          }}
        >
          {isFolder && (
            <>
              <button
                onClick={handleCreateFile}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '6px 12px',
                  border: 'none',
                  background: 'transparent',
                  color: '#cccccc',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'background-color 0.1s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2d2e'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <VscNewFile />
                <span>New File</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#858585' }}>Ctrl+N</span>
              </button>
              <button
                onClick={handleCreateFolder}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '6px 12px',
                  border: 'none',
                  background: 'transparent',
                  color: '#cccccc',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'background-color 0.1s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2d2e'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <VscNewFolder />
                <span>New Folder</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#858585' }}>Ctrl+Shift+N</span>
              </button>
              <div style={{ 
                height: '1px', 
                backgroundColor: '#454545', 
                margin: '4px 8px' 
              }} />
            </>
          )}
          
          <button
            onClick={handleRename}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '6px 12px',
              border: 'none',
              background: 'transparent',
              color: '#cccccc',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'background-color 0.1s ease'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2d2e'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <VscEdit />
            <span>Rename</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#858585' }}>F2</span>
          </button>
          
          <div style={{ 
            height: '1px', 
            backgroundColor: '#454545', 
            margin: '4px 8px' 
          }} />
          
          <button
            onClick={handleDelete}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '6px 12px',
              border: 'none',
              background: 'transparent',
              color: '#f85149',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'background-color 0.1s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#2a2d2e';
              e.target.style.color = '#ff6b6b';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#f85149';
            }}
          >
            <VscTrash />
            <span>Delete</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#858585' }}>Del</span>
          </button>
        </div>
      )}

      {/* Children (for expanded folders) */}
      {isFolder && isExpanded && file.children && (
        <div>
          {file.children.map((childFile) => (
            <FileTreeItem
              key={childFile.id}
              file={childFile}
              level={level + 1}
              onSelect={onSelect}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              selectedFileId={selectedFileId}
              expandedFolders={expandedFolders}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function EnhancedFileTree() {
  const { 
    currentProject, 
    fileTree, 
    loadFileContent, 
    createFile, 
    deleteFile,
    currentFile,
    fileTreeLoading,
    error,
    refreshFileTree
  } = useProject();
  
  const { user } = useAuth();

  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [showRootContextMenu, setShowRootContextMenu] = useState(false);
  const [rootContextMenuPos, setRootContextMenuPos] = useState({ x: 0, y: 0 });

  const handleToggleFolder = useCallback((folderId) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const handleSelectFile = useCallback(async (file) => {
    // Always set the selected file ID (for both files and folders)
    setSelectedFileId(file.id);
    
    // Only load content if it's a file
    if (file.type === 'file') {
      try {
        await loadFileContent(file.id);
        // loadFileContent automatically adds file to tabs via SET_CURRENT_FILE action
      } catch (error) {
        console.error('Failed to load file:', error);
      }
    }
  }, [loadFileContent]);

  const handleCreateFile = useCallback(async (parentId, fileName) => {
    try {
      let parentPath = '/';
      if (parentId) {
        const parentFile = findFileById(fileTree, parentId);
        
        if (!parentFile) {
          console.error('Parent folder not found:', parentId);
          alert('Error: Parent folder not found. Please try again.');
          return;
        }
        
        if (parentFile.type !== 'folder') {
          console.error('Parent is not a folder:', parentFile);
          alert('Error: Cannot create file inside a file. Please select a folder.');
          return;
        }
        
        parentPath = parentFile.path;
      }
      
      const filePath = parentPath === '/' ? `/${fileName}` : `${parentPath}/${fileName}`;
      
      await createFile({
        name: fileName,
        type: 'file',
        path: filePath,
        parentId: parentId,
        content: ''
      });
      
      // Auto-expand the parent folder if it exists
      if (parentId) {
        setExpandedFolders(prev => new Set([...prev, parentId]));
      }
    } catch (error) {
      console.error('Failed to create file:', error);
      alert(`Failed to create file: ${error.message}`);
    }
  }, [createFile, fileTree]);

  const handleCreateFolder = useCallback(async (parentId, folderName) => {
    try {
      let parentPath = '/';
      if (parentId) {
        const parentFile = findFileById(fileTree, parentId);
        
        if (!parentFile) {
          console.error('Parent folder not found:', parentId);
          alert('Error: Parent folder not found. Please try again.');
          return;
        }
        
        if (parentFile.type !== 'folder') {
          console.error('Parent is not a folder:', parentFile);
          alert('Error: Cannot create folder inside a file. Please select a folder.');
          return;
        }
        
        parentPath = parentFile.path;
      }
      
      const folderPath = parentPath === '/' ? `/${folderName}` : `${parentPath}/${folderName}`;
      
      await createFile({
        name: folderName,
        type: 'folder',
        path: folderPath,
        parentId: parentId
      });
      
      // Auto-expand the parent folder if it exists
      if (parentId) {
        setExpandedFolders(prev => new Set([...prev, parentId]));
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert(`Failed to create folder: ${error.message}`);
    }
  }, [createFile, fileTree]);

  const handleRename = useCallback(async (fileId, newName) => {
    try {
      if (!currentProject?._id) {
        throw new Error('No project selected');
      }

      // Make API call to rename file
      const response = await apiService.patch(
        `/files/${currentProject._id}/${fileId}/rename`,
        { newName }
      );

      if (response.data.success) {
        // Refresh file tree to show updated name without page reload
        await refreshFileTree();
        console.log('File renamed successfully:', response.data.file);
      }
    } catch (error) {
      console.error('Failed to rename file:', error);
      alert(`Failed to rename file: ${error.response?.data?.message || error.message}`);
    }
  }, [currentProject, refreshFileTree]);

  const handleDelete = useCallback(async (fileId) => {
    try {
      await deleteFile(fileId);
      
      // Clear selection if deleted file was selected
      if (selectedFileId === fileId) {
        setSelectedFileId(null);
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }, [deleteFile, selectedFileId]);

  // Helper function to find file by ID recursively
  const findFileById = useCallback((files, id) => {
    for (const file of files) {
      if (file.id === id) return file;
      if (file.children) {
        const found = findFileById(file.children, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Helper function to find parent folder of a file
  const findParentFolder = useCallback((files, targetId, parent = null) => {
    for (const file of files) {
      if (file.id === targetId) {
        return parent; // Return the parent (null if root level)
      }
      if (file.children && file.type === 'folder') {
        const found = findParentFolder(file.children, targetId, file);
        if (found !== undefined) return found;
      }
    }
    return undefined; // Not found in this branch
  }, []);

  // Helper function to get target folder for creating new items
  const getTargetFolder = useCallback((selectedId) => {
    if (!selectedId) {
      return { id: null, name: 'root' };
    }
    
    const selectedFile = findFileById(fileTree, selectedId);
    
    if (!selectedFile) {
      return { id: null, name: 'root' };
    }
    
    // If selected item is a folder, use it
    if (selectedFile.type === 'folder') {
      return { id: selectedFile.id, name: selectedFile.name };
    }
    
    // If selected item is a file, find its parent folder
    const parentFolder = findParentFolder(fileTree, selectedId);
    
    if (parentFolder) {
      return { id: parentFolder.id, name: parentFolder.name };
    }
    
    // File is at root level
    return { id: null, name: 'root' };
  }, [fileTree, findFileById, findParentFolder]);

  // Root-level context menu handlers
  const handleRootContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't show context menu if Drive auth is required
    if (user?.driveAuthStatus?.requiresReauth) {
      alert('Please re-authenticate with Google Drive first to create files and folders.');
      return;
    }
    
    setRootContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowRootContextMenu(true);
  };

  const handleCreateRootFile = () => {
    // Check Drive auth before creating
    if (user?.driveAuthStatus?.requiresReauth) {
      alert('Please re-authenticate with Google Drive first.');
      setShowRootContextMenu(false);
      return;
    }
    
    const fileName = prompt('Enter file name:');
    if (fileName && fileName.trim()) {
      handleCreateFile(null, fileName.trim()); // null for root level
    }
    setShowRootContextMenu(false);
  };

  const handleCreateRootFolder = () => {
    // Check Drive auth before creating
    if (user?.driveAuthStatus?.requiresReauth) {
      alert('Please re-authenticate with Google Drive first.');
      setShowRootContextMenu(false);
      return;
    }
    
    const folderName = prompt('Enter folder name:');
    if (folderName && folderName.trim()) {
      handleCreateFolder(null, folderName.trim()); // null for root level
    }
    setShowRootContextMenu(false);
  };

  // Update selected file when currentFile changes
  useEffect(() => {
    if (currentFile) {
      setSelectedFileId(currentFile.id);
    }
  }, [currentFile]);

  // Listen for file changes and auto-refresh
  useEffect(() => {
    if (!currentProject?.id) return;

    const handleFileChange = (data) => {
      console.log('🔄 File change detected, refreshing tree:', data);
      // Debounce refresh to avoid too many updates
      setTimeout(() => {
        refreshFileTree();
      }, 500);
    };

    // Subscribe to file change events
    fileWatcherClient.on('file-change', handleFileChange);

    return () => {
      // Cleanup listener
      fileWatcherClient.off('file-change', handleFileChange);
    };
  }, [currentProject, refreshFileTree]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle shortcuts when file tree has focus or no specific input is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true'
      );

      if (isInputFocused) return;

      // Ctrl+N: New File
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (user?.driveAuthStatus?.requiresReauth) {
          alert('Please re-authenticate with Google Drive first.');
          return;
        }
        
        const target = getTargetFolder(selectedFileId);
        const fileName = prompt(`New file in "${target.name}":`);
        if (fileName && fileName.trim()) {
          handleCreateFile(target.id, fileName.trim());
        }
      }
      
      // Ctrl+Shift+N: New Folder
      else if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        if (user?.driveAuthStatus?.requiresReauth) {
          alert('Please re-authenticate with Google Drive first.');
          return;
        }
        
        const target = getTargetFolder(selectedFileId);
        const folderName = prompt(`New folder in "${target.name}":`);
        if (folderName && folderName.trim()) {
          handleCreateFolder(target.id, folderName.trim());
        }
      }
      
      // F2: Rename selected file
      else if (e.key === 'F2') {
        e.preventDefault();
        if (!selectedFileId) {
          alert('Please select a file or folder first.');
          return;
        }
        const selectedFile = findFileById(fileTree, selectedFileId);
        if (!selectedFile) return;
        
        const newName = prompt(`Rename ${selectedFile.name} to:`, selectedFile.name);
        if (newName && newName.trim() && newName !== selectedFile.name) {
          handleRename(selectedFileId, newName.trim());
        }
      }
      
      // Delete: Delete selected file
      else if (e.key === 'Delete') {
        e.preventDefault();
        if (!selectedFileId) return;
        
        const selectedFile = findFileById(fileTree, selectedFileId);
        if (!selectedFile) return;
        
        if (window.confirm(`Are you sure you want to delete ${selectedFile.name}?`)) {
          handleDelete(selectedFileId);
        }
      }
      
      // F5: Refresh
      else if (e.key === 'F5') {
        e.preventDefault();
        refreshFileTree();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFileId, user, handleCreateFile, handleCreateFolder, handleRename, handleDelete, findFileById, fileTree, refreshFileTree]);

  // Close root context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowRootContextMenu(false);
    if (showRootContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showRootContextMenu]);

  if (!currentProject) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#656d76',
        fontSize: '14px'
      }}>
        <VscFolder size={48} style={{ color: '#dcb67a', marginBottom: '16px' }} />
        <p>No project selected</p>
        <p>Select or create a project to view files</p>
      </div>
    );
  }

  if (fileTreeLoading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#656d76',
        fontSize: '14px'
      }}>
        Loading files...
      </div>
    );
  }

  if (error) {
    const isAuthError = error.includes('re-authenticate') || error.includes('Drive access') || error.includes('authentication');
    
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#f85149',
        fontSize: '14px'
      }}>
        <p>Error loading files:</p>
        <p>{error}</p>
        {isAuthError && (
          <button
            onClick={() => {
              window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'}/auth/google`;
            }}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#238636',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Re-authenticate with Google Drive
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      padding: '8px 0'
    }}>
      {/* Drive Authentication Warning */}
      {user?.driveAuthStatus?.requiresReauth && (
        <div style={{
          margin: '8px 12px',
          padding: '8px 12px',
          backgroundColor: '#fb8500',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#000',
          marginBottom: '8px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <VscWarning /> Google Drive Access Required
          </div>
          <div style={{ marginBottom: '6px' }}>
            Re-authenticate to create files and folders
          </div>
          <button
            onClick={() => {
              window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'}/auth/google/reauth`;
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: '#000',
              color: '#fb8500',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold'
            }}
          >
            Re-authenticate Now
          </button>
        </div>
      )}

      {/* Project header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-color, #30363d)',
        marginBottom: '8px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-primary, #f0f6fc)',
          fontSize: '14px',
          fontWeight: 'bold'
        }}>
          <VscFolder style={{ color: '#dcb67a' }} />
          <span>{currentProject.name}</span>
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--text-muted, #656d76)',
          marginTop: '2px'
        }}>
          {fileTree.length} items
        </div>
      </div>

      {/* VS Code-style toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        borderBottom: '1px solid var(--border-color, #30363d)',
        marginBottom: '4px'
      }}>
        {/* Show context when folder is selected */}
        {selectedFileId && (() => {
          const target = getTargetFolder(selectedFileId);
          if (!target || target.name === 'root') return null;
          
          return (
            <div style={{
              fontSize: '11px',
              color: 'var(--text-secondary, #858585)',
              marginRight: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              background: 'var(--bg-tertiary, #2d2d30)',
              borderRadius: '3px'
            }}>
              <VscFolder style={{ color: '#dcb67a', fontSize: '14px' }} />
              <span>{target.name}</span>
            </div>
          );
        })()}
        <button
          onClick={() => {
            if (user?.driveAuthStatus?.requiresReauth) {
              alert('Please re-authenticate with Google Drive first.');
              return;
            }
            
            const target = getTargetFolder(selectedFileId);
            const fileName = prompt(`New file in "${target.name}":`);
            if (fileName && fileName.trim()) {
              handleCreateFile(target.id, fileName.trim());
            }
          }}
          title={(() => {
            const target = getTargetFolder(selectedFileId);
            return `New File in ${target.name} (Ctrl+N)`;
          })()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            border: 'none',
            borderRadius: '4px',
            background: 'transparent',
            color: 'var(--text-primary, #f0f6fc)',
            cursor: 'pointer',
            fontSize: '16px',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-hover, #30363d)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <VscNewFile />
        </button>
        
        <button
          onClick={() => {
            if (user?.driveAuthStatus?.requiresReauth) {
              alert('Please re-authenticate with Google Drive first.');
              return;
            }
            
            const target = getTargetFolder(selectedFileId);
            const folderName = prompt(`New folder in "${target.name}":`);
            if (folderName && folderName.trim()) {
              handleCreateFolder(target.id, folderName.trim());
            }
          }}
          title={(() => {
            const target = getTargetFolder(selectedFileId);
            return `New Folder in ${target.name} (Ctrl+Shift+N)`;
          })()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            border: 'none',
            borderRadius: '4px',
            background: 'transparent',
            color: '#dcb67a',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-hover, #30363d)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <VscNewFolder />
        </button>

        <div style={{ 
          width: '1px', 
          height: '16px', 
          backgroundColor: 'var(--border-color, #30363d)',
          margin: '0 4px'
        }} />

        <button
          onClick={() => {
            if (!selectedFileId) {
              alert('Please select a file or folder first.');
              return;
            }
            const selectedFile = findFileById(fileTree, selectedFileId);
            if (!selectedFile) return;
            
            const newName = prompt(`Rename ${selectedFile.name} to:`, selectedFile.name);
            if (newName && newName.trim() && newName !== selectedFile.name) {
              handleRename(selectedFileId, newName.trim());
            }
          }}
          title="Rename (F2)"
          disabled={!selectedFileId}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            border: 'none',
            borderRadius: '4px',
            background: 'transparent',
            color: selectedFileId ? 'var(--text-primary, #f0f6fc)' : 'var(--text-muted, #656d76)',
            cursor: selectedFileId ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => {
            if (selectedFileId) e.target.style.backgroundColor = 'var(--bg-hover, #30363d)';
          }}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <VscEdit />
          </button>        <button
          onClick={() => {
            if (!selectedFileId) {
              alert('Please select a file or folder first.');
              return;
            }
            const selectedFile = findFileById(fileTree, selectedFileId);
            if (!selectedFile) return;
            
            if (window.confirm(`Are you sure you want to delete ${selectedFile.name}?`)) {
              handleDelete(selectedFileId);
            }
          }}
          title="Delete (Delete)"
          disabled={!selectedFileId}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            border: 'none',
            borderRadius: '4px',
            background: 'transparent',
            color: selectedFileId ? '#f85149' : 'var(--text-muted, #656d76)',
            cursor: selectedFileId ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => {
            if (selectedFileId) e.target.style.backgroundColor = '#30363d';
          }}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <VscTrash />
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={async () => {
            // Refresh file tree
            await refreshFileTree();
          }}
          title="Refresh Explorer (F5)"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            border: 'none',
            borderRadius: '4px',
            background: 'transparent',
            color: 'var(--text-primary, #f0f6fc)',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-hover, #30363d)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <VscRefresh />
        </button>

        <button
          onClick={() => {
            // Trigger manual container sync
            if (currentProject?.id && fileWatcherClient.socket) {
              console.log('🔄 Triggering manual sync for project:', currentProject.id);
              fileWatcherClient.socket.emit('file-watcher:sync-container', { 
                projectId: currentProject.id
              });
            }
          }}
          title="Sync Container Files"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            border: 'none',
            borderRadius: '4px',
            background: 'transparent',
            color: 'var(--text-primary, #f0f6fc)',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-hover, #30363d)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <VscSync />
        </button>

        <button
          onClick={async () => {
            // Sync FROM Google Drive
            if (currentProject?.id) {
              console.log('📥 Pulling changes from Google Drive for project:', currentProject.id);
              try {
                const response = await apiService.post('/sync/pull-from-drive', { 
                  projectId: currentProject.id
                });
                if (response.data?.success) {
                  console.log('✅ Sync from Drive completed:', response.data.stats);
                  alert(`Synced from Drive!\nCreated: ${response.data.stats.created}\nUpdated: ${response.data.stats.updated}\nDeleted: ${response.data.stats.deleted}`);
                  // Refresh file tree
                  await refreshFileTree();
                }
              } catch (error) {
                console.error('❌ Failed to sync from Drive:', error);
                alert('Failed to sync from Drive: ' + (error.response?.data?.message || error.message));
              }
            }
          }}
          title="Pull from Google Drive"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            border: 'none',
            borderRadius: '4px',
            background: 'transparent',
            color: 'var(--text-primary, #f0f6fc)',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-hover, #30363d)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <VscCloudDownload />
        </button>

        <button
          onClick={() => {
            // Collapse all folders
            setExpandedFolders(new Set());
          }}
          title="Collapse All"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            border: 'none',
            borderRadius: '4px',
            background: 'transparent',
            color: 'var(--text-primary, #f0f6fc)',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-hover, #30363d)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          📂
        </button>
      </div>

      {/* File tree */}
      <div 
        style={{ minHeight: '200px', position: 'relative' }}
        onContextMenu={handleRootContextMenu}
      >
        {fileTree.length === 0 ? (
          <div 
            style={{
              padding: '20px',
              textAlign: 'center',
              color: '#656d76',
              fontSize: '14px'
            }}
            onContextMenu={handleRootContextMenu}
          >
            <p>No files in this project</p>
            {user?.driveAuthStatus?.requiresReauth ? (
              <p>Please re-authenticate with Google Drive to create files</p>
            ) : (
              <p>Right-click here to create new files</p>
            )}
          </div>
        ) : (
          fileTree.map((file) => (
            <FileTreeItem
              key={file.id}
              file={file}
              onSelect={handleSelectFile}
              onToggle={handleToggleFolder}
              onRename={handleRename}
              onDelete={handleDelete}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              selectedFileId={selectedFileId}
              expandedFolders={expandedFolders}
            />
          ))
        )}

        {/* Root Context Menu */}
        {showRootContextMenu && (
          <div
            style={{
              position: 'fixed',
              left: rootContextMenuPos.x,
              top: rootContextMenuPos.y,
              background: '#252526',
              border: '1px solid #454545',
              borderRadius: '5px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.16)',
              zIndex: 1000,
              minWidth: '180px',
              padding: '4px 0',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
            }}
          >
            <button
              onClick={handleCreateRootFile}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '6px 12px',
                border: 'none',
                background: 'transparent',
                color: '#cccccc',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'background-color 0.1s ease'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2d2e'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <VscNewFile />
              <span>New File</span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#858585' }}>Ctrl+N</span>
            </button>
            <button
              onClick={handleCreateRootFolder}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '6px 12px',
                border: 'none',
                background: 'transparent',
                color: '#cccccc',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'background-color 0.1s ease'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2d2e'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <VscNewFolder />
              <span>New Folder</span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#858585' }}>Ctrl+Shift+N</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}