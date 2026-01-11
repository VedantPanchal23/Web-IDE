import { useState, useEffect, useCallback, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  VscFileCode, VscClose, VscCircleFilled,
  VscJson, VscMarkdown, VscFile,
  VscPlay, VscSave, VscCheck
} from 'react-icons/vsc';
import { 
  SiJavascript, SiTypescript, SiPython, 
  SiCplusplus, SiC, SiPhp, SiSwift, SiRust,
  SiGo, SiRuby, SiHtml5, SiCss3, SiDocker
} from 'react-icons/si';
import { FileIcon } from './icons/FileIcons';

const FileTabManager = ({ theme = 'dark' }) => {
  const { openTabs, currentFile, setCurrentFile, closeTab, moveTab, hasUnsavedChanges, saveFileContent, currentProject } = useProject();
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const tabsRef = useRef([]);

  // Listen for save commands from header menu
  useEffect(() => {
    const handleSaveFile = () => {
      if (currentFile) {
        // Dispatch to Monaco editor to save
        window.dispatchEvent(new CustomEvent('monaco-save-file', { 
          detail: { fileId: currentFile.id } 
        }));
      }
    };

    const handleSaveAllFiles = async () => {
      if (openTabs.length === 0) return;
      
      for (const file of openTabs) {
        if (hasUnsavedChanges(file.id)) {
          // Dispatch save event for each unsaved file
          window.dispatchEvent(new CustomEvent('monaco-save-file', { 
            detail: { fileId: file.id } 
          }));
          // Small delay between saves
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      console.log(`✅ Saved ${openTabs.filter(f => hasUnsavedChanges(f.id)).length} file(s)`);
    };

    document.addEventListener('save-file', handleSaveFile);
    document.addEventListener('save-all-files', handleSaveAllFiles);

    return () => {
      document.removeEventListener('save-file', handleSaveFile);
      document.removeEventListener('save-all-files', handleSaveAllFiles);
    };
  }, [currentFile, openTabs, hasUnsavedChanges]);

  // Check if file is executable
  const isExecutableFile = (file) => {
    if (!file?.name) return false;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const executableExtensions = [
      'js', 'jsx', 'mjs', 'ts', 'tsx',          // JavaScript/TypeScript
      'py', 'pyx', 'pyi',                        // Python
      'java',                                     // Java
      'c', 'cpp', 'cc', 'cxx', 'h',              // C/C++
      'cs',                                       // C#
      'go',                                       // Go
      'rs',                                       // Rust
      'rb',                                       // Ruby
      'php',                                      // PHP
      'pl',                                       // Perl
      'lua',                                      // Lua
      'swift',                                    // Swift
      'kt', 'kts',                                // Kotlin
      'scala', 'sc',                              // Scala
      'R', 'r',                                   // R
      'ex', 'exs',                                // Elixir
      'erl',                                      // Erlang
      'hs', 'lhs',                                // Haskell
      'dart',                                     // Dart
      'groovy',                                   // Groovy
      'sh', 'bash',                               // Bash
      'html', 'htm',                              // HTML
      'css',                                      // CSS
      'svg',                                      // SVG
      'xml'                                       // XML
    ];
    return executableExtensions.includes(extension);
  };

  // Get language from file
  const getLanguageFromFile = (file) => {
    if (!file?.name) return 'javascript';
    const extension = file.name.split('.').pop()?.toLowerCase();
    const languageMap = {
      'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript',
      'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'pyx': 'python', 'pyi': 'python',
      'java': 'java',
      'c': 'c', 'h': 'c',
      'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'pl': 'perl',
      'lua': 'lua',
      'swift': 'swift',
      'kt': 'kotlin', 'kts': 'kotlin',
      'scala': 'scala', 'sc': 'scala',
      'R': 'r', 'r': 'r',
      'ex': 'elixir', 'exs': 'elixir',
      'erl': 'erlang',
      'hs': 'haskell', 'lhs': 'haskell',
      'dart': 'dart',
      'groovy': 'groovy',
      'sh': 'bash', 'bash': 'bash',
      'html': 'html', 'htm': 'html',
      'css': 'css',
      'svg': 'svg',
      'xml': 'xml'
    };
    return languageMap[extension] || 'javascript';
  };

  const handleRunCode = useCallback(() => {
    if (!currentFile?.content) return;
    const fileName = currentFile.name;
    const ext = fileName.split('.').pop().toLowerCase();
    
    let command = '';
    switch(ext) {
      case 'py':
      case 'pyx':
      case 'pyi':
        command = `python ${fileName}`;
        break;
      case 'js':
      case 'mjs':
        command = `node ${fileName}`;
        break;
      case 'ts':
      case 'tsx':
        command = `ts-node ${fileName}`;
        break;
      case 'java':
        const javaClass = fileName.replace('.java', '');
        command = `javac ${fileName} && java ${javaClass}`;
        break;
      case 'cpp':
      case 'cc':
      case 'cxx':
        const cppOut = fileName.replace(/\.(cpp|cc|cxx)$/, '');
        command = `g++ ${fileName} -o ${cppOut} && ./${cppOut}`;
        break;
      case 'c':
        const cOut = fileName.replace('.c', '');
        command = `gcc ${fileName} -o ${cOut} && ./${cOut}`;
        break;
      case 'cs':
        command = `mcs ${fileName} && mono ${fileName.replace('.cs', '.exe')}`;
        break;
      case 'go':
        command = `/usr/local/go/bin/go run ${fileName}`;
        break;
      case 'rs':
        const rsOut = fileName.replace('.rs', '');
        command = `/root/.cargo/bin/rustc ${fileName} -o ${rsOut} && ./${rsOut}`;
        break;
      case 'rb':
        command = `ruby ${fileName}`;
        break;
      case 'php':
        command = `php ${fileName}`;
        break;
      case 'pl':
        command = `perl ${fileName}`;
        break;
      case 'lua':
        command = `lua ${fileName}`;
        break;
      case 'swift':
        command = `/opt/swift-5.9.1-RELEASE-ubuntu22.04/usr/bin/swift ${fileName}`;
        break;
      case 'kt':
      case 'kts':
        const ktJar = fileName.replace(/\.(kt|kts)$/, '.jar');
        command = `/root/.sdkman/candidates/kotlin/current/bin/kotlinc ${fileName} -include-runtime -d ${ktJar} && java -jar ${ktJar}`;
        break;
      case 'scala':
      case 'sc':
        command = `scala ${fileName}`;
        break;
      case 'R':
      case 'r':
        command = `Rscript ${fileName}`;
        break;
      case 'ex':
      case 'exs':
        command = `elixir ${fileName}`;
        break;
      case 'erl':
        command = `escript ${fileName}`;
        break;
      case 'hs':
      case 'lhs':
        command = `/root/.ghcup/bin/runhaskell ${fileName}`;
        break;
      case 'dart':
        command = `dart run ${fileName}`;
        break;
      case 'groovy':
        command = `groovy ${fileName}`;
        break;
      case 'sh':
      case 'bash':
        command = `bash ${fileName}`;
        break;
      case 'html':
      case 'htm':
        // Open HTML file in new tab using blob URL
        console.log('=== HTML PREVIEW (FileTabManager) ===');
        console.log('Opening HTML file:', fileName);
        console.log('File content length:', currentFile.content?.length);
        
        try {
          const blob = new Blob([currentFile.content], { type: 'text/html' });
          const blobUrl = URL.createObjectURL(blob);
          console.log('Created blob URL:', blobUrl);
          
          const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
          
          if (newWindow) {
            console.log('✅ HTML preview opened successfully!');
            command = `echo "✅ Opening ${fileName} in browser..." && echo "HTML file opened in new tab!" && echo "Blob URL: ${blobUrl}"`;
            
            // Cleanup after 5 seconds
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
          } else {
            console.warn('⚠️ Popup blocked!');
            alert(`Popup Blocked!\n\nYour browser blocked the HTML preview.\n\nPlease:\n1. Allow popups for localhost:3000\n2. Try again\n\nOr manually open: ${blobUrl}`);
            command = `echo "⚠️ Popup blocked!" && echo "Please allow popups and try again." && echo "Blob URL: ${blobUrl}"`;
          }
        } catch (error) {
          console.error('Error opening HTML:', error);
          command = `echo "❌ Error: ${error.message}"`;
        }
        break;
      case 'css':
        command = `echo "=== CSS File: ${fileName} ===" && cat ${fileName}`;
        break;
      case 'svg':
      case 'xml':
        command = `cat ${fileName}`;
        break;
      default:
        return;
    }
    
    document.dispatchEvent(new CustomEvent('run-in-terminal', { detail: { command } }));
    document.dispatchEvent(new CustomEvent('show-terminal'));
  }, [currentFile]);

  // Handle tab click
  const handleTabClick = useCallback((file) => {
    setCurrentFile(file);
  }, [setCurrentFile]);

  // Handle tab close
  const handleTabClose = useCallback(async (e, file) => {
    e.stopPropagation();
    
    // Check for unsaved changes
    if (hasUnsavedChanges(file.id)) {
      const result = window.confirm(
        `The file "${file.metadata?.name || 'Untitled'}" has unsaved changes. Do you want to save before closing?\n\nClick OK to save and close, Cancel to close without saving.`
      );
      
      if (result) {
        // Save the file before closing
        try {
          // For the current file, get content from the editor
          // For other files, use the stored content (this is a simplification)
          let contentToSave = file.content;
          if (currentFile && currentFile.id === file.id) {
            // If this is the currently active file, we need to get the content from the editor
            // This is handled by the editor's save functionality, so we'll dispatch a save event
            const saveEvent = new CustomEvent('monaco-save-file', { detail: { fileId: file.id } });
            window.dispatchEvent(saveEvent);
            // Wait a moment for the save to complete
            await new Promise(resolve => setTimeout(resolve, 200));
          } else {
            // For non-current files, save the stored content
            await saveFileContent(file.id, contentToSave);
          }
        } catch (error) {
          console.error('Failed to save file:', error);
          // Still close the tab even if save fails, but show error
          alert(`Failed to save file: ${error.message}`);
        }
      }
    }
    
    closeTab(file.id);
  }, [closeTab, hasUnsavedChanges, saveFileContent]);

  // Handle middle-click to close tab
  const handleTabMouseDown = useCallback((e, file) => {
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      handleTabClose(e, file);
    }
  }, [handleTabClose]);

  // Drag and drop functionality
  const handleDragStart = useCallback((e, index) => {
    setDraggedTab(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback((e) => {
    // Only clear drag over if we're leaving the tab area entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    
    if (draggedTab !== null && draggedTab !== dropIndex) {
      moveTab(draggedTab, dropIndex);
    }
    
    setDraggedTab(null);
    setDragOverIndex(null);
  }, [draggedTab, moveTab]);

  const handleDragEnd = useCallback(() => {
    setDraggedTab(null);
    setDragOverIndex(null);
  }, []);

  // Handle Ctrl+Tab cycling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        
        if (!openTabs || openTabs.length === 0) return;
        
        const currentIndex = openTabs.findIndex(tab => tab.id === currentFile?.id);
        let nextIndex;
        
        if (e.shiftKey) {
          // Ctrl+Shift+Tab - previous tab
          nextIndex = currentIndex <= 0 ? openTabs.length - 1 : currentIndex - 1;
        } else {
          // Ctrl+Tab - next tab
          nextIndex = currentIndex >= openTabs.length - 1 ? 0 : currentIndex + 1;
        }
        
        setCurrentFile(openTabs[nextIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openTabs, currentFile, setCurrentFile]);

  // Get file icon based on extension
  const getFileIcon = useCallback((filename) => {
    const extension = filename?.split('.').pop()?.toLowerCase();
    const iconStyle = { fontSize: '16px' };
    
    const iconMap = {
      // JavaScript/TypeScript
      'js': <SiJavascript style={{ ...iconStyle, color: '#f7df1e' }} />,
      'jsx': <SiJavascript style={{ ...iconStyle, color: '#61dafb' }} />,
      'ts': <SiTypescript style={{ ...iconStyle, color: '#3178c6' }} />,
      'tsx': <SiTypescript style={{ ...iconStyle, color: '#3178c6' }} />,
      'mjs': <SiJavascript style={{ ...iconStyle, color: '#f7df1e' }} />,
      
      // Python
      'py': <SiPython style={{ ...iconStyle, color: '#3776ab' }} />,
      'pyx': <SiPython style={{ ...iconStyle, color: '#3776ab' }} />,
      'pyi': <SiPython style={{ ...iconStyle, color: '#3776ab' }} />,
      
      // Web
      'html': <SiHtml5 style={{ ...iconStyle, color: '#e34f26' }} />,
      'htm': <SiHtml5 style={{ ...iconStyle, color: '#e34f26' }} />,
      'css': <SiCss3 style={{ ...iconStyle, color: '#1572b6' }} />,
      'scss': <SiCss3 style={{ ...iconStyle, color: '#cc6699' }} />,
      'sass': <SiCss3 style={{ ...iconStyle, color: '#cc6699' }} />,
      'less': <SiCss3 style={{ ...iconStyle, color: '#1d365d' }} />,
      
      // JSON/Config
      'json': <VscJson style={{ ...iconStyle, color: '#f7df1e' }} />,
      'jsonc': <VscJson style={{ ...iconStyle, color: '#f7df1e' }} />,
      
      // Markdown
      'md': <VscMarkdown style={{ ...iconStyle, color: '#ffffff' }} />,
      'markdown': <VscMarkdown style={{ ...iconStyle, color: '#ffffff' }} />,
      
      // C/C++
      'c': <SiC style={{ ...iconStyle, color: '#a8b9cc' }} />,
      'h': <SiC style={{ ...iconStyle, color: '#a8b9cc' }} />,
      'cpp': <SiCplusplus style={{ ...iconStyle, color: '#00599c' }} />,
      'cc': <SiCplusplus style={{ ...iconStyle, color: '#00599c' }} />,
      'cxx': <SiCplusplus style={{ ...iconStyle, color: '#00599c' }} />,
      'hpp': <SiCplusplus style={{ ...iconStyle, color: '#00599c' }} />,
      
      // Java
      'java': <VscFileCode style={{ ...iconStyle, color: '#ed8b00' }} />,
      'class': <VscFileCode style={{ ...iconStyle, color: '#ed8b00' }} />,
      
      // Other languages
      'php': <SiPhp style={{ ...iconStyle, color: '#777bb4' }} />,
      'swift': <SiSwift style={{ ...iconStyle, color: '#fa7343' }} />,
      'rs': <SiRust style={{ ...iconStyle, color: '#ce422b' }} />,
      'go': <SiGo style={{ ...iconStyle, color: '#00add8' }} />,
      'rb': <SiRuby style={{ ...iconStyle, color: '#cc342d' }} />,
      
      // Docker
      'dockerfile': <SiDocker style={{ ...iconStyle, color: '#2496ed' }} />,
      
      // Default
      'txt': <VscFileCode style={{ ...iconStyle, color: '#cccccc' }} />,
    };
    
    return iconMap[extension] || <VscFile style={{ ...iconStyle, color: '#cccccc' }} />;
  }, []);

  if (!openTabs || openTabs.length === 0) {
    return <div className={`ide-tab-bar ${theme === 'light' ? 'theme-light' : ''}`}></div>;
  }

  return (
    <div className={`ide-tab-bar ${theme === 'light' ? 'theme-light' : ''}`}>
      {/* File Tabs */}
      {openTabs.map((file, index) => (
        <div
          key={file.id}
          ref={el => tabsRef.current[index] = el}
          className={`tab ${currentFile?.id === file.id ? 'active' : ''} ${
            dragOverIndex === index ? 'drag-over' : ''
          }`}
          onClick={() => handleTabClick(file)}
          onMouseDown={(e) => handleTabMouseDown(e, file)}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
        >
          <span className="tab-icon">
            {getFileIcon(file.metadata?.name)}
          </span>
          <span className="tab-name">
            {file.metadata?.name || 'Untitled'}
          </span>
          {hasUnsavedChanges(file.id) ? (
            <VscCircleFilled 
              className="tab-unsaved-indicator" 
              style={{ fontSize: '10px', color: '#ffffff' }}
              title="Unsaved changes"
            />
          ) : (
            <VscClose
              className="tab-close-button"
              onClick={(e) => handleTabClose(e, file)}
              title="Close (Ctrl+W)"
              style={{ fontSize: '16px' }}
            />
          )}
        </div>
      ))}
      
      {/* Toolbar Actions */}
      <div className="tab-bar-actions">
        {currentFile && isExecutableFile(currentFile) && (
          <button
            className="tab-bar-btn run-btn"
            onClick={handleRunCode}
            disabled={!currentFile.content?.trim()}
            title={`Run ${getLanguageFromFile(currentFile)}`}
          >
            <VscPlay style={{ fontSize: '14px' }} />
            <span className="btn-text">Run</span>
          </button>
        )}
        
        {currentFile && (
          <>
            <button
              className="tab-bar-btn"
              onClick={() => {
                const formatEvent = new CustomEvent('monaco-format-document');
                window.dispatchEvent(formatEvent);
              }}
              title="Format Document (Shift+Alt+F)"
            >
              <VscCheck style={{ fontSize: '14px' }} />
            </button>
            
            <button
              className="tab-bar-btn"
              onClick={() => {
                const saveEvent = new CustomEvent('monaco-save-file', {
                  detail: { fileId: currentFile.id }
                });
                window.dispatchEvent(saveEvent);
              }}
              title="Save (Ctrl+S)"
            >
              <VscSave style={{ fontSize: '14px' }} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default FileTabManager;