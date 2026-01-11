/**
 * LSP Client Service
 * Manages Language Server Protocol connections and communications
 * Provides IntelliSense, code completion, hover, diagnostics, and more
 */

import { apiService } from './api';

class LSPClientService {
  constructor() {
    this.activeServers = new Map(); // Map of language -> serverId
    this.diagnosticsCallbacks = new Map(); // Map of fileUri -> callback
    this.isInitializing = new Map(); // Track initialization state per language
    this.pendingRequests = new Map(); // Track pending requests
  }

  /**
   * Initialize LSP server for a project and language
   */
  async initializeServer(language, projectId, workspaceRoot = '/workspace') {
    try {
      // Check if already initialized or initializing
      const existingServerId = this.activeServers.get(language);
      if (existingServerId) {
        console.log(`LSP server for ${language} already initialized:`, existingServerId);
        return existingServerId;
      }

      if (this.isInitializing.get(language)) {
        console.log(`LSP server for ${language} is already initializing, waiting...`);
        // Wait for initialization to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.activeServers.get(language);
      }

      this.isInitializing.set(language, true);
      console.log(`Initializing LSP server for ${language}...`);

      const response = await apiService.post(`/lsp/${language}/initialize`, {
        projectId,
        workspaceRoot
      });

      if (response.data.success) {
        const serverId = response.data.serverId;
        this.activeServers.set(language, serverId);
        console.log(`✓ LSP server initialized for ${language}:`, serverId);
        this.isInitializing.set(language, false);
        return serverId;
      } else {
        console.warn(`LSP server not available for ${language}:`, response.data.message);
        this.isInitializing.set(language, false);
        return null;
      }
    } catch (error) {
      console.error(`Failed to initialize LSP server for ${language}:`, error);
      this.isInitializing.set(language, false);
      return null;
    }
  }

  /**
   * Get or initialize server for a language
   */
  async getServer(language, projectId) {
    const serverId = this.activeServers.get(language);
    if (serverId) {
      return serverId;
    }
    return await this.initializeServer(language, projectId);
  }

  /**
   * Notify LSP server that a document was opened
   */
  async didOpenTextDocument(serverId, uri, languageId, version, text) {
    try {
      await apiService.post(`/lsp/${serverId}/didOpen`, {
        textDocument: {
          uri,
          languageId,
          version,
          text
        }
      });
      console.log(`✓ didOpen sent for ${uri}`);
    } catch (error) {
      console.error('Failed to send didOpen:', error);
    }
  }

  /**
   * Notify LSP server that a document changed
   */
  async didChangeTextDocument(serverId, uri, version, changes) {
    try {
      await apiService.post(`/lsp/${serverId}/didChange`, {
        textDocument: {
          uri,
          version
        },
        contentChanges: changes
      });
      console.log(`✓ didChange sent for ${uri}`);
    } catch (error) {
      console.error('Failed to send didChange:', error);
    }
  }

  /**
   * Notify LSP server that a document was saved
   */
  async didSaveTextDocument(serverId, uri, text) {
    try {
      await apiService.post(`/lsp/${serverId}/didSave`, {
        textDocument: {
          uri
        },
        text
      });
      console.log(`✓ didSave sent for ${uri}`);
    } catch (error) {
      console.error('Failed to send didSave:', error);
    }
  }

  /**
   * Notify LSP server that a document was closed
   */
  async didCloseTextDocument(serverId, uri) {
    try {
      await apiService.post(`/lsp/${serverId}/didClose`, {
        textDocument: {
          uri
        }
      });
      console.log(`✓ didClose sent for ${uri}`);
    } catch (error) {
      console.error('Failed to send didClose:', error);
    }
  }

  /**
   * Request code completion at a specific position
   */
  async getCompletion(serverId, uri, position, context = {}) {
    try {
      const response = await apiService.post(`/lsp/${serverId}/completion`, {
        textDocument: { uri },
        position,
        context
      });

      if (response.data.success) {
        return response.data.completions;
      }
      return null;
    } catch (error) {
      console.error('Failed to get completion:', error);
      return null;
    }
  }

  /**
   * Request hover information at a specific position
   */
  async getHover(serverId, uri, position) {
    try {
      const response = await apiService.post(`/lsp/${serverId}/hover`, {
        textDocument: { uri },
        position
      });

      if (response.data.success) {
        return response.data.hover;
      }
      return null;
    } catch (error) {
      console.error('Failed to get hover:', error);
      return null;
    }
  }

  /**
   * Request signature help (parameter hints) at a specific position
   */
  async getSignatureHelp(serverId, uri, position, context = {}) {
    try {
      const response = await apiService.post(`/lsp/${serverId}/signatureHelp`, {
        textDocument: { uri },
        position,
        context
      });

      if (response.data.success) {
        return response.data.signatureHelp;
      }
      return null;
    } catch (error) {
      console.error('Failed to get signature help:', error);
      return null;
    }
  }

  /**
   * Request go-to-definition
   */
  async getDefinition(serverId, uri, position) {
    try {
      const response = await apiService.post(`/lsp/${serverId}/definition`, {
        textDocument: { uri },
        position
      });

      if (response.data.success) {
        return response.data.locations;
      }
      return null;
    } catch (error) {
      console.error('Failed to get definition:', error);
      return null;
    }
  }

  /**
   * Request find references
   */
  async getReferences(serverId, uri, position, includeDeclaration = false) {
    try {
      const response = await apiService.post(`/lsp/${serverId}/references`, {
        textDocument: { uri },
        position,
        context: { includeDeclaration }
      });

      if (response.data.success) {
        return response.data.locations;
      }
      return null;
    } catch (error) {
      console.error('Failed to get references:', error);
      return null;
    }
  }

  /**
   * Request document formatting
   */
  async formatDocument(serverId, uri, options = {}) {
    try {
      const response = await apiService.post(`/lsp/${serverId}/formatting`, {
        textDocument: { uri },
        options: {
          tabSize: options.tabSize || 2,
          insertSpaces: options.insertSpaces !== false,
          ...options
        }
      });

      if (response.data.success) {
        return response.data.edits;
      }
      return null;
    } catch (error) {
      console.error('Failed to format document:', error);
      return null;
    }
  }

  /**
   * Register a callback for diagnostics updates
   */
  onDiagnostics(uri, callback) {
    this.diagnosticsCallbacks.set(uri, callback);
  }

  /**
   * Unregister diagnostics callback
   */
  offDiagnostics(uri) {
    this.diagnosticsCallbacks.delete(uri);
  }

  /**
   * List active language servers
   */
  async listServers() {
    try {
      const response = await apiService.get('/lsp/servers');
      if (response.data.success) {
        return response.data.servers;
      }
      return [];
    } catch (error) {
      console.error('Failed to list servers:', error);
      return [];
    }
  }

  /**
   * Shutdown a language server
   */
  async shutdownServer(serverId) {
    try {
      await apiService.delete(`/lsp/${serverId}`);
      
      // Remove from active servers
      for (const [lang, id] of this.activeServers.entries()) {
        if (id === serverId) {
          this.activeServers.delete(lang);
          break;
        }
      }
      
      console.log(`✓ LSP server ${serverId} shutdown`);
    } catch (error) {
      console.error('Failed to shutdown server:', error);
    }
  }

  /**
   * Shutdown all active servers
   */
  async shutdownAllServers() {
    const serverIds = Array.from(this.activeServers.values());
    await Promise.all(serverIds.map(id => this.shutdownServer(id)));
    this.activeServers.clear();
  }

  /**
   * Convert file path to LSP URI format
   */
  pathToUri(filePath, projectId) {
    // LSP uses file:// URIs
    if (filePath.startsWith('file://')) {
      return filePath;
    }
    // Create a URI for the file
    return `file:///workspace/${projectId}/${filePath}`;
  }

  /**
   * Get language ID for LSP from file extension or Monaco language
   */
  getLanguageId(monacoLanguage, filename) {
    // Map Monaco language IDs to LSP language IDs
    const languageMap = {
      'javascript': 'javascript',
      'typescript': 'typescript',
      'python': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'csharp': 'csharp',
      'go': 'go',
      'rust': 'rust',
      'ruby': 'ruby',
      'php': 'php'
    };

    // Try to get from Monaco language
    if (languageMap[monacoLanguage]) {
      return languageMap[monacoLanguage];
    }

    // Fallback to file extension
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      const extMap = {
        'js': 'javascript',
        'jsx': 'jsx',
        'ts': 'typescript',
        'tsx': 'tsx',
        'py': 'python',
        'java': 'java',
        'c': 'c',
        'h': 'c',
        'cpp': 'cpp',
        'cc': 'cpp',
        'cxx': 'cpp',
        'hpp': 'cpp',
        'cs': 'csharp',
        'go': 'go',
        'rs': 'rust',
        'rb': 'ruby',
        'php': 'php'
      };
      return extMap[ext] || monacoLanguage;
    }

    return monacoLanguage;
  }

  /**
   * Check if language has LSP support
   */
  supportsLSP(language) {
    const supportedLanguages = ['python', 'javascript', 'typescript', 'jsx', 'tsx', 'c', 'cpp'];
    return supportedLanguages.includes(language);
  }
}

// Export singleton instance
const lspClientService = new LSPClientService();
export default lspClientService;
