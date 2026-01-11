import React, { useState, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import CodeExecution from './CodeExecution';
import { 
  VscPlay, VscDebugRestart, VscChevronDown, VscChevronUp,
  VscSave, VscCheck, VscWarning
} from 'react-icons/vsc';
import { FileIcon } from './icons/FileIcons';
import './EditorToolbar.css';

const EditorToolbar = () => {
  const { currentFile, currentProject } = useProject();
  const { user } = useAuth();
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Force reload - updated at 20:15
  console.log('EditorToolbar component loaded - v2.0');

  // Get language from current file
  const getLanguageFromFile = (file) => {
    if (!file?.name) return 'javascript';
    const extension = file.name.split('.').pop()?.toLowerCase();
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
      'pl': 'perl',
      'lua': 'lua',
      'swift': 'swift',
      'kt': 'kotlin', 'kts': 'kotlin',
      'scala': 'scala', 'sc': 'scala',
      'r': 'r', 'R': 'r',
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

  const currentLanguage = getLanguageFromFile(currentFile);

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

  const handleRunCode = useCallback(() => {
    if (!currentFile?.content) return;
    
    // Get file extension and determine run command
    const fileName = currentFile.name;
    const ext = fileName.split('.').pop().toLowerCase();
    
    let command = '';
    switch(ext) {
      case 'py':
        command = `python ${fileName}`;
        break;
      case 'js':
      case 'mjs':
        command = `node ${fileName}`;
        break;
      case 'jsx':
        command = `tsx ${fileName}`;
        break;
      case 'ts':
        command = `ts-node ${fileName}`;
        break;
      case 'tsx':
        command = `tsx ${fileName}`;
        break;
      case 'java':
        const className = fileName.replace('.java', '');
        command = `javac ${fileName} && java ${className}`;
        break;
      case 'cpp':
      case 'cc':
      case 'cxx':
        const outFile = fileName.replace(/\.(cpp|cc|cxx)$/, '');
        command = `g++ ${fileName} -o ${outFile} && ./${outFile}`;
        break;
      case 'c':
        const cOutFile = fileName.replace('.c', '');
        command = `gcc ${fileName} -o ${cOutFile} && ./${cOutFile}`;
        break;
      case 'cs':
        const csOutFile = fileName.replace('.cs', '.exe');
        command = `mcs ${fileName} -out:${csOutFile} && mono ${csOutFile}`;
        break;
      case 'go':
        command = `/usr/local/go/bin/go run ${fileName}`;
        break;
      case 'rs':
        const rsOutFile = fileName.replace('.rs', '');
        command = `/root/.cargo/bin/rustc ${fileName} -o ${rsOutFile} && ./${rsOutFile}`;
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
      case 'swift':
        command = `/opt/swift-5.9.1-RELEASE-ubuntu22.04/usr/bin/swift ${fileName}`;
        break;
      case 'html':
      case 'htm':
        // For HTML files, create a preview using blob URL (works without backend)
        if (currentFile && currentFile.content) {
          try {
            console.log('=== HTML PREVIEW DEBUG ===');
            console.log('Current file:', currentFile);
            console.log('File content length:', currentFile.content?.length);
            
            // Create blob from HTML content
            const blob = new Blob([currentFile.content], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);
            
            console.log('Created blob URL:', blobUrl);
            console.log('About to open window...');
            
            // Open in new tab immediately - no setTimeout
            const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
            
            console.log('window.open returned:', newWindow);
            
            if (newWindow) {
              console.log('✅ HTML preview opened successfully');
              command = `echo "✅ Opening ${fileName} in browser..." && echo "HTML preview opened in new tab!" && echo "Blob URL: ${blobUrl}"`;
              
              // Clean up blob URL after a delay
              setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
                console.log('Blob URL cleaned up');
              }, 5000);
            } else {
              console.warn('⚠️ Popup was blocked by browser!');
              alert(`Popup Blocked!\n\nYour browser blocked the HTML preview.\n\nPlease:\n1. Click the popup blocker icon in the address bar\n2. Allow popups from localhost:3000\n3. Try again\n\nOr copy this URL and paste in a new tab:\n${blobUrl}`);
              command = `echo "⚠️  Popup was blocked!" && echo "Please allow popups for this site to preview HTML files." && echo "Blob URL: ${blobUrl}"`;
            }
          } catch (error) {
            console.error('Error creating HTML preview:', error);
            command = `echo "❌ Error creating preview: ${error.message}"`;
          }
        } else if (user && currentProject) {
          console.log('Fallback to backend preview');
          // Fallback to backend preview endpoint
          const userId = user._id || user.id;
          const projectId = currentProject._id || currentProject.id;
          
          if (!userId || !projectId) {
            console.error('Missing IDs:', { userId, projectId });
            command = `echo "❌ Error: Missing user or project ID"`;
            break;
          }
          
          const previewUrl = `http://localhost:3001/api/v1/preview/${userId}/${projectId}?file=${encodeURIComponent(fileName)}`;
          console.log('Using backend preview URL:', previewUrl);
          
          window.open(previewUrl, '_blank', 'noopener,noreferrer');
          command = `echo "✅ Opening ${fileName} in browser..." && echo "Preview URL: ${previewUrl}"`;
        } else {
          console.error('No file content and no user/project for fallback');
          command = `echo "⚠️  Cannot preview: File content not loaded" && cat ${fileName}`;
        }
        break;
      case 'css':
        // Show CSS content with syntax highlighting hint
        command = `echo "=== CSS File: ${fileName} ===" && echo "" && cat ${fileName} && echo "" && echo "---" && echo "💡 Link this CSS in your HTML with:" && echo "<link rel='stylesheet' href='${fileName}'>"`;
        break;
      case 'svg':
        // For SVG, cat the file and suggest opening in browser
        command = `cat ${fileName} && echo "\n---\nTo preview SVG, open in browser or use: python3 -m http.server 8080"`;
        break;
      case 'xml':
        // For XML, show formatted content
        command = `cat ${fileName}`;
        break;
      default:
        console.warn('Unknown file type:', ext);
        return;
    }
    
    // Send command to terminal via custom event
    document.dispatchEvent(new CustomEvent('run-in-terminal', { 
      detail: { command } 
    }));
    
    // Switch to terminal tab
    document.dispatchEvent(new CustomEvent('show-terminal'));
  }, [currentFile, currentProject]);

  const handleExecutionStart = useCallback(() => {
    setIsExecuting(true);
  }, []);

  const handleExecutionComplete = useCallback((result) => {
    setIsExecuting(false);
    console.log('Execution completed:', result);
  }, []);

  if (!currentFile) return null;

  return (
    <>
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <div className="file-info">
            <span className="file-icon"><FileIcon file={currentFile} size={16} /></span>
            <span className="file-name">{currentFile.name}</span>
            <span className="file-path">{currentFile.path || '/'}</span>
          </div>
        </div>

        <div className="toolbar-right">
          {isExecutableFile(currentFile) && (
            <button
              className="toolbar-btn run-button"
              onClick={handleRunCode}
              disabled={!currentFile.content?.trim() || !user}
              title={`Run ${currentLanguage} (Shift+F10)`}
            >
              <VscPlay style={{ fontSize: '14px' }} />
              <span className="btn-text">Run</span>
            </button>
          )}

          <button
            className="toolbar-btn format-button"
            onClick={() => {
              const formatEvent = new CustomEvent('monaco-format-document');
              window.dispatchEvent(formatEvent);
            }}
            title="Format Document (Shift+Alt+F)"
          >
            <VscCheck style={{ fontSize: '14px' }} />
          </button>

          <button
            className="toolbar-btn save-button"
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
        </div>
      </div>

      {/* Execution Panel */}
      {showExecutionPanel && isExecutableFile(currentFile) && (
        <div className="execution-panel">
          <div className="execution-panel-header">
            <span className="panel-title">Code Execution - {currentLanguage}</span>
            <button
              className="close-panel"
              onClick={() => setShowExecutionPanel(false)}
              title="Close execution panel"
            >
              ✕
            </button>
          </div>
          <div className="execution-panel-content">
            <CodeExecution
              code={currentFile.content || ''}
              language={currentLanguage}
              projectId={currentProject?.id || currentProject?._id}
              files={[{
                name: currentFile.name,
                content: currentFile.content || ''
              }]}
              onExecutionStart={handleExecutionStart}
              onExecutionComplete={handleExecutionComplete}
              className="toolbar-code-execution"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default EditorToolbar;