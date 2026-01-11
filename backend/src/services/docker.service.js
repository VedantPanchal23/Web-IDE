import Docker from 'dockerode';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import tar from 'tar-stream';
import { Readable } from 'stream';

class DockerService {
  constructor() {
    this.docker = new Docker();
    this.containers = new Map(); // Track active containers
    this.workspaceVolumes = new Map(); // Track workspace volumes
    this.maxContainers = parseInt(process.env.MAX_CONTAINERS_PER_USER) || 5;
    this.containerTimeout = parseInt(process.env.CONTAINER_TIMEOUT) || 1800000; // 30 minutes idle timeout
    this.containerIdleCheckInterval = 60000; // Check for idle containers every 1 minute
    this.allowedImages = [
      'node:18-alpine',
      'python:3.11-alpine',
      'openjdk:17-slim',
      'gcc:latest',
      'ai-ide-universal-runner'  // Universal container with Python, Node.js, Java, C++
    ];
    
    // Start idle container cleanup checker
    this.startIdleContainerCleanup();
  }
  
  /**
   * Start periodic check for idle containers (GitHub Codespaces-style)
   */
  startIdleContainerCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [containerId, containerInfo] of this.containers.entries()) {
        // Handle both Date objects and timestamps
        const lastActivityTime = containerInfo.lastActivity instanceof Date 
          ? containerInfo.lastActivity.getTime() 
          : (typeof containerInfo.lastActivity === 'number' ? containerInfo.lastActivity : Date.now());
        const idleTime = now - lastActivityTime;
        
        // Only cleanup containers idle for longer than timeout
        if (idleTime > this.containerTimeout) {
          logger.info('♻️ Cleaning up idle container', { 
            containerId, 
            idleMinutes: Math.floor(idleTime / 60000)
          });
          this.cleanupContainer(containerId).catch(error => {
            logger.error('Failed to cleanup idle container', { containerId, error: error.message });
          });
        }
      }
    }, this.containerIdleCheckInterval);
  }

  /**
   * Create and start a new container for code execution or terminal
   */
  async createContainer(userId, language, options = {}) {
    try {
      // Security: Limit containers per user
      const userContainers = this.getUserContainers(userId);
      if (userContainers.length >= this.maxContainers) {
        throw new Error(`Maximum container limit reached (${this.maxContainers})`);
      }

      const image = this.getImageForLanguage(language);
      const containerId = uuidv4();

      // Determine if this is for terminal or code execution
      const isTerminal = options.isTerminal || false;
      
      // Different CMD for terminal vs code execution
      let cmd;
      if (isTerminal) {
        // For terminal: start bash and keep it running
        cmd = ['/bin/bash', '-c', 'while true; do sleep 3600; done'];
      } else {
        // For code execution: use language-specific default
        cmd = options.Cmd || this.getDefaultCommandForLanguage(language);
      }

      // Create workspace volume name for persistent storage
      const workspaceVolumeName = `ai-ide-workspace-${userId}-${options.projectId || 'default'}`;
      
      // Security configuration
      const containerConfig = {
        Image: image,
        name: `ai-ide-${userId}-${containerId}`,
        Cmd: cmd,
        Tty: true,
        OpenStdin: true,
        StdinOnce: false,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/workspace',
        Env: [
          'NODE_ENV=development',
          'PYTHONUNBUFFERED=1',
          'JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64',
          'HOME=/workspace',
          'USER=root',
          'TERM=xterm-256color',
          'PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin'
        ],
        HostConfig: {
          Memory: 2048 * 1024 * 1024, // 2GB limit
          CpuQuota: 200000, // 200% CPU limit (2 cores)
          NetworkMode: 'bridge', // Always allow network for terminals
          ReadonlyRootfs: false,
          Binds: [
            // Mount persistent workspace volume
            `${workspaceVolumeName}:/workspace`
          ],
          Tmpfs: {
            '/tmp': 'rw,exec,nosuid,size=500m'
          },
          Ulimits: [
            {
              Name: 'nproc',
              Soft: 256,
              Hard: 256
            },
            {
              Name: 'nofile',
              Soft: 4096,
              Hard: 4096
            }
          ],
          SecurityOpt: [
            'no-new-privileges:true'
          ],
          CapDrop: ['ALL'],
          CapAdd: ['SETUID', 'SETGID', 'CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'NET_BIND_SERVICE'],
          PidsLimit: 256,
          User: 'root' // Run as root to avoid permission issues
        }
      };

      // Ensure workspace volume exists and is initialized
      await this.ensureWorkspaceVolume(workspaceVolumeName, userId, options.projectId);

      logger.info('🐳 Creating container', { userId, language, containerId, workspaceVolume: workspaceVolumeName });

      const container = await this.docker.createContainer(containerConfig);
      await container.start();

      // Wait for container to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Store container info
      const containerInfo = {
        id: containerId,
        dockerId: container.id,
        userId,
        language,
        container,
        volumeName: workspaceVolumeName,
        createdAt: new Date(),
        lastActivity: new Date(),
        workspaceInitialized: false
      };

      this.containers.set(containerId, containerInfo);

      logger.info('✅ Container created successfully', { 
        containerId, 
        dockerId: container.id,
        userId,
        volumeName: workspaceVolumeName
      });

      return containerInfo;
    } catch (error) {
      logger.error('❌ Failed to create container', { userId, language, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Ensure workspace volume exists and initialize with project files
   */
  async ensureWorkspaceVolume(volumeName, userId, projectId) {
    try {
      // Check if volume already exists
      let volume;
      try {
        volume = this.docker.getVolume(volumeName);
        await volume.inspect();
        logger.debug('Workspace volume already exists', { volumeName, userId, projectId });
        return volume;
      } catch (error) {
        if (error.statusCode === 404) {
          // Volume doesn't exist, create it
          logger.info('Creating new workspace volume', { volumeName, userId, projectId });
          volume = await this.docker.createVolume({
            Name: volumeName,
            Labels: {
              'ai-ide.user': userId,
              'ai-ide.project': projectId || 'default',
              'ai-ide.type': 'workspace'
            }
          });
        } else {
          throw error;
        }
      }

      // Track volume
      this.workspaceVolumes.set(volumeName, {
        name: volumeName,
        userId,
        projectId,
        volume,
        createdAt: new Date()
      });

      return volume;
    } catch (error) {
      logger.error('Failed to ensure workspace volume', { 
        volumeName, 
        userId, 
        projectId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Execute command in container
   */
  async executeCommand(containerId, command, options = {}) {
    try {
      const containerInfo = this.containers.get(containerId);
      if (!containerInfo) {
        throw new Error('Container not found');
      }

      const { container } = containerInfo;
      
      // Update last activity
      containerInfo.lastActivity = new Date();

      // Execute commands via bash for better compatibility
      const execOptions = {
        Cmd: ['/bin/bash', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/workspace',
        ...options
      };

      logger.debug('Executing command in container', { 
        containerId, 
        command 
      });

      const exec = await container.exec(execOptions);
      const stream = await exec.start({ 
        hijack: true, 
        stdin: true 
      });

      // Collect output
      let output = '';
      let error = '';

      stream.on('data', (data) => {
        const str = data.toString();
        output += str;
      });

      // Wait for completion
      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
        setTimeout(() => resolve(), 5000); // Timeout after 5 seconds
      });

      // Check exit code
      const inspection = await exec.inspect();
      if (inspection.ExitCode !== 0 && inspection.ExitCode !== null) {
        logger.warn('Command exited with non-zero code', { 
          containerId, 
          command, 
          exitCode: inspection.ExitCode,
          output 
        });
      }

      return { output, exitCode: inspection.ExitCode };
    } catch (error) {
      logger.error('Failed to execute command in container', { 
        containerId, 
        command, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Upload files to container
   */
  async uploadFiles(containerId, files) {
    try {
      const containerInfo = this.containers.get(containerId);
      if (!containerInfo) {
        throw new Error('Container not found');
      }

      const { container } = containerInfo;
      
      // Validate files array
      if (!Array.isArray(files) || files.length === 0) {
        logger.warn('No files to upload', { containerId });
        return true;
      }

      logger.debug('Starting file upload', { 
        containerId,
        fileCount: files.length,
        filesData: JSON.stringify(files.map(f => ({
          name: f.name,
          hasContent: !!f.content,
          contentType: typeof f.content,
          contentLength: f.content?.length || 0
        })))
      });

      const pack = tar.pack();

      // Add files to tar archive
      for (const file of files) {
        // Validate file object
        if (!file || typeof file !== 'object') {
          logger.error('Invalid file object', { file });
          continue;
        }

        // Ensure name and content are valid strings
        const fileName = String(file.name || 'unnamed-file.txt').trim() || 'unnamed-file.txt';
        const content = String(file.content || '');
        
        logger.debug('Processing file for tar', { 
          fileName,
          contentLength: content.length
        });
        
        // Create a buffer from the content
        const buffer = Buffer.from(content, 'utf8');

        // Add entry to tar - use simpler synchronous API
        pack.entry({ 
          name: fileName,
          size: buffer.length
        }, buffer);
      }
      
      pack.finalize();

      logger.debug('Tar archive created, uploading to container');
      await container.putArchive(pack, { path: '/workspace' });

      logger.info('Files uploaded to container', { 
        containerId, 
        fileCount: files.length 
      });

      return true;
    } catch (error) {
      logger.error('Failed to upload files to container', { 
        containerId, 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Download files from container
   */
  async downloadFiles(containerId, paths) {
    try {
      const containerInfo = this.containers.get(containerId);
      if (!containerInfo) {
        throw new Error('Container not found');
      }

      const { container } = containerInfo;
      const files = [];

      for (const path of paths) {
        try {
          const stream = await container.getArchive({ path: `/workspace/${path}` });
          const extract = tar.extract();
          
          await new Promise((resolve, reject) => {
            extract.on('entry', (header, stream, next) => {
              const chunks = [];
              stream.on('data', chunk => chunks.push(chunk));
              stream.on('end', () => {
                files.push({
                  name: header.name,
                  content: Buffer.concat(chunks).toString()
                });
                next();
              });
              stream.resume();
            });
            extract.on('finish', resolve);
            extract.on('error', reject);
            
            stream.pipe(extract);
          });
        } catch (fileError) {
          logger.warn('Failed to download file', { path, error: fileError.message });
        }
      }

      return files;
    } catch (error) {
      logger.error('Failed to download files from container', { 
        containerId, 
        paths, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Clean up container
   */
  async cleanupContainer(containerId) {
    try {
      const containerInfo = this.containers.get(containerId);
      if (!containerInfo) {
        return;
      }

      const { container, userId } = containerInfo;

      // Mark as being cleaned up to prevent duplicate cleanup
      if (containerInfo.cleaning) {
        logger.debug('Container cleanup already in progress', { containerId });
        return;
      }
      containerInfo.cleaning = true;

      logger.info('Cleaning up container', { containerId, userId });

      try {
        // Check if container still exists
        const containerData = await container.inspect();
        if (containerData.State.Running) {
          await container.stop({ t: 10 }); // 10 second grace period
        }
      } catch (stopError) {
        // Container might already be stopped or not exist
        logger.debug('Container stop failed (may already be stopped)', { 
          containerId, 
          error: stopError.message 
        });
      }

      try {
        await container.remove({ force: true });
      } catch (removeError) {
        // Check if it's already being removed or doesn't exist
        if (removeError.statusCode === 409 || removeError.statusCode === 404) {
          logger.debug('Container already being removed or does not exist', { 
            containerId, 
            statusCode: removeError.statusCode 
          });
        } else {
          logger.error('Container removal failed', { 
            containerId, 
            error: removeError.message 
          });
        }
      }

      this.containers.delete(containerId);

      logger.info('Container cleaned up successfully', { containerId, userId });
    } catch (error) {
      logger.error('Container cleanup failed', { containerId, error: error.message });
    }
  }

  /**
   * Get containers for a specific user
   */
  getUserContainers(userId) {
    return Array.from(this.containers.values()).filter(
      container => container.userId === userId
    );
  }

  /**
   * Clean up all containers for a user
   */
  async cleanupUserContainers(userId) {
    const userContainers = this.getUserContainers(userId);
    await Promise.all(
      userContainers.map(container => this.cleanupContainer(container.id))
    );
  }

  /**
   * Update container last activity timestamp (keeps it alive)
   */
  updateContainerActivity(containerId) {
    const containerInfo = this.containers.get(containerId);
    if (containerInfo) {
      containerInfo.lastActivity = new Date();
      logger.debug('📍 Container activity updated', { containerId });
    }
  }

  /**
   * Get image name for programming language
   */
  getImageForLanguage(language) {
    // Use universal container for all languages (terminals and code execution)
    // Universal container has Python, Node.js, Java, and C++ pre-installed
    const imageMap = {
      javascript: 'ai-ide-universal-runner',
      typescript: 'ai-ide-universal-runner', 
      node: 'ai-ide-universal-runner',
      python: 'ai-ide-universal-runner',
      java: 'ai-ide-universal-runner',
      c: 'ai-ide-universal-runner',
      cpp: 'ai-ide-universal-runner',
      bash: 'ai-ide-universal-runner',
      sh: 'ai-ide-universal-runner'
    };

    const image = imageMap[language.toLowerCase()] || 'ai-ide-universal-runner';
    
    if (!this.allowedImages.includes(image)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    return image;
  }

  /**
   * Get default command for language containers
   */
  getDefaultCommandForLanguage(language) {
    // All execution containers need to stay alive for exec commands
    // Use tail -f /dev/null as it's more reliable than while loops
    const keepAliveCmd = ['tail', '-f', '/dev/null'];
    
    const commandMap = {
      javascript: keepAliveCmd,
      typescript: keepAliveCmd,
      python: keepAliveCmd,
      java: keepAliveCmd,
      c: keepAliveCmd,
      cpp: keepAliveCmd
    };

    return commandMap[language.toLowerCase()] || keepAliveCmd;
  }

  /**
   * Extract Java class name from code
   */
  extractJavaClassName(code) {
    // Look for public class declaration
    const publicClassMatch = code.match(/public\s+class\s+(\w+)/);
    if (publicClassMatch) {
      return publicClassMatch[1];
    }
    
    // Look for any class declaration
    const classMatch = code.match(/class\s+(\w+)/);
    if (classMatch) {
      return classMatch[1];
    }
    
    // Default to Main if no class found
    return 'Main';
  }

  /**
   * Escape string for shell command
   */
  escapeForShell(str) {
    return str.replace(/'/g, "'\"'\"'");
  }

  /**
   * Build command array for different languages
   */
  buildCommand(language, userCommand) {
    const lang = language.toLowerCase();
    
    if (lang === 'java') {
      const className = this.extractJavaClassName(userCommand);
      const fileName = `${className}.java`;
      return ['sh', '-c', `cat > ${fileName} << 'EOF'\n${userCommand}\nEOF\njavac ${fileName} && java ${className}`];
    }
    
    const commandMap = {
      javascript: ['node', '-e', userCommand],
      typescript: ['npx', 'ts-node', '-e', userCommand],
      python: ['python3', '-c', userCommand],
      c: ['sh', '-c', `cat > main.c << 'EOF'\n${userCommand}\nEOF\ngcc -o main main.c && ./main`],
      cpp: ['sh', '-c', `cat > main.cpp << 'EOF'\n${userCommand}\nEOF\ng++ -o main main.cpp && ./main`]
    };

    return commandMap[lang] || ['sh', '-c', userCommand];
  }

  /**
   * Get container stats
   */
  async getContainerStats(containerId) {
    try {
      const containerInfo = this.containers.get(containerId);
      if (!containerInfo) {
        throw new Error('Container not found');
      }

      const stats = await containerInfo.container.stats({ stream: false });
      return {
        memory: stats.memory_stats,
        cpu: stats.cpu_stats,
        networks: stats.networks,
        blkio: stats.blkio_stats
      };
    } catch (error) {
      logger.error('Failed to get container stats', { containerId, error: error.message });
      throw error;
    }
  }

  /**
   * List all active containers
   */
  listContainers(userId = null) {
    const containers = Array.from(this.containers.values());
    
    if (userId) {
      return containers.filter(container => container.userId === userId);
    }

    return containers.map(container => ({
      id: container.id,
      userId: container.userId,
      language: container.language,
      createdAt: container.createdAt,
      lastActivity: container.lastActivity
    }));
  }

  /**
   * Health check - ensure Docker daemon is running
   */
  async healthCheck() {
    try {
      const ping = await this.docker.ping();
      const info = await this.docker.info();
      
      return { 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        containers: {
          running: info.ContainersRunning || 0,
          paused: info.ContainersPaused || 0,
          stopped: info.ContainersStopped || 0
        },
        images: info.Images || 0,
        version: info.ServerVersion,
        memoryLimit: info.MemTotal,
        cpuCount: info.NCPU
      };
    } catch (error) {
      logger.error('Docker health check failed', { error: error.message });
      return { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  }

  /**
   * Monitor container resource usage
   */
  async monitorContainerResources(containerId) {
    try {
      const containerInfo = this.containers.get(containerId);
      if (!containerInfo) {
        throw new Error('Container not found');
      }

      const stats = await containerInfo.container.stats({ stream: false });
      
      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 0;
      const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

      const cpuUsage = this.calculateCpuPercent(stats.cpu_stats, stats.precpu_stats);

      const resourceUsage = {
        memory: {
          used: memoryUsage,
          limit: memoryLimit,
          percent: Math.round(memoryPercent * 100) / 100
        },
        cpu: {
          percent: Math.round(cpuUsage * 100) / 100
        },
        pids: stats.pids_stats?.current || 0,
        timestamp: new Date().toISOString()
      };

      // Log warning if resource usage is high
      if (memoryPercent > 80) {
        logger.warn('High memory usage detected', { 
          containerId, 
          memoryPercent: resourceUsage.memory.percent 
        });
      }

      if (cpuUsage > 90) {
        logger.warn('High CPU usage detected', { 
          containerId, 
          cpuPercent: resourceUsage.cpu.percent 
        });
      }

      return resourceUsage;
    } catch (error) {
      logger.error('Failed to monitor container resources', { 
        containerId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Calculate CPU usage percentage
   */
  calculateCpuPercent(cpuStats, preCpuStats) {
    if (!cpuStats || !preCpuStats) return 0;

    const cpuDelta = (cpuStats.cpu_usage?.total_usage || 0) - 
                     (preCpuStats.cpu_usage?.total_usage || 0);
    const systemDelta = (cpuStats.system_cpu_usage || 0) - 
                        (preCpuStats.system_cpu_usage || 0);

    if (systemDelta > 0 && cpuDelta > 0) {
      const cpuCount = cpuStats.online_cpus || 1;
      return (cpuDelta / systemDelta) * cpuCount * 100;
    }

    return 0;
  }

  /**
   * Security audit for containers
   */
  async auditContainerSecurity(containerId) {
    try {
      const containerInfo = this.containers.get(containerId);
      if (!containerInfo) {
        throw new Error('Container not found');
      }

      const inspectData = await containerInfo.container.inspect();
      const config = inspectData.Config;
      const hostConfig = inspectData.HostConfig;

      const securityAudit = {
        containerId,
        securityIssues: [],
        securityScore: 100,
        timestamp: new Date().toISOString()
      };

      // Check for security issues
      if (config.User === '' || config.User === 'root') {
        securityAudit.securityIssues.push('Container running as root user');
        securityAudit.securityScore -= 20;
      }

      if (!hostConfig.ReadonlyRootfs) {
        securityAudit.securityIssues.push('Root filesystem is writable');
        securityAudit.securityScore -= 10;
      }

      if (hostConfig.Privileged) {
        securityAudit.securityIssues.push('Container running in privileged mode');
        securityAudit.securityScore -= 30;
      }

      if (!hostConfig.SecurityOpt?.includes('no-new-privileges:true')) {
        securityAudit.securityIssues.push('No-new-privileges not set');
        securityAudit.securityScore -= 15;
      }

      if (hostConfig.NetworkMode === 'host') {
        securityAudit.securityIssues.push('Container using host network');
        securityAudit.securityScore -= 25;
      }

      if (!hostConfig.Memory || hostConfig.Memory > 1024 * 1024 * 1024) {
        securityAudit.securityIssues.push('Memory limit not set or too high');
        securityAudit.securityScore -= 10;
      }

      return securityAudit;
    } catch (error) {
      logger.error('Failed to audit container security', { 
        containerId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Clean up containers based on resource usage and age
   */
  async performMaintenanceCleanup() {
    const cutoffTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
    const containersToCleanup = [];

    for (const [containerId, containerInfo] of this.containers.entries()) {
      // Check if container is old and inactive
      if (containerInfo.createdAt.getTime() < cutoffTime) {
        try {
          const stats = await this.monitorContainerResources(containerId);
          
          // Clean up if very low resource usage for extended time
          if (stats.cpu.percent < 1 && stats.memory.percent < 5) {
            containersToCleanup.push(containerId);
          }
        } catch (error) {
          // If we can't get stats, container might be dead - clean it up
          containersToCleanup.push(containerId);
        }
      }
    }

    // Clean up identified containers
    const cleanupPromises = containersToCleanup.map(containerId => 
      this.cleanupContainer(containerId)
    );

    await Promise.allSettled(cleanupPromises);

    logger.info('Maintenance cleanup completed', { 
      cleanedUp: containersToCleanup.length,
      activeContainers: this.containers.size
    });

    return {
      cleanedUp: containersToCleanup.length,
      activeContainers: this.containers.size,
      timestamp: new Date().toISOString()
    };
  }
}

const dockerServiceInstance = new DockerService();

// Start periodic maintenance cleanup (every 30 minutes)
setInterval(async () => {
  try {
    await dockerServiceInstance.performMaintenanceCleanup();
  } catch (error) {
    logger.error('Maintenance cleanup failed', { error: error.message });
  }
}, 30 * 60 * 1000); // 30 minutes

export default dockerServiceInstance;