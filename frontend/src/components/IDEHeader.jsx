import React, { useState, useRef, useEffect } from 'react';
import { 
  VscFile, VscNewFile, VscFolderOpened, VscSave, VscSaveAll, VscSaveAs,
  VscEdit, VscDiscard, VscRefresh, VscCopy, VscClippy,
  VscChevronDown, VscSearch, VscReplace, VscCaseSensitive,
  VscGear, VscColorMode, VscSettingsGear, VscJson,
  VscTerminal, VscSplitHorizontal, VscLayoutPanel, VscClose,
  VscArrowLeft, VscArrowRight, VscCloudDownload
} from 'react-icons/vsc';
import UserProfile from './UserProfile';
import './IDEHeader.css';

const IDEHeader = ({ onOpenProjects, theme, setTheme, fontSize, setFontSize }) => {
  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };

    if (activeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenu]);

  const toggleMenu = (menuName) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  // File operations
  const handleCreateNewFile = () => {
    const fileName = prompt('Enter new file name (e.g., script.js):');
    if (fileName) {
      document.dispatchEvent(new CustomEvent('create-new-file', { 
        detail: { fileName } 
      }));
    }
  };

  const handleLoadFileFromDevice = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          document.dispatchEvent(new CustomEvent('load-file-from-device', {
            detail: {
              name: file.name,
              content: event.target.result
            }
          }));
        };
        reader.readAsText(file);
      });
    }
    // Reset input
    e.target.value = '';
  };

  const handleSaveAllFiles = () => {
    document.dispatchEvent(new CustomEvent('save-all-files'));
  };

  const handleDownloadCurrentFile = () => {
    document.dispatchEvent(new CustomEvent('download-current-file'));
  };

  const handleDownloadProjectAsZip = async () => {
    try {
      document.dispatchEvent(new CustomEvent('download-project-zip'));
    } catch (error) {
      console.error('Error downloading project:', error);
      alert('Failed to download project as ZIP');
    }
  };

  const handleMenuAction = (action) => {
    setActiveMenu(null);
    
    switch(action) {
      case 'new-file':
        handleCreateNewFile();
        break;
      case 'open-file':
        handleLoadFileFromDevice();
        break;
      case 'open-folder':
        if (onOpenProjects) onOpenProjects();
        break;
      case 'save':
        document.dispatchEvent(new CustomEvent('save-file'));
        break;
      case 'save-all':
        handleSaveAllFiles();
        break;
      case 'download-file':
        handleDownloadCurrentFile();
        break;
      case 'download-project':
        handleDownloadProjectAsZip();
        break;
      case 'undo':
        // Dispatch to Monaco editor
        console.log('🎯 Dispatching monaco-undo event');
        document.dispatchEvent(new CustomEvent('monaco-undo'));
        break;
      case 'redo':
        // Dispatch to Monaco editor
        console.log('🎯 Dispatching monaco-redo event');
        document.dispatchEvent(new CustomEvent('monaco-redo'));
        break;
      case 'cut':
        // Dispatch to Monaco editor
        console.log('🎯 Dispatching monaco-cut event');
        document.dispatchEvent(new CustomEvent('monaco-cut'));
        break;
      case 'copy':
        // Dispatch to Monaco editor
        console.log('🎯 Dispatching monaco-copy event');
        document.dispatchEvent(new CustomEvent('monaco-copy'));
        break;
      case 'paste':
        // Dispatch to Monaco editor
        console.log('🎯 Dispatching monaco-paste event');
        document.dispatchEvent(new CustomEvent('monaco-paste'));
        break;
      case 'find':
        // Dispatch to Monaco editor to open find widget
        console.log('🎯 Dispatching monaco-find event');
        document.dispatchEvent(new CustomEvent('monaco-find'));
        break;
      case 'replace':
        // Dispatch to Monaco editor to open replace widget
        console.log('🎯 Dispatching monaco-replace event');
        document.dispatchEvent(new CustomEvent('monaco-replace'));
        break;
      case 'find-in-files':
        document.dispatchEvent(new CustomEvent('open-workspace-search'));
        break;
      case 'toggle-theme':
        setTheme(theme === 'dark' ? 'light' : 'dark');
        break;
      case 'increase-font':
        setFontSize(Math.min(24, fontSize + 1));
        break;
      case 'decrease-font':
        setFontSize(Math.max(10, fontSize - 1));
        break;
      case 'reset-font':
        setFontSize(14);
        break;
      case 'toggle-sidebar':
        document.dispatchEvent(new CustomEvent('toggle-sidebar'));
        break;
      case 'toggle-terminal':
        document.dispatchEvent(new CustomEvent('toggle-terminal'));
        break;
      case 'toggle-panel':
        document.dispatchEvent(new CustomEvent('toggle-panel'));
        break;
      case 'settings':
        document.dispatchEvent(new CustomEvent('ide-action', { detail: { action: 'open-settings' } }));
        break;
      default:
        console.log('Action:', action);
    }
  };

  const MenuItem = ({ icon: Icon, label, shortcut, action, divider }) => (
    <>
      <div className="menu-item" onClick={() => handleMenuAction(action)}>
        <div className="menu-item-left">
          <Icon className="menu-icon" />
          <span>{label}</span>
        </div>
        {shortcut && <span className="menu-shortcut">{shortcut}</span>}
      </div>
      {divider && <div className="menu-divider" />}
    </>
  );

  return (
    <div className="ide-header-new">
      <div className="ide-header-left">
        <div className="ide-logo">AI - IDE</div>
        
        <div className="ide-menu-bar" ref={menuRef}>
          {/* File Menu */}
          <div className="menu-item-container">
            <button 
              className={`menu-button ${activeMenu === 'file' ? 'active' : ''}`}
              onClick={() => toggleMenu('file')}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div className="menu-dropdown">
                <MenuItem icon={VscNewFile} label="New File" shortcut="Ctrl+N" action="new-file" />
                <MenuItem icon={VscFile} label="Open File from Device..." shortcut="Ctrl+O" action="open-file" />
                <MenuItem icon={VscFolderOpened} label="Open Folder/Project..." shortcut="Ctrl+K Ctrl+O" action="open-folder" divider />
                <MenuItem icon={VscSave} label="Save" shortcut="Ctrl+S" action="save" />
                <MenuItem icon={VscSaveAll} label="Save All Files" shortcut="Ctrl+K S" action="save-all" divider />
                <MenuItem icon={VscCloudDownload} label="Download Current File" action="download-file" />
                <MenuItem icon={VscCloudDownload} label="Download Project as ZIP" action="download-project" divider />
                <MenuItem icon={VscSettingsGear} label="Preferences" action="settings" />
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="menu-item-container">
            <button 
              className={`menu-button ${activeMenu === 'edit' ? 'active' : ''}`}
              onClick={() => toggleMenu('edit')}
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div className="menu-dropdown">
                <MenuItem icon={VscDiscard} label="Undo" shortcut="Ctrl+Z" action="undo" />
                <MenuItem icon={VscRefresh} label="Redo" shortcut="Ctrl+Y" action="redo" divider />
                <MenuItem icon={VscClose} label="Cut" shortcut="Ctrl+X" action="cut" />
                <MenuItem icon={VscCopy} label="Copy" shortcut="Ctrl+C" action="copy" />
                <MenuItem icon={VscClippy} label="Paste" shortcut="Ctrl+V" action="paste" divider />
                <MenuItem icon={VscSearch} label="Find" shortcut="Ctrl+F" action="find" />
                <MenuItem icon={VscReplace} label="Replace" shortcut="Ctrl+H" action="replace" />
                <MenuItem icon={VscCaseSensitive} label="Find in Files" shortcut="Ctrl+Shift+F" action="find-in-files" />
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="menu-item-container">
            <button 
              className={`menu-button ${activeMenu === 'view' ? 'active' : ''}`}
              onClick={() => toggleMenu('view')}
            >
              View
            </button>
            {activeMenu === 'view' && (
              <div className="menu-dropdown">
                <MenuItem icon={VscLayoutPanel} label="Toggle Sidebar" shortcut="Ctrl+B" action="toggle-sidebar" />
                <MenuItem icon={VscTerminal} label="Toggle Terminal" shortcut="Ctrl+`" action="toggle-terminal" />
                <MenuItem icon={VscSplitHorizontal} label="Toggle Panel" shortcut="Ctrl+J" action="toggle-panel" divider />
                <MenuItem icon={VscColorMode} label="Toggle Theme" shortcut="Ctrl+K Ctrl+T" action="toggle-theme" />
              </div>
            )}
          </div>

          {/* Settings Menu */}
          <div className="menu-item-container">
            <button 
              className={`menu-button ${activeMenu === 'settings' ? 'active' : ''}`}
              onClick={() => toggleMenu('settings')}
            >
              Settings
            </button>
            {activeMenu === 'settings' && (
              <div className="menu-dropdown">
                <MenuItem icon={VscColorMode} label="Toggle Theme" action="toggle-theme" divider />
                <div className="menu-item font-size-controls">
                  <div className="menu-item-left">
                    <VscGear className="menu-icon" />
                    <span>Font Size</span>
                  </div>
                  <div className="font-size-buttons">
                    <button className="font-btn" onClick={() => handleMenuAction('decrease-font')}>-</button>
                    <span className="font-size-value">{fontSize}</span>
                    <button className="font-btn" onClick={() => handleMenuAction('increase-font')}>+</button>
                    <button className="font-btn-reset" onClick={() => handleMenuAction('reset-font')}>Reset</button>
                  </div>
                </div>
                <div className="menu-divider" />
                <MenuItem icon={VscJson} label="Open Settings (JSON)" action="settings" />
                <MenuItem icon={VscSettingsGear} label="Settings" action="settings" />
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onOpenProjects}
          className="projects-button"
          title="Open Projects"
        >
          <VscFolderOpened style={{ fontSize: '16px' }} />
          <span>Projects</span>
        </button>
      </div>

      <div className="ide-header-right">
        <UserProfile />
      </div>

      {/* Hidden file input for loading files from device */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
        accept="*/*"
      />
    </div>
  );
};

export default IDEHeader;
