import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import { apiService } from '../services/api';
import './CommandPalette.css';

/**
 * Command Palette - GitHub Codespaces style
 * Keyboard shortcuts:
 * - Ctrl+Shift+P (Cmd+Shift+P): Open command palette
 * - Ctrl+P (Cmd+P): Quick file open
 * - Escape: Close palette
 */
const CommandPalette = ({ isOpen, onClose, mode = 'command' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);
  const inputRef = useRef(null);
  const { currentProject, files, openFile, createFile, deleteFile, renameFile } = useProject();

  // Command registry
  const commands = [
    {
      id: 'file.new',
      label: 'File: New File',
      description: 'Create a new file',
      action: async () => {
        const fileName = prompt('Enter file name:');
        if (fileName) {
          await createFile(fileName, '');
          onClose();
        }
      },
      keywords: ['new', 'create', 'file'],
      category: 'File'
    },
    {
      id: 'file.open',
      label: 'File: Open File',
      description: 'Open a file',
      action: () => {
        // Switch to quick open mode
        onClose();
        // TODO: Trigger quick open
      },
      keywords: ['open', 'file'],
      category: 'File'
    },
    {
      id: 'file.save',
      label: 'File: Save',
      description: 'Save current file',
      action: () => {
        // Trigger save event
        document.dispatchEvent(new CustomEvent('save-file'));
        onClose();
      },
      keywords: ['save', 'file'],
      category: 'File',
      shortcut: 'Ctrl+S'
    },
    {
      id: 'file.saveAll',
      label: 'File: Save All',
      description: 'Save all open files',
      action: () => {
        document.dispatchEvent(new CustomEvent('save-all-files'));
        onClose();
      },
      keywords: ['save', 'all'],
      category: 'File',
      shortcut: 'Ctrl+K S'
    },
    {
      id: 'file.delete',
      label: 'File: Delete File',
      description: 'Delete a file',
      action: async () => {
        const fileName = prompt('Enter file name to delete:');
        if (fileName && confirm(`Delete ${fileName}?`)) {
          await deleteFile(fileName);
          onClose();
        }
      },
      keywords: ['delete', 'remove', 'file'],
      category: 'File'
    },
    {
      id: 'file.rename',
      label: 'File: Rename File',
      description: 'Rename a file',
      action: async () => {
        const oldName = prompt('Enter current file name:');
        if (oldName) {
          const newName = prompt('Enter new file name:');
          if (newName) {
            await renameFile(oldName, newName);
            onClose();
          }
        }
      },
      keywords: ['rename', 'file'],
      category: 'File'
    },
    {
      id: 'view.toggleSidebar',
      label: 'View: Toggle Sidebar',
      description: 'Show or hide the sidebar',
      action: () => {
        document.dispatchEvent(new CustomEvent('toggle-sidebar'));
        onClose();
      },
      keywords: ['toggle', 'sidebar', 'view'],
      category: 'View',
      shortcut: 'Ctrl+B'
    },
    {
      id: 'view.toggleTerminal',
      label: 'View: Toggle Terminal',
      description: 'Show or hide the terminal',
      action: () => {
        document.dispatchEvent(new CustomEvent('toggle-terminal'));
        onClose();
      },
      keywords: ['toggle', 'terminal', 'view'],
      category: 'View',
      shortcut: 'Ctrl+`'
    },
    {
      id: 'view.splitEditor',
      label: 'View: Split Editor',
      description: 'Split the editor vertically',
      action: () => {
        document.dispatchEvent(new CustomEvent('split-editor', { detail: { direction: 'vertical' } }));
        onClose();
      },
      keywords: ['split', 'editor', 'view', 'vertical'],
      category: 'View',
      shortcut: 'Ctrl+\\'
    },
    {
      id: 'view.splitEditorHorizontal',
      label: 'View: Split Editor Horizontally',
      description: 'Split the editor horizontally',
      action: () => {
        document.dispatchEvent(new CustomEvent('split-editor', { detail: { direction: 'horizontal' } }));
        onClose();
      },
      keywords: ['split', 'editor', 'view', 'horizontal'],
      category: 'View'
    },
    {
      id: 'terminal.new',
      label: 'Terminal: New Terminal',
      description: 'Create a new terminal',
      action: () => {
        document.dispatchEvent(new CustomEvent('new-terminal'));
        onClose();
      },
      keywords: ['new', 'terminal', 'create'],
      category: 'Terminal',
      shortcut: 'Ctrl+Shift+`'
    },
    {
      id: 'terminal.kill',
      label: 'Terminal: Kill Terminal',
      description: 'Kill the active terminal',
      action: () => {
        document.dispatchEvent(new CustomEvent('kill-terminal'));
        onClose();
      },
      keywords: ['kill', 'close', 'terminal'],
      category: 'Terminal'
    },
    {
      id: 'terminal.clear',
      label: 'Terminal: Clear',
      description: 'Clear the terminal',
      action: () => {
        document.dispatchEvent(new CustomEvent('clear-terminal'));
        onClose();
      },
      keywords: ['clear', 'terminal'],
      category: 'Terminal',
      shortcut: 'Ctrl+K'
    },
    {
      id: 'sync.upload',
      label: 'Sync: Upload to Drive',
      description: 'Upload project files to Google Drive',
      action: async () => {
        try {
          await apiService.post('/sync/upload', {
            projectId: currentProject?.id || currentProject?._id
          });
          alert('Files queued for upload to Google Drive');
        } catch (error) {
          alert('Upload failed: ' + error.message);
        }
        onClose();
      },
      keywords: ['sync', 'upload', 'drive', 'google'],
      category: 'Sync'
    },
    {
      id: 'sync.download',
      label: 'Sync: Download from Drive',
      description: 'Download project files from Google Drive',
      action: async () => {
        try {
          await apiService.post('/sync/download', {
            projectId: currentProject?.id || currentProject?._id
          });
          alert('Files queued for download from Google Drive');
        } catch (error) {
          alert('Download failed: ' + error.message);
        }
        onClose();
      },
      keywords: ['sync', 'download', 'drive', 'google'],
      category: 'Sync'
    },
    {
      id: 'sync.resolveConflicts',
      label: 'Sync: Resolve Conflicts',
      description: 'Open conflict resolution panel',
      action: () => {
        document.dispatchEvent(new CustomEvent('open-conflicts'));
        onClose();
      },
      keywords: ['sync', 'conflict', 'resolve'],
      category: 'Sync'
    },
    {
      id: 'search.workspace',
      label: 'Search: Search in Workspace',
      description: 'Search across all files',
      action: () => {
        document.dispatchEvent(new CustomEvent('open-workspace-search'));
        onClose();
      },
      keywords: ['search', 'find', 'workspace'],
      category: 'Search',
      shortcut: 'Ctrl+Shift+F'
    },
    {
      id: 'settings.theme',
      label: 'Settings: Change Theme',
      description: 'Toggle between light and dark theme',
      action: () => {
        document.dispatchEvent(new CustomEvent('toggle-theme'));
        onClose();
      },
      keywords: ['theme', 'dark', 'light', 'settings'],
      category: 'Settings'
    },
    {
      id: 'settings.fontSize',
      label: 'Settings: Change Font Size',
      description: 'Increase or decrease font size',
      action: () => {
        document.dispatchEvent(new CustomEvent('change-font-size'));
        onClose();
      },
      keywords: ['font', 'size', 'settings'],
      category: 'Settings'
    }
  ];

  // Fuzzy search implementation
  const fuzzyMatch = useCallback((text, searchTerm) => {
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();
    const target = text.toLowerCase();

    // Check if all characters in search appear in order in target
    let searchIndex = 0;
    for (let i = 0; i < target.length && searchIndex < search.length; i++) {
      if (target[i] === search[searchIndex]) {
        searchIndex++;
      }
    }

    return searchIndex === search.length;
  }, []);

  // Filter commands based on search
  useEffect(() => {
    if (mode === 'file') {
      // Quick open mode - show files
      const filtered = (files || [])
        .filter(file => {
          const fileName = file.name || file.path;
          return fuzzyMatch(fileName, searchTerm);
        })
        .slice(0, 20);

      setFilteredCommands(filtered.map(file => ({
        id: `file-${file._id || file.id}`,
        label: file.name || file.path,
        description: file.path,
        action: () => {
          openFile(file);
          onClose();
        },
        isFile: true
      })));
    } else {
      // Command mode
      const filtered = commands
        .filter(cmd => {
          const searchLower = searchTerm.toLowerCase();
          return (
            fuzzyMatch(cmd.label, searchTerm) ||
            fuzzyMatch(cmd.description, searchTerm) ||
            cmd.keywords.some(kw => fuzzyMatch(kw, searchTerm))
          );
        })
        .sort((a, b) => {
          // Prioritize exact matches
          const aExact = a.label.toLowerCase().includes(searchTerm.toLowerCase());
          const bExact = b.label.toLowerCase().includes(searchTerm.toLowerCase());
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return 0;
        })
        .slice(0, 15);

      setFilteredCommands(filtered);
    }

    setSelectedIndex(0);
  }, [searchTerm, mode, files, fuzzyMatch]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            Math.min(prev + 1, filteredCommands.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchTerm('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const executeCommand = (command) => {
    if (command && command.action) {
      // Add to history
      const history = JSON.parse(localStorage.getItem('commandHistory') || '[]');
      history.unshift(command.id);
      localStorage.setItem('commandHistory', JSON.stringify(history.slice(0, 20)));

      // Execute
      command.action();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-header">
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder={mode === 'file' ? 'Search files...' : 'Type a command or search...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="command-palette-shortcut">
            {mode === 'file' ? 'Ctrl+P' : 'Ctrl+Shift+P'}
          </span>
        </div>

        <div className="command-palette-results">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">
              No {mode === 'file' ? 'files' : 'commands'} found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="command-item-left">
                  <div className="command-item-icon">
                    {cmd.isFile ? '📄' : getCategoryIcon(cmd.category)}
                  </div>
                  <div className="command-item-text">
                    <div className="command-item-label">{cmd.label}</div>
                    <div className="command-item-description">{cmd.description}</div>
                  </div>
                </div>
                {cmd.shortcut && (
                  <div className="command-item-shortcut">{cmd.shortcut}</div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="command-palette-footer">
          <span>↑↓ Navigate</span>
          <span>⏎ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
};

const getCategoryIcon = (category) => {
  const icons = {
    'File': '📁',
    'View': '👁️',
    'Terminal': '⌨️',
    'Sync': '☁️',
    'Search': '🔍',
    'Settings': '⚙️'
  };
  return icons[category] || '⚡';
};

export default CommandPalette;
