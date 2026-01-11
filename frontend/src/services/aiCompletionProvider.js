import * as monaco from 'monaco-editor';
import aiServiceClient from '../services/aiService';

/**
 * AI-powered Inline Completion Provider for Monaco Editor
 * Works like GitHub Copilot - shows ghost text suggestions
 */
export class AICompletionProvider {
  constructor() {
    this.enabled = true;
    this.debounceTimer = null;
    this.debounceDelay = 800; // Wait 800ms after typing stops
    this.lastSuggestion = null;
    this.currentLanguage = null;
    this.currentFilePath = null;
  }

  /**
   * Register AI completion provider with Monaco
   */
  register(editor, language, filePath) {
    this.currentLanguage = language;
    this.currentFilePath = filePath;

    // Register inline completion provider
    const provider = monaco.languages.registerInlineCompletionsProvider(language, {
      provideInlineCompletions: async (model, position, context, token) => {
        if (!this.enabled || !aiServiceClient.isEnabled) {
          return { items: [] };
        }

        try {
          const code = model.getValue();
          const offset = model.getOffsetAt(position);

          // Get AI completion
          const result = await aiServiceClient.getCompletion({
            code,
            cursorPosition: offset,
            language: this.currentLanguage || language,
            filePath: this.currentFilePath || 'untitled',
            maxTokens: 150
          });

          if (result.completion && result.completion.trim()) {
            this.lastSuggestion = result.completion;

            return {
              items: [
                {
                  insertText: result.completion,
                  range: new monaco.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column
                  ),
                  command: {
                    id: 'ai-completion-accepted',
                    title: 'AI Completion Accepted'
                  }
                }
              ]
            };
          }
        } catch (error) {
          console.error('AI completion error:', error);
        }

        return { items: [] };
      },

      freeInlineCompletions: (completions) => {
        // Clean up any resources associated with completions
      },

      // Support for newer Monaco Editor versions
      handleItemDidShow: (completions, item) => {
        // Called when completion is shown
      },

      // Required for proper disposal in newer Monaco versions
      disposeInlineCompletions: (completions) => {
        // Properly dispose of completions
      }
    });

    return provider;
  }

  /**
   * Setup AI completion with automatic trigger
   */
  setupAutoCompletion(editor, language, filePath) {
    this.currentLanguage = language;
    this.currentFilePath = filePath;

    // Register provider
    const provider = this.register(editor, language, filePath);

    // Auto-trigger on content change with debounce
    const contentChangeDisposable = editor.onDidChangeModelContent(() => {
      if (!this.enabled) return;

      // Clear previous timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Set new timer
      this.debounceTimer = setTimeout(() => {
        const position = editor.getPosition();
        if (position) {
          // Trigger inline completion
          editor.trigger('ai-completion', 'editor.action.inlineSuggest.trigger', {});
        }
      }, this.debounceDelay);
    });

    // Accept completion on Tab key
    const tabKeyDisposable = editor.addCommand(
      monaco.KeyCode.Tab,
      () => {
        // Monaco's built-in Tab will accept the inline suggestion
        editor.trigger('keyboard', 'editor.action.inlineSuggest.commit', {});
      },
      '!suggestWidgetVisible && !inSnippetMode'
    );

    // Dismiss on Escape
    const escapeKeyDisposable = editor.addCommand(
      monaco.KeyCode.Escape,
      () => {
        editor.trigger('keyboard', 'editor.action.inlineSuggest.hide', {});
      }
    );

    // Return disposables for cleanup
    return {
      dispose: () => {
        provider?.dispose();
        contentChangeDisposable?.dispose();
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
      }
    };
  }

  /**
   * Manual trigger for AI completion
   */
  async triggerManual(editor) {
    if (!this.enabled || !aiServiceClient.isEnabled) {
      console.warn('AI completion not available');
      return;
    }

    try {
      const model = editor.getModel();
      const position = editor.getPosition();
      const code = model.getValue();
      const offset = model.getOffsetAt(position);

      const result = await aiServiceClient.getCompletion({
        code,
        cursorPosition: offset,
        language: this.currentLanguage || model.getLanguageId(),
        filePath: this.currentFilePath || 'untitled',
        maxTokens: 150
      });

      if (result.completion) {
        // Insert at cursor
        editor.executeEdits('ai-completion', [
          {
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            ),
            text: result.completion
          }
        ]);

        // Show notification
        console.log(`✨ AI suggestion inserted (${result.provider})`);
      }
    } catch (error) {
      console.error('Manual AI completion failed:', error);
    }
  }

  /**
   * Enable/disable AI completions
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`AI completions ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update file context
   */
  updateContext(language, filePath) {
    this.currentLanguage = language;
    this.currentFilePath = filePath;
  }
}

// Export singleton
export const aiCompletionProvider = new AICompletionProvider();
export default aiCompletionProvider;
