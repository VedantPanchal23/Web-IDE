import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';

class LSPService {
  constructor() {
    this.languageServers = new Map(); // Track active language servers
    this.maxServersPerUser = parseInt(process.env.MAX_LSP_SERVERS_PER_USER) || 3;
    this.serverConfigs = {
      python: {
        command: 'pylsp', // Python LSP Server
        args: [],
        capabilities: ['completion', 'diagnostics', 'hover', 'definition']
      },
      javascript: {
        command: 'typescript-language-server',
        args: ['--stdio'],
        capabilities: ['completion', 'diagnostics', 'hover', 'definition', 'formatting']
      },
      typescript: {
        command: 'typescript-language-server', 
        args: ['--stdio'],
        capabilities: ['completion', 'diagnostics', 'hover', 'definition', 'formatting']
      }
    };
  }

  /**
   * Start language server for a project and language
   */
  async startLanguageServer(userId, projectId, language, workspaceRoot) {
    try {
      const serverId = `${userId}-${projectId}-${language}`;
      
      // Check if server already exists
      if (this.languageServers.has(serverId)) {
        const existing = this.languageServers.get(serverId);
        if (existing.status === 'running') {
          return existing;
        }
        // Clean up dead server
        await this.stopLanguageServer(serverId);
      }

      // Check server limits per user
      const userServers = Array.from(this.languageServers.values())
        .filter(server => server.userId === userId);
      if (userServers.length >= this.maxServersPerUser) {
        throw new Error(`Maximum language servers limit reached (${this.maxServersPerUser})`);
      }

      const config = this.serverConfigs[language];
      if (!config) {
        throw new Error(`Language server not supported for: ${language}`);
      }

      // Check if language server command is available
      const isAvailable = await this.checkServerAvailability(config.command);
      if (!isAvailable) {
        logger.warn('Language server not installed', { language, command: config.command });
        return null; // Gracefully handle missing server
      }

      // Spawn language server process
      const process = spawn(config.command, config.args, {
        cwd: workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONPATH: workspaceRoot // For Python LSP
        }
      });

      const server = {
        id: serverId,
        userId,
        projectId,
        language,
        process,
        workspaceRoot,
        capabilities: config.capabilities,
        status: 'starting',
        createdAt: new Date(),
        lastActivity: new Date(),
        messageId: 0,
        pendingRequests: new Map()
      };

      this.languageServers.set(serverId, server);

      // Handle process events
      process.on('spawn', () => {
        server.status = 'running';
        logger.info('Language server started', { serverId, language, workspaceRoot });
      });

      process.on('error', (error) => {
        server.status = 'error';
        logger.error('Language server process error', { serverId, error: error.message });
      });

      process.on('exit', (code, signal) => {
        server.status = 'stopped';
        logger.info('Language server exited', { serverId, code, signal });
        this.languageServers.delete(serverId);
      });

      // Initialize LSP connection
      await this.initializeLSP(server);

      return server;
    } catch (error) {
      logger.error('Failed to start language server', { 
        userId, 
        projectId, 
        language, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Initialize LSP connection with language server
   */
  async initializeLSP(server) {
    const initializeRequest = {
      jsonrpc: '2.0',
      id: ++server.messageId,
      method: 'initialize',
      params: {
        processId: process.pid,
        clientInfo: {
          name: 'AI-IDE',
          version: '1.0.0'
        },
        rootUri: `file://${server.workspaceRoot}`,
        capabilities: {
          textDocument: {
            synchronization: {
              dynamicRegistration: false,
              willSave: true,
              didSave: true
            },
            completion: {
              dynamicRegistration: false,
              completionItem: {
                snippetSupport: true
              }
            },
            hover: {
              dynamicRegistration: false,
              contentFormat: ['markdown', 'plaintext']
            },
            definition: {
              dynamicRegistration: false,
              linkSupport: true
            },
            publishDiagnostics: {
              relatedInformation: true,
              versionSupport: true
            }
          },
          workspace: {
            applyEdit: true,
            configuration: true,
            didChangeConfiguration: {
              dynamicRegistration: false
            }
          }
        }
      }
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('LSP initialization timeout'));
      }, 10000); // 10 second timeout

      // Send initialize request
      this.sendLSPMessage(server, initializeRequest);

      // Listen for response
      const onData = (data) => {
        try {
          const messages = this.parseLSPMessages(data.toString());
          for (const message of messages) {
            if (message.id === initializeRequest.id) {
              clearTimeout(timeout);
              server.process.stdout.removeListener('data', onData);
              
              if (message.error) {
                reject(new Error(`LSP initialization failed: ${message.error.message}`));
              } else {
                // Send initialized notification
                this.sendLSPMessage(server, {
                  jsonrpc: '2.0',
                  method: 'initialized',
                  params: {}
                });
                resolve(message.result);
              }
              return;
            }
          }
        } catch (error) {
          clearTimeout(timeout);
          server.process.stdout.removeListener('data', onData);
          reject(error);
        }
      };

      server.process.stdout.on('data', onData);
    });
  }

  /**
   * Send LSP message to language server
   */
  sendLSPMessage(server, message) {
    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content, 'utf8')}\r\n\r\n`;
    const fullMessage = header + content;
    
    server.process.stdin.write(fullMessage);
    server.lastActivity = new Date();
    
    logger.debug('LSP message sent', { 
      serverId: server.id, 
      method: message.method,
      id: message.id
    });
  }

  /**
   * Parse LSP messages from server response
   */
  parseLSPMessages(data) {
    const messages = [];
    let buffer = data;
    
    while (buffer.length > 0) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      
      const header = buffer.substring(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length: (\d+)/);
      
      if (!contentLengthMatch) break;
      
      const contentLength = parseInt(contentLengthMatch[1]);
      const messageStart = headerEnd + 4;
      
      if (buffer.length < messageStart + contentLength) break;
      
      const messageContent = buffer.substring(messageStart, messageStart + contentLength);
      
      try {
        messages.push(JSON.parse(messageContent));
      } catch (error) {
        logger.warn('Failed to parse LSP message', { error: error.message, content: messageContent });
      }
      
      buffer = buffer.substring(messageStart + contentLength);
    }
    
    return messages;
  }

  /**
   * Handle LSP request from client
   */
  async handleLSPRequest(serverId, request) {
    try {
      const server = this.languageServers.get(serverId);
      if (!server || server.status !== 'running') {
        throw new Error('Language server not available');
      }

      // Add unique ID if not present
      if (!request.id) {
        request.id = ++server.messageId;
      }

      // Store pending request for response correlation
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          server.pendingRequests.delete(request.id);
          reject(new Error('LSP request timeout'));
        }, 5000); // 5 second timeout

        server.pendingRequests.set(request.id, { resolve, reject, timeout });

        // Send request to language server
        this.sendLSPMessage(server, request);

        // Set up response listener if not already set
        if (!server.responseListener) {
          server.responseListener = (data) => {
            const messages = this.parseLSPMessages(data.toString());
            for (const message of messages) {
              this.handleLSPResponse(server, message);
            }
          };
          server.process.stdout.on('data', server.responseListener);
        }
      });
    } catch (error) {
      logger.error('LSP request handling failed', { serverId, error: error.message });
      throw error;
    }
  }

  /**
   * Handle LSP response from server
   */
  handleLSPResponse(server, message) {
    if (message.id && server.pendingRequests.has(message.id)) {
      const pending = server.pendingRequests.get(message.id);
      clearTimeout(pending.timeout);
      server.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message);
      }
    } else if (message.method) {
      // Handle notifications (no ID)
      this.handleLSPNotification(server, message);
    }
  }

  /**
   * Handle LSP notifications from server
   */
  handleLSPNotification(server, notification) {
    switch (notification.method) {
      case 'textDocument/publishDiagnostics':
        logger.debug('Diagnostics received', { 
          serverId: server.id,
          uri: notification.params.uri,
          diagnosticsCount: notification.params.diagnostics?.length || 0
        });
        // Could emit to WebSocket clients here
        break;
        
      case 'window/logMessage':
        logger.debug('LSP log message', { 
          serverId: server.id,
          type: notification.params.type,
          message: notification.params.message
        });
        break;
        
      default:
        logger.debug('LSP notification received', { 
          serverId: server.id, 
          method: notification.method 
        });
    }
  }

  /**
   * Stop language server
   */
  async stopLanguageServer(serverId) {
    try {
      const server = this.languageServers.get(serverId);
      if (!server) return;

      // Send shutdown request
      if (server.status === 'running') {
        try {
          await this.sendLSPMessage(server, {
            jsonrpc: '2.0',
            id: ++server.messageId,
            method: 'shutdown',
            params: null
          });

          // Send exit notification
          this.sendLSPMessage(server, {
            jsonrpc: '2.0',
            method: 'exit'
          });
        } catch (error) {
          logger.warn('LSP shutdown request failed', { serverId, error: error.message });
        }
      }

      // Kill process if still alive
      if (server.process && !server.process.killed) {
        server.process.kill('SIGTERM');
        
        // Force kill if not dead in 5 seconds
        setTimeout(() => {
          if (!server.process.killed) {
            server.process.kill('SIGKILL');
          }
        }, 5000);
      }

      this.languageServers.delete(serverId);
      logger.info('Language server stopped', { serverId });
    } catch (error) {
      logger.error('Failed to stop language server', { serverId, error: error.message });
    }
  }

  /**
   * Check if language server command is available
   */
  async checkServerAvailability(command) {
    return new Promise((resolve) => {
      const testProcess = spawn(command, ['--version'], { stdio: 'ignore' });
      
      testProcess.on('error', () => resolve(false));
      testProcess.on('exit', (code) => resolve(code === 0));
      
      // Timeout after 3 seconds
      setTimeout(() => {
        testProcess.kill();
        resolve(false);
      }, 3000);
    });
  }

  /**
   * List active language servers for user
   */
  listLanguageServers(userId = null) {
    const servers = Array.from(this.languageServers.values());
    
    if (userId) {
      return servers.filter(server => server.userId === userId);
    }

    return servers.map(server => ({
      id: server.id,
      userId: server.userId,
      projectId: server.projectId,
      language: server.language,
      status: server.status,
      capabilities: server.capabilities,
      createdAt: server.createdAt,
      lastActivity: server.lastActivity
    }));
  }

  /**
   * Clean up inactive language servers
   */
  async performMaintenanceCleanup() {
    const cutoffTime = Date.now() - (30 * 60 * 1000); // 30 minutes ago
    const serversToCleanup = [];

    for (const [serverId, server] of this.languageServers.entries()) {
      if (server.lastActivity.getTime() < cutoffTime) {
        serversToCleanup.push(serverId);
      }
    }

    const cleanupPromises = serversToCleanup.map(serverId => 
      this.stopLanguageServer(serverId)
    );

    await Promise.allSettled(cleanupPromises);

    logger.info('LSP maintenance cleanup completed', {
      cleanedUp: serversToCleanup.length,
      activeServers: this.languageServers.size
    });

    return {
      cleanedUp: serversToCleanup.length,
      activeServers: this.languageServers.size,
      timestamp: new Date().toISOString()
    };
  }
}

export default new LSPService();