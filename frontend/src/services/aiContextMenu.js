import aiServiceClient from '../services/aiService';

/**
 * Register AI context menu actions in Monaco editor
 * Right-click menu with AI features: Explain, Refactor, Generate
 */
export function registerAIContextMenu(editor, monaco) {
  // Check if AI is available first
  let aiAvailable = false;
  aiServiceClient.checkAvailability().then(status => {
    aiAvailable = status.available;
  });

  // Action 1: Explain Code
  const explainAction = editor.addAction({
    id: 'ai-explain-code',
    label: '🤖 Explain Code',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyE
    ],
    contextMenuGroupId: 'ai',
    contextMenuOrder: 1,
    
    precondition: null,
    
    run: async function(ed) {
      if (!aiAvailable) {
        alert('AI Assistant is not configured. See docs/AI_SETUP_GUIDE.md');
        return;
      }

      const selection = ed.getSelection();
      const selectedText = ed.getModel().getValueInRange(selection);
      
      if (!selectedText) {
        alert('Please select some code to explain');
        return;
      }

      try {
        // Show loading indicator
        const decorations = ed.deltaDecorations([], [{
          range: selection,
          options: {
            className: 'ai-analyzing',
            hoverMessage: { value: '🤖 AI is analyzing...' }
          }
        }]);

        const model = ed.getModel();
        const language = model.getLanguageId();
        
        const result = await aiServiceClient.explainCode({
          code: selectedText,
          language: language,
          context: {
            filePath: model.uri.path,
            surroundingCode: model.getValue()
          }
        });

        // Clear loading decoration
        ed.deltaDecorations(decorations, []);

        // Show explanation in a modal/notification
        const explanation = result.explanation;
        
        // Create a custom notification or use Monaco's message
        ed.trigger('ai', 'editor.action.showHover');
        
        // Better: Dispatch custom event for IDE to show in panel
        window.dispatchEvent(new CustomEvent('ai-explanation', {
          detail: {
            code: selectedText,
            explanation: explanation,
            provider: result.provider
          }
        }));

        console.log('AI Explanation:', explanation);
        
      } catch (error) {
        // Clear loading decoration
        ed.deltaDecorations([], []);
        alert(`AI Error: ${error.message}`);
      }
    }
  });

  // Action 2: Get Refactoring Suggestions
  const refactorAction = editor.addAction({
    id: 'ai-refactor-code',
    label: '🔧 Get Refactoring Suggestions',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyR
    ],
    contextMenuGroupId: 'ai',
    contextMenuOrder: 2,
    
    precondition: null,
    
    run: async function(ed) {
      if (!aiAvailable) {
        alert('AI Assistant is not configured. See docs/AI_SETUP_GUIDE.md');
        return;
      }

      const selection = ed.getSelection();
      const selectedText = ed.getModel().getValueInRange(selection);
      
      if (!selectedText) {
        alert('Please select some code to refactor');
        return;
      }

      try {
        const model = ed.getModel();
        const language = model.getLanguageId();
        
        const result = await aiServiceClient.getRefactoringSuggestions({
          code: selectedText,
          language: language,
          context: {
            filePath: model.uri.path
          }
        });

        // Dispatch event for IDE to show suggestions
        window.dispatchEvent(new CustomEvent('ai-refactoring', {
          detail: {
            code: selectedText,
            suggestions: result.suggestions,
            provider: result.provider
          }
        }));

        console.log('Refactoring Suggestions:', result.suggestions);
        
      } catch (error) {
        alert(`AI Error: ${error.message}`);
      }
    }
  });

  // Action 3: Generate Code from Comment
  const generateAction = editor.addAction({
    id: 'ai-generate-code',
    label: '✨ Generate Code from Comment',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyG
    ],
    contextMenuGroupId: 'ai',
    contextMenuOrder: 3,
    
    precondition: null,
    
    run: async function(ed) {
      if (!aiAvailable) {
        alert('AI Assistant is not configured. See docs/AI_SETUP_GUIDE.md');
        return;
      }

      const selection = ed.getSelection();
      const selectedText = ed.getModel().getValueInRange(selection);
      
      if (!selectedText) {
        alert('Please select a comment (TODO, etc.) to generate code from');
        return;
      }

      try {
        const model = ed.getModel();
        const language = model.getLanguageId();
        
        const result = await aiServiceClient.generateCode({
          comment: selectedText,
          language: language,
          context: {
            filePath: model.uri.path,
            surroundingCode: model.getValue()
          }
        });

        // Insert generated code after the comment
        const endPosition = selection.getEndPosition();
        const insertPosition = {
          lineNumber: endPosition.lineNumber + 1,
          column: 1
        };
        
        const generatedCode = `\n${result.code}\n`;
        
        ed.executeEdits('ai-generate', [{
          range: new monaco.Range(
            insertPosition.lineNumber,
            insertPosition.column,
            insertPosition.lineNumber,
            insertPosition.column
          ),
          text: generatedCode
        }]);

        // Select the generated code
        const insertedLines = generatedCode.split('\n').length;
        ed.setSelection(new monaco.Range(
          insertPosition.lineNumber,
          1,
          insertPosition.lineNumber + insertedLines - 1,
          1
        ));

        // Dispatch event to show in chat panel
        window.dispatchEvent(new CustomEvent('ai-code-generated', {
          detail: {
            comment: selectedText,
            code: result.code,
            language: language,
            provider: result.provider
          }
        }));

        console.log('Generated Code:', result.code);
        
      } catch (error) {
        alert(`AI Error: ${error.message}`);
      }
    }
  });

  // Action 4: Open AI Chat
  const chatAction = editor.addAction({
    id: 'ai-open-chat',
    label: '💬 Ask AI About This Code',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyA
    ],
    contextMenuGroupId: 'ai',
    contextMenuOrder: 4,
    
    precondition: null,
    
    run: function(ed) {
      const selection = ed.getSelection();
      const selectedText = ed.getModel().getValueInRange(selection);
      
      // Dispatch event to open AI chat with selected code as context
      window.dispatchEvent(new CustomEvent('open-ai-chat', {
        detail: {
          code: selectedText,
          language: ed.getModel().getLanguageId(),
          filePath: ed.getModel().uri.path
        }
      }));
    }
  });

  // Return cleanup function
  return () => {
    explainAction?.dispose();
    refactorAction?.dispose();
    generateAction?.dispose();
    chatAction?.dispose();
  };
}

/**
 * Setup automatic comment detection for code generation
 * Detects TODO comments and shows lightbulb action
 */
export function setupCommentDetection(editor, monaco) {
  const commentPatterns = [
    /\/\/ TODO:/i,
    /\/\/ FIXME:/i,
    /\/\/ Generate:/i,
    /\/\/ AI:/i,
    /\/\*\s*TODO:/i,
    /\/\*\s*Generate:/i,
    /#\s*TODO:/i,
    /#\s*Generate:/i
  ];

  // Code actions provider for lightbulb
  const codeActionProvider = monaco.languages.registerCodeActionProvider('*', {
    provideCodeActions: function(model, range, context, token) {
      const text = model.getValueInRange(range);
      
      // Check if current line has a TODO/Generate comment
      const hasComment = commentPatterns.some(pattern => pattern.test(text));
      
      if (!hasComment) {
        return { actions: [], dispose: () => {} };
      }

      return {
        actions: [{
          title: '✨ Generate Code from Comment (AI)',
          kind: 'quickfix',
          isPreferred: true,
          edit: {
            edits: [] // Actual generation happens in action
          },
          command: {
            id: 'ai-generate-code',
            title: 'Generate Code',
            arguments: [model, range]
          }
        }],
        dispose: () => {}
      };
    }
  });

  return () => {
    codeActionProvider.dispose();
  };
}
