import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import monaco from '../monaco-config';
import { useProject } from '../context/ProjectContext';
import aiCompletionProvider from '../services/aiCompletionProvider';
import { registerAIContextMenu, setupCommentDetection } from '../services/aiContextMenu';

// Language detection from file extensions
const getLanguageFromExtension = (filename) => {
  const extension = filename?.split('.').pop()?.toLowerCase();
  const languageMap = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'javascript',
    'mjs': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    
    // Python
    'py': 'python',
    'pyx': 'python',
    'pyi': 'python',
    'pyw': 'python',
    
    // Web technologies
    'html': 'html',
    'htm': 'html',
    'xhtml': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    
    // Data formats
    'json': 'json',
    'jsonc': 'json',
    'xml': 'xml',
    'yml': 'yaml',
    'yaml': 'yaml',
    
    // Documentation
    'md': 'markdown',
    'markdown': 'markdown',
    'txt': 'plaintext',
    'text': 'plaintext',
    
    // Shell/Scripts
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',
    'bat': 'bat',
    'cmd': 'bat',
    'ps1': 'powershell',
    
    // C/C++ languages
    'c': 'c',
    'h': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'hpp': 'cpp',
    'hh': 'cpp',
    'hxx': 'cpp',
    
    // Java
    'java': 'java',
    'class': 'java',
    
    // Other popular languages
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'sql': 'sql',
    'r': 'r',
    'swift': 'swift',
    'kt': 'kotlin',
    'kts': 'kotlin',
    'scala': 'scala',
    'sc': 'scala',
    'dart': 'dart',
    'lua': 'lua',
    'perl': 'perl',
    'pl': 'perl',
    'pm': 'perl',
    
    // Functional languages
    'hs': 'haskell',
    'lhs': 'haskell',
    'elm': 'elm',
    'ex': 'elixir',
    'exs': 'elixir',
    'erl': 'erlang',
    'clj': 'clojure',
    'cljs': 'clojure',
    'cljc': 'clojure',
    'ml': 'ocaml',
    'mli': 'ocaml',
    'fs': 'fsharp',
    'fsi': 'fsharp',
    'fsx': 'fsharp',
    
    // JVM languages
    'groovy': 'groovy',
    'gradle': 'groovy',
    
    // System languages
    'zig': 'zig',
    'v': 'v',
    
    // Configuration files
    'ini': 'ini',
    'cfg': 'ini',
    'conf': 'ini',
    'dockerfile': 'dockerfile',
    'dockerignore': 'dockerfile'
  };
  return languageMap[extension] || 'plaintext';
};

export default forwardRef(function EnhancedMonacoEditor({ 
  height = '100%',
  theme = 'vs-dark',
  fontSize = 14,
  fontFamily = 'JetBrains Mono, Cascadia Code, Fira Code, Consolas, Courier New, monospace',
  autoSave = true,
  autoSaveDelay = 2000,
  file = null, // Optional file prop for split editor
  onScroll = null // Optional scroll callback for split editor
}, ref) {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const modelRef = useRef(null);
  const isInitializedRef = useRef(false);
  const disposalTracker = useRef(new Set());
  const isDisposingRef = useRef(false);
  const currentFileRef = useRef(null);
  const contextRef = useRef(null);
  const isInitializingRef = useRef(false);
  const loadedFileIdRef = useRef(null);
  
  const { 
    currentFile, 
    saveFileContent, 
    syncStatus, 
    currentProject,
    setError,
    setUnsavedChanges
  } = useProject();

  // Use file prop if provided (for split editor), otherwise use context
  const activeFile = file || currentFile;

  // Keep context ref updated with latest values
  contextRef.current = { currentFile: activeFile, currentProject, saveFileContent, setError, setUnsavedChanges };
  
  // Expose methods to parent component (for split editor)
  useImperativeHandle(ref, () => ({
    syncScroll: (scrollTop, scrollLeft) => {
      if (editorRef.current) {
        editorRef.current.setScrollPosition({ scrollTop, scrollLeft });
      }
    },
    getEditor: () => editorRef.current
  }));

  // Debug context values (reduced logging)
  useEffect(() => {
    // Only log if both are missing (initialization issue)
    if (!currentProject && !activeFile) {
      console.log('Monaco Editor - Waiting for context');
    }
  }, [currentProject, activeFile]);

  const [editorState, setEditorState] = useState({
    isLoading: false,
    hasUnsavedChanges: false,
    language: 'javascript',
    isInitializing: true // Prevent auto-save during initialization
  });

  // Enhanced safe disposal helper with tracking
  const safeDispose = useCallback((resource, resourceId = null) => {
    if (!resource || isDisposingRef.current) return;
    
    // Generate a unique ID for tracking if not provided
    const id = resourceId || `resource_${Date.now()}_${Math.random()}`;
    
    // Skip if already disposed
    if (disposalTracker.current.has(id)) return;
    
    try {
      // Check various disposal states
      if (resource.isDisposed === true || resource._isDisposed === true) {
        disposalTracker.current.add(id);
        return;
      }
      
      if (typeof resource.dispose === 'function') {
        disposalTracker.current.add(id);
        
        // Get container before disposal for Monaco editors
        let container = null;
        if (resource.getDomNode && typeof resource.getDomNode === 'function') {
          try {
            container = resource.getDomNode()?.parentElement;
          } catch (e) {
            // Ignore errors getting DOM node
          }
        }
        
        resource.dispose();
        
        // Clean up container after disposal for Monaco editors
        if (container) {
          try {
            container.removeAttribute('data-keybinding-context');
            container.removeAttribute('data-mode-id');
            container.innerHTML = '';
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
    } catch (error) {
      // Completely silence disposal errors in development
      // These are expected in React Strict Mode
    }
  }, []);

  // Debounced save function
  const debouncedSave = useCallback((content) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      // Get fresh context values from ref
      const fresh = contextRef.current;
      
      if (currentFileRef.current && autoSave && fresh.currentProject && !isInitializingRef.current) {
        const currentContent = editorRef.current?.getValue() || '';
        try {
          await fresh.saveFileContent(currentFileRef.current.id, currentContent);
          setEditorState(prev => ({ ...prev, hasUnsavedChanges: false }));
          fresh.setUnsavedChanges(currentFileRef.current.id, false);
        } catch (error) {
          console.error('Auto-save failed:', error);
          fresh.setError && fresh.setError('Auto-save failed: ' + error.message);
        }
      }
    }, autoSaveDelay);
  }, [autoSave, autoSaveDelay, editorState.isInitializing]);

  // Manual save function
  const handleSave = useCallback(async () => {
    // Get fresh context values from ref
    const fresh = contextRef.current;
    
    if (!currentFileRef.current || !editorRef.current || !fresh.currentProject) {
      if (!fresh.currentProject) {
        fresh.setError && fresh.setError('No project selected. Please select a project to save files.');
      }
      return;
    }
    
    try {
      const content = editorRef.current?.getValue() || '';
      await fresh.saveFileContent(currentFileRef.current.id, content);
      setEditorState(prev => ({ ...prev, hasUnsavedChanges: false }));
      fresh.setUnsavedChanges(currentFileRef.current.id, false);
    } catch (error) {
      console.error('Manual save failed:', error);
      fresh.setError && fresh.setError('Save failed: ' + error.message);
    }
  }, []); // No dependencies needed since we use contextRef

  // Handle Edit menu actions - separate effect that stays active
  useEffect(() => {
    const handleUndo = () => {
      console.log('📝 Undo triggered');
      const editor = editorRef.current;
      if (editor && !editor._disposed) {
        editor.focus();
        editor.trigger('keyboard', 'undo', null);
      } else {
        console.warn('⚠️ Editor not available for undo');
      }
    };

    const handleRedo = () => {
      console.log('📝 Redo triggered');
      const editor = editorRef.current;
      if (editor && !editor._disposed) {
        editor.focus();
        editor.trigger('keyboard', 'redo', null);
      } else {
        console.warn('⚠️ Editor not available for redo');
      }
    };

    const handleCut = () => {
      console.log('✂️ Cut triggered');
      const editor = editorRef.current;
      if (editor && !editor._disposed) {
        editor.focus();
        // Use browser's native cut functionality
        document.execCommand('cut');
      } else {
        console.warn('⚠️ Editor not available for cut');
      }
    };

    const handleCopy = () => {
      console.log('📋 Copy triggered');
      const editor = editorRef.current;
      if (editor && !editor._disposed) {
        editor.focus();
        // Use browser's native copy functionality
        document.execCommand('copy');
      } else {
        console.warn('⚠️ Editor not available for copy');
      }
    };

    const handlePaste = () => {
      console.log('📋 Paste triggered');
      const editor = editorRef.current;
      if (editor && !editor._disposed) {
        editor.focus();
        // Use browser's native paste functionality
        document.execCommand('paste');
      } else {
        console.warn('⚠️ Editor not available for paste');
      }
    };

    const handleFind = () => {
      console.log('🔍 Find triggered');
      const editor = editorRef.current;
      if (editor && !editor._disposed) {
        editor.focus();
        editor.trigger('keyboard', 'actions.find', null);
      } else {
        console.warn('⚠️ Editor not available for find');
      }
    };

    const handleReplace = () => {
      console.log('🔄 Replace triggered');
      const editor = editorRef.current;
      if (editor && !editor._disposed) {
        editor.focus();
        editor.trigger('keyboard', 'editor.action.startFindReplaceAction', null);
      } else {
        console.warn('⚠️ Editor not available for replace');
      }
    };

    const handleSelectAll = () => {
      console.log('📝 Select All triggered');
      const editor = editorRef.current;
      if (editor && !editor._disposed) {
        editor.focus();
        editor.trigger('keyboard', 'editor.action.selectAll', null);
      } else {
        console.warn('⚠️ Editor not available for select all');
      }
    };

    // Add all event listeners
    document.addEventListener('monaco-undo', handleUndo);
    document.addEventListener('monaco-redo', handleRedo);
    document.addEventListener('monaco-cut', handleCut);
    document.addEventListener('monaco-copy', handleCopy);
    document.addEventListener('monaco-paste', handlePaste);
    document.addEventListener('monaco-find', handleFind);
    document.addEventListener('monaco-replace', handleReplace);
    document.addEventListener('monaco-select-all', handleSelectAll);

    // Cleanup
    return () => {
      document.removeEventListener('monaco-undo', handleUndo);
      document.removeEventListener('monaco-redo', handleRedo);
      document.removeEventListener('monaco-cut', handleCut);
      document.removeEventListener('monaco-copy', handleCopy);
      document.removeEventListener('monaco-paste', handlePaste);
      document.removeEventListener('monaco-find', handleFind);
      document.removeEventListener('monaco-replace', handleReplace);
      document.removeEventListener('monaco-select-all', handleSelectAll);
    };
  }, []); // Empty dependencies - set up once and keep active

  // Initialize Monaco Editor - only once
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) {
      return;
    }

    isInitializedRef.current = true;

    try {
      // Configure Monaco themes - VS Code Dark Theme
      monaco.editor.defineTheme('ai-ide-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6A9955' },
          { token: 'keyword', foreground: '569CD6' },
          { token: 'string', foreground: 'CE9178' },
          { token: 'number', foreground: 'B5CEA8' },
          { token: 'type', foreground: '4EC9B0' },
          { token: 'identifier', foreground: '9CDCFE' },
          { token: 'delimiter', foreground: 'D4D4D4' },
        ],
        colors: {
          'editor.background': '#1E1E1E',
          'editor.foreground': '#D4D4D4',
          'editorCursor.foreground': '#AEAFAD',
          'editor.lineHighlightBackground': '#2A2D2E',
          'editorLineNumber.foreground': '#858585',
          'editorLineNumber.activeForeground': '#C6C6C6',
          'editor.selectionBackground': '#264F78',
          'editor.inactiveSelectionBackground': '#3A3D41',
          'editorIndentGuide.background': '#404040',
          'editorIndentGuide.activeBackground': '#707070',
          'editorWhitespace.foreground': '#404040'
        }
      });

      monaco.editor.defineTheme('ai-ide-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '008000' },
          { token: 'keyword', foreground: '0000FF' },
          { token: 'string', foreground: 'A31515' },
          { token: 'number', foreground: '098658' },
          { token: 'type', foreground: '267F99' },
        ],
        colors: {
          'editor.background': '#ffffff',
          'editor.foreground': '#24292f',
        }
      });

      // Clean up any existing Monaco elements to prevent context conflicts
      if (containerRef.current) {
        // Remove all Monaco-related attributes that could cause conflicts
        const attributesToRemove = [
          'data-keybinding-context',
          'data-mode-id',
          'data-editor-id',
          'data-uri',
          'monaco-aria-container',
          'role',
          'aria-label',
          'aria-describedby'
        ];
        
        attributesToRemove.forEach(attr => {
          try {
            containerRef.current.removeAttribute(attr);
          } catch (e) {
            // Ignore attribute removal errors
          }
        });
        
        // Clear any existing content and nested elements
        try {
          containerRef.current.innerHTML = '';
          // Also remove any Monaco-specific classes
          containerRef.current.className = containerRef.current.className
            .split(' ')
            .filter(cls => !cls.includes('monaco') && !cls.includes('editor'))
            .join(' ');
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Validate container before creating editor
      if (!containerRef.current || !containerRef.current.isConnected) {
        console.warn('Container not ready for Monaco editor creation');
        return;
      }

      // Create the editor
      const editor = monaco.editor.create(containerRef.current, {
        value: '',
        language: 'javascript',
        theme: theme === 'light' ? 'ai-ide-light' : 'ai-ide-dark',
        fontSize: fontSize,
        fontFamily: fontFamily,
        fontLigatures: true,
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        minimap: { enabled: true },
        wordWrap: 'on',
        
        // Code folding and bracket matching
        folding: true,
        foldingHighlight: true,
        foldingImportsByDefault: false,
        matchBrackets: 'always',
        bracketPairColorization: { enabled: true },
        
        // Auto-indentation
        autoIndent: 'full',
        formatOnPaste: true,
        formatOnType: true,
        insertSpaces: true,
        tabSize: 2,
        detectIndentation: true,
        
        // Find and replace with regex support - positioned at top for better visibility
        find: {
          addExtraSpaceOnTop: true,
          autoFindInSelection: 'never',
          seedSearchStringFromSelection: 'always',
          globalFindClipboard: false,
          loop: true
        },
        
        // Multiple file support and VS Code features
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        glyphMargin: false,
        contextmenu: true,
        mouseWheelZoom: true,
        multiCursorModifier: 'ctrlCmd',
        selectionClipboard: false,
        
        // Language features
        codeLens: true,
        colorDecorators: true,
        links: true,
        
        // Suggestions and IntelliSense
        suggest: {
          showIcons: true,
          showSnippets: true,
          showWords: true,
          showMethods: true,
          showFunctions: true,
          showConstructors: true,
          showFields: true,
          showVariables: true,
          showClasses: true,
          showStructs: true,
          showInterfaces: true,
          showModules: true,
          showProperties: true,
          showEvents: true,
          showOperators: true,
          showUnits: true,
          showValues: true,
          showConstants: true,
          showEnums: true,
          showEnumMembers: true,
          showKeywords: true,
          showText: true,
          showColors: true,
          showFiles: true,
          showReferences: true,
          showFolders: true,
          showTypeParameters: true,
          filterGraceful: true,
          snippetsPreventQuickSuggestions: false
        },
        
        // Quick suggestions
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false
        },
        quickSuggestionsDelay: 100,
        
        // Parameter hints
        parameterHints: { enabled: true },
        
        // Hover
        hover: { enabled: true },
        
        // Additional VS Code-like features
        acceptSuggestionOnCommitCharacter: true,
        acceptSuggestionOnEnter: 'on',
        accessibilitySupport: 'auto',
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoSurround: 'languageDefined',
        dragAndDrop: true,
        emptySelectionClipboard: true,
        copyWithSyntaxHighlighting: true
      });

      editorRef.current = editor;

      // Setup AI code completion (like GitHub Copilot) - with delay to ensure model is ready
      let aiDisposable = null;
      let aiContextMenuDisposable = null;
      let commentDetectionDisposable = null;
      
      // Wait for next tick to ensure editor model is fully initialized
      setTimeout(() => {
        try {
          // Check if editor and model are still valid
          if (!editor.getModel() || editor.getModel().isDisposed()) {
            console.warn('Editor model not ready for AI setup');
            return;
          }
          
          const language = getLanguageFromExtension(currentFile?.name);
          const filePath = currentFile?.path || currentFile?.name;
          
          // Inline AI completion
          aiDisposable = aiCompletionProvider.setupAutoCompletion(editor, language, filePath);
          
          // AI context menu actions (right-click)
          aiContextMenuDisposable = registerAIContextMenu(editor, monaco);
          
          // Comment detection for code generation (lightbulb)
          commentDetectionDisposable = setupCommentDetection(editor, monaco);
          
          console.log('✨ AI features enabled: completion, context menu, comment detection');
        } catch (error) {
          console.warn('AI features setup failed:', error.message);
        }
      }, 100);

      // Add scroll event listener for split editor sync
      if (onScroll) {
        const scrollDisposable = editor.onDidScrollChange((e) => {
          onScroll(e.scrollTop, e.scrollLeft);
        });
        disposalTracker.current.add('scroll-listener');
        
        // Store for cleanup
        return () => {
          scrollDisposable.dispose();
        };
      }

      // Add VS Code keyboard shortcuts
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSave);
      
      // Find and replace shortcuts
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
        editor.getAction('actions.find').run();
      });
      
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
        editor.getAction('editor.action.startFindReplaceAction').run();
      });
      
      // Go to line
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
        editor.getAction('editor.action.gotoLine').run();
      });
      
      // Format document
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
        editor.getAction('editor.action.formatDocument').run();
      });
      
      // Toggle comment
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
        editor.getAction('editor.action.commentLine').run();
      });
      
      // Duplicate line
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
        editor.getAction('editor.action.copyLinesDownAction').run();
      });
      
      // Move line up/down
      editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
        editor.getAction('editor.action.moveLinesUpAction').run();
      });
      
      editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
        editor.getAction('editor.action.moveLinesDownAction').run();
      });
      
      // Select all occurrences
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL, () => {
        editor.getAction('editor.action.selectHighlights').run();
      });
      
      // Multi-cursor shortcuts
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
        editor.getAction('editor.action.addSelectionToNextFindMatch').run();
      });
      
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
        editor.getAction('editor.action.insertCursorBelow').run();
      });
      
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
        editor.getAction('editor.action.insertCursorAbove').run();
      });

      // Add event listener for external save requests (from tab close)
      const handleExternalSave = (event) => {
        if (event.detail && currentFileRef.current && event.detail.fileId === currentFileRef.current.id) {
          handleSave();
        }
      };

      // Event listener for save functionality (Edit menu actions handled by separate useEffect)
      window.addEventListener('monaco-save-file', handleExternalSave);

      // Cleanup function
      return () => {
        if (isDisposingRef.current) return;
        isDisposingRef.current = true;
        
        try {
          safeDispose(editor, 'main-editor-instance');
          
          // Cleanup AI features
          if (aiDisposable) {
            aiDisposable.dispose();
          }
          if (aiContextMenuDisposable) {
            aiContextMenuDisposable();
          }
          if (commentDetectionDisposable) {
            commentDetectionDisposable();
          }
          
          // Remove save event listener (Edit menu listeners cleaned up by separate useEffect)
          window.removeEventListener('monaco-save-file', handleExternalSave);
          
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
          }
          
          editorRef.current = null;
          isInitializedRef.current = false;
          disposalTracker.current.clear();
        } catch (error) {
          // Completely silent - React Strict Mode disposal
        } finally {
          isDisposingRef.current = false;
        }
      };
    } catch (error) {
      console.error('Failed to initialize Monaco Editor:', error);
      setError && setError('Failed to initialize editor: ' + error.message);
    }
  }, []); // Empty dependencies array - only initialize once

  // Load file content when activeFile changes
  useEffect(() => {
    // Update the ref to avoid stale closure in event handlers
    currentFileRef.current = activeFile;
    
    // Check if we're trying to load the same file - if so, skip reload
    if (activeFile && loadedFileIdRef.current === activeFile.id) {
      return;
    }
    
    // Set initializing flag when starting to load a new file
    if (activeFile) {
      isInitializingRef.current = true;
      setEditorState(prev => ({ ...prev, isInitializing: true }));
    }
    
    if (!editorRef.current || !activeFile) {
      // Clear editor if no file is selected
      if (editorRef.current && !activeFile) {
        try {
          editorRef.current.setValue('');
          setEditorState(prev => ({ ...prev, language: 'javascript' }));
          loadedFileIdRef.current = null; // Clear loaded file tracking
        } catch (error) {
          // Ignore errors when clearing
        }
      }
      return;
    }

    setEditorState(prev => ({ ...prev, isLoading: true }));

    try {
      const language = getLanguageFromExtension(activeFile.metadata?.name);
      
      // Check if we can reuse the current model (same language and not disposed)
      const canReuseModel = modelRef.current && 
                           !modelRef.current.isDisposed() && 
                           modelRef.current.getLanguageId() === language;
      
      if (canReuseModel) {
        // Reuse existing model, just update content
        modelRef.current.setValue(activeFile.content || '');
      } else {
        // Dispose previous model if exists
        if (modelRef.current) {
          safeDispose(modelRef.current, 'file-load-model-disposal');
          modelRef.current = null;
        }

        // Create new model with proper language
        const model = monaco.editor.createModel(
          activeFile.content || '',
          language
        );
        
        modelRef.current = model;
        
        if (editorRef.current && !editorRef.current._isDisposed) {
          editorRef.current.setModel(model);
        }
      }
      
      if (editorRef.current && !editorRef.current._isDisposed) {
        editorRef.current.focus();
      }
      
      isInitializingRef.current = false;
      loadedFileIdRef.current = activeFile.id; // Track which file is loaded
      setEditorState(prev => ({
        ...prev, 
        isLoading: false, 
        language,
        hasUnsavedChanges: false,
        isInitializing: false // File load complete, enable auto-save
      }));
      
      // Clear unsaved changes when loading a new file
      if (activeFile) {
        setUnsavedChanges(activeFile.id, false);
      }
      
    } catch (error) {
      console.error('Failed to load file content:', error);
      setError && setError('Failed to load file: ' + error.message);
      setEditorState(prev => ({ ...prev, isLoading: false }));
    }
  }, [activeFile, setError, safeDispose]);

  // Update theme when it changes
  useEffect(() => {
    if (editorRef.current && !editorRef.current._isDisposed) {
      try {
        monaco.editor.setTheme(theme === 'light' ? 'ai-ide-light' : 'ai-ide-dark');
      } catch (error) {
        // Ignore theme update errors
      }
    }
  }, [theme]);

  // Update font size when it changes
  useEffect(() => {
    if (editorRef.current && !editorRef.current._isDisposed) {
      try {
        editorRef.current.updateOptions({ fontSize });
      } catch (error) {
        // Ignore font size update errors
      }
    }
  }, [fontSize]);

  // Update font family when it changes
  useEffect(() => {
    if (editorRef.current && !editorRef.current._isDisposed) {
      try {
        editorRef.current.updateOptions({ fontFamily });
      } catch (error) {
        // Ignore font family update errors
      }
    }
  }, [fontFamily]);

  // Add change listener whenever the model changes
  useEffect(() => {
    if (!editorRef.current || !modelRef.current || editorRef.current._isDisposed) {
      return;
    }

    const changeDisposable = modelRef.current.onDidChangeContent(() => {
      setEditorState(prev => ({ ...prev, hasUnsavedChanges: true }));

      // Mark file as having unsaved changes in the context
      if (currentFileRef.current) {
        setUnsavedChanges(currentFileRef.current.id, true);
      }

      if (autoSave && !isInitializingRef.current && currentFileRef.current) {
        const content = modelRef.current?.getValue() || '';
        debouncedSave(content);
      }
    });

    return () => {
      safeDispose(changeDisposable, 'model-change-listener');
    };
  }, [modelRef.current, autoSave, debouncedSave, safeDispose, setUnsavedChanges]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      if (isDisposingRef.current) return;
      
      try {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        if (modelRef.current) {
          safeDispose(modelRef.current, 'final-model-cleanup');
          modelRef.current = null;
        }
      } catch (error) {
        // Silent cleanup
      }
    };
  }, [safeDispose]);

  return (
    <div className="monaco-editor-container" style={{ height }}>
      {/* Main Editor Area */}
      <div className="monaco-main-area">
        {/* Loading overlay */}
        {editorState.isLoading && (
          <div className="monaco-loading-overlay">
            Loading file...
          </div>
        )}
        
        {/* Welcome message when no file is selected */}
        {!currentFile && !editorState.isLoading && (
          <div className="monaco-welcome-overlay">
            <div className="welcome-content">
              <h2>Welcome to AI-IDE</h2>
              <p>Open a file to get started</p>
              <div className="welcome-shortcuts">
                <div className="shortcut-item">
                  <kbd>Ctrl+O</kbd> Open File
                </div>
                <div className="shortcut-item">
                  <kbd>Ctrl+N</kbd> New File
                </div>
                <div className="shortcut-item">
                  <kbd>Ctrl+S</kbd> Save File
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Monaco Editor Container - always present but may be empty */}
        <div 
          ref={containerRef} 
          style={{ 
            width: '100%',
            height: '100%',
            visibility: currentFile ? 'visible' : 'hidden'
          }} 
        />
      </div>
      
      {/* Status bar */}
      <div className={`monaco-status-bar ${theme === 'light' ? 'theme-light' : ''}`}>
        <div className="monaco-status-bar-left">
          <span>{editorState.language}</span>
          {currentFile && (
            <span>{currentFile.metadata?.name || 'Untitled'}</span>
          )}
        </div>
        
        <div className="monaco-status-bar-right">
          {editorState.hasUnsavedChanges && (
            <span className="monaco-status-indicator unsaved">●</span>
          )}
          
          {syncStatus === 'syncing' && (
            <span className="monaco-status-indicator syncing">Syncing...</span>
          )}
          
          {syncStatus === 'synced' && (
            <span className="monaco-status-indicator synced">✓ Synced</span>
          )}
          
          {syncStatus === 'error' && (
            <span className="monaco-status-indicator error">✗ Sync Error</span>
          )}
          
          <span>Project: {currentProject?.name || 'No Project'}</span>
        </div>
      </div>
    </div>
  );
});