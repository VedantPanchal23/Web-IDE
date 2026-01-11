/**
 * Monaco LSP Integration Hook
 * Provides Language Server Protocol features for Monaco Editor
 * - Code Completion (IntelliSense)
 * - Hover Documentation
 * - Signature Help
 * - Diagnostics (Error Highlighting)
 * - Document Synchronization
 */

import { useEffect, useRef, useCallback } from 'react';
import monaco from '../monaco-config';
import lspClientService from '../services/lsp.service';

export function useLSP(editor, currentFile, projectId) {
  const disposablesRef = useRef([]);
  const documentVersionRef = useRef(0);
  const serverIdRef = useRef(null);
  const isInitializedRef = useRef(false);
  const pendingChangesRef = useRef([]);

  /**
   * Clean up all registered providers and subscriptions
   */
  const cleanup = useCallback(() => {
    disposablesRef.current.forEach(disposable => {
      try {
        disposable.dispose();
      } catch (err) {
        console.warn('Failed to dispose:', err);
      }
    });
    disposablesRef.current = [];
    isInitializedRef.current = false;
  }, []);

  /**
   * Initialize LSP for current file
   */
  const initializeLSP = useCallback(async () => {
    if (!editor || !currentFile || !projectId) return;

    const model = editor.getModel();
    if (!model) return;

    const language = model.getLanguageId();
    const filename = currentFile.metadata?.name || currentFile.name;
    const lspLanguage = lspClientService.getLanguageId(language, filename);

    // Check if this language supports LSP
    if (!lspClientService.supportsLSP(lspLanguage)) {
      console.log(`LSP not supported for language: ${lspLanguage}`);
      return;
    }

    console.log(`Initializing LSP for ${lspLanguage}...`);

    try {
      // Initialize language server
      const serverId = await lspClientService.initializeServer(lspLanguage, projectId);
      if (!serverId) {
        console.warn(`Failed to initialize LSP server for ${lspLanguage}`);
        return;
      }

      serverIdRef.current = serverId;
      documentVersionRef.current = 1;

      // Send didOpen notification
      const uri = lspClientService.pathToUri(filename, projectId);
      await lspClientService.didOpenTextDocument(
        serverId,
        uri,
        lspLanguage,
        documentVersionRef.current,
        model.getValue()
      );

      isInitializedRef.current = true;
      console.log(`✓ LSP initialized for ${lspLanguage}`);

      // Register providers after initialization
      registerProviders(model, serverId, uri, lspLanguage);

      // Set up document change listener
      setupDocumentSync(model, serverId, uri);

    } catch (error) {
      console.error('Failed to initialize LSP:', error);
    }
  }, [editor, currentFile, projectId]);

  /**
   * Register Monaco language providers
   */
  const registerProviders = useCallback((model, serverId, uri, language) => {
    const languageId = model.getLanguageId();

    // 1. Completion Provider (IntelliSense)
    const completionProvider = monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: ['.', ':', '<', '"', '/', '@'],
      
      async provideCompletionItems(model, position, context, token) {
        try {
          const completions = await lspClientService.getCompletion(
            serverId,
            uri,
            {
              line: position.lineNumber - 1,
              character: position.column - 1
            },
            {
              triggerKind: context.triggerKind,
              triggerCharacter: context.triggerCharacter
            }
          );

          if (!completions) return { suggestions: [] };

          // Handle both array and object responses
          const items = Array.isArray(completions) ? completions : completions.items || [];

          const suggestions = items.map(item => {
            // Map LSP CompletionItemKind to Monaco CompletionItemKind
            const monacoKind = mapCompletionKind(item.kind);

            return {
              label: item.label,
              kind: monacoKind,
              documentation: item.documentation?.value || item.documentation || undefined,
              detail: item.detail || undefined,
              insertText: item.insertText || item.label,
              insertTextRules: item.insertTextFormat === 2 
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
                : undefined,
              range: item.textEdit?.range ? {
                startLineNumber: item.textEdit.range.start.line + 1,
                startColumn: item.textEdit.range.start.character + 1,
                endLineNumber: item.textEdit.range.end.line + 1,
                endColumn: item.textEdit.range.end.character + 1
              } : undefined,
              sortText: item.sortText,
              filterText: item.filterText,
              preselect: item.preselect
            };
          });

          return {
            suggestions,
            incomplete: completions.isIncomplete || false
          };
        } catch (error) {
          console.error('Completion provider error:', error);
          return { suggestions: [] };
        }
      }
    });
    disposablesRef.current.push(completionProvider);

    // 2. Hover Provider
    const hoverProvider = monaco.languages.registerHoverProvider(languageId, {
      async provideHover(model, position, token) {
        try {
          const hover = await lspClientService.getHover(
            serverId,
            uri,
            {
              line: position.lineNumber - 1,
              character: position.column - 1
            }
          );

          if (!hover || !hover.contents) return null;

          // Convert LSP hover contents to Monaco hover
          const contents = Array.isArray(hover.contents) 
            ? hover.contents 
            : [hover.contents];

          const markdownContents = contents.map(content => {
            if (typeof content === 'string') {
              return { value: content };
            } else if (content.kind === 'markdown') {
              return { value: content.value };
            } else if (content.language) {
              return { value: `\`\`\`${content.language}\n${content.value}\n\`\`\`` };
            }
            return { value: content.value || String(content) };
          });

          return {
            contents: markdownContents,
            range: hover.range ? {
              startLineNumber: hover.range.start.line + 1,
              startColumn: hover.range.start.character + 1,
              endLineNumber: hover.range.end.line + 1,
              endColumn: hover.range.end.character + 1
            } : undefined
          };
        } catch (error) {
          console.error('Hover provider error:', error);
          return null;
        }
      }
    });
    disposablesRef.current.push(hoverProvider);

    // 3. Signature Help Provider (Parameter Hints)
    const signatureHelpProvider = monaco.languages.registerSignatureHelpProvider(languageId, {
      signatureHelpTriggerCharacters: ['(', ','],
      signatureHelpRetriggerCharacters: [','],
      
      async provideSignatureHelp(model, position, token, context) {
        try {
          const signatureHelp = await lspClientService.getSignatureHelp(
            serverId,
            uri,
            {
              line: position.lineNumber - 1,
              character: position.column - 1
            },
            {
              triggerKind: context.triggerKind,
              triggerCharacter: context.triggerCharacter,
              isRetrigger: context.isRetrigger,
              activeSignatureHelp: context.activeSignatureHelp
            }
          );

          if (!signatureHelp || !signatureHelp.signatures) return null;

          return {
            value: {
              signatures: signatureHelp.signatures.map(sig => ({
                label: sig.label,
                documentation: sig.documentation?.value || sig.documentation || undefined,
                parameters: sig.parameters?.map(param => ({
                  label: param.label,
                  documentation: param.documentation?.value || param.documentation || undefined
                })) || []
              })),
              activeSignature: signatureHelp.activeSignature || 0,
              activeParameter: signatureHelp.activeParameter || 0
            },
            dispose: () => {}
          };
        } catch (error) {
          console.error('Signature help provider error:', error);
          return null;
        }
      }
    });
    disposablesRef.current.push(signatureHelpProvider);

    // 4. Definition Provider (Go to Definition)
    const definitionProvider = monaco.languages.registerDefinitionProvider(languageId, {
      async provideDefinition(model, position, token) {
        try {
          const locations = await lspClientService.getDefinition(
            serverId,
            uri,
            {
              line: position.lineNumber - 1,
              character: position.column - 1
            }
          );

          if (!locations || locations.length === 0) return null;

          return locations.map(loc => ({
            uri: monaco.Uri.parse(loc.uri),
            range: {
              startLineNumber: loc.range.start.line + 1,
              startColumn: loc.range.start.character + 1,
              endLineNumber: loc.range.end.line + 1,
              endColumn: loc.range.end.character + 1
            }
          }));
        } catch (error) {
          console.error('Definition provider error:', error);
          return null;
        }
      }
    });
    disposablesRef.current.push(definitionProvider);

    console.log(`✓ Registered LSP providers for ${languageId}`);
  }, []);

  /**
   * Set up document synchronization
   */
  const setupDocumentSync = useCallback((model, serverId, uri) => {
    // Listen for content changes
    const changeDisposable = model.onDidChangeContent((e) => {
      documentVersionRef.current++;
      
      // Collect changes
      const changes = e.changes.map(change => ({
        range: {
          start: {
            line: change.range.startLineNumber - 1,
            character: change.range.startColumn - 1
          },
          end: {
            line: change.range.endLineNumber - 1,
            character: change.range.endColumn - 1
          }
        },
        rangeLength: change.rangeLength,
        text: change.text
      }));

      // Send incremental changes (debounced)
      debounceDidChange(serverId, uri, documentVersionRef.current, model.getValue());
    });
    disposablesRef.current.push(changeDisposable);
  }, []);

  /**
   * Debounced didChange notification
   */
  const debounceDidChange = (() => {
    let timeout;
    return (serverId, uri, version, fullText) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        // Send full document sync for simplicity
        lspClientService.didChangeTextDocument(
          serverId,
          uri,
          version,
          [{ text: fullText }]
        ).catch(err => console.error('Failed to send didChange:', err));
      }, 300); // 300ms debounce
    };
  })();

  /**
   * Map LSP CompletionItemKind to Monaco CompletionItemKind
   */
  function mapCompletionKind(lspKind) {
    const kindMap = {
      1: monaco.languages.CompletionItemKind.Text,
      2: monaco.languages.CompletionItemKind.Method,
      3: monaco.languages.CompletionItemKind.Function,
      4: monaco.languages.CompletionItemKind.Constructor,
      5: monaco.languages.CompletionItemKind.Field,
      6: monaco.languages.CompletionItemKind.Variable,
      7: monaco.languages.CompletionItemKind.Class,
      8: monaco.languages.CompletionItemKind.Interface,
      9: monaco.languages.CompletionItemKind.Module,
      10: monaco.languages.CompletionItemKind.Property,
      11: monaco.languages.CompletionItemKind.Unit,
      12: monaco.languages.CompletionItemKind.Value,
      13: monaco.languages.CompletionItemKind.Enum,
      14: monaco.languages.CompletionItemKind.Keyword,
      15: monaco.languages.CompletionItemKind.Snippet,
      16: monaco.languages.CompletionItemKind.Color,
      17: monaco.languages.CompletionItemKind.File,
      18: monaco.languages.CompletionItemKind.Reference,
      19: monaco.languages.CompletionItemKind.Folder,
      20: monaco.languages.CompletionItemKind.EnumMember,
      21: monaco.languages.CompletionItemKind.Constant,
      22: monaco.languages.CompletionItemKind.Struct,
      23: monaco.languages.CompletionItemKind.Event,
      24: monaco.languages.CompletionItemKind.Operator,
      25: monaco.languages.CompletionItemKind.TypeParameter
    };
    return kindMap[lspKind] || monaco.languages.CompletionItemKind.Text;
  }

  // Initialize LSP when file or editor changes
  useEffect(() => {
    cleanup();
    
    if (editor && currentFile && projectId) {
      // Small delay to ensure editor is ready
      const timer = setTimeout(() => {
        initializeLSP();
      }, 100);
      
      return () => {
        clearTimeout(timer);
        cleanup();
      };
    }
  }, [editor, currentFile, projectId, initializeLSP, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      
      // Send didClose notification if file was open
      if (serverIdRef.current && currentFile) {
        const filename = currentFile.metadata?.name || currentFile.name;
        const uri = lspClientService.pathToUri(filename, projectId);
        lspClientService.didCloseTextDocument(serverIdRef.current, uri)
          .catch(err => console.error('Failed to send didClose:', err));
      }
    };
  }, []);

  return {
    isInitialized: isInitializedRef.current,
    serverId: serverIdRef.current
  };
}
