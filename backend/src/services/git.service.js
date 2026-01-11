import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

/**
 * Git Service
 * Handles git operations in Docker containers
 */
class GitService {
  /**
   * Execute git command in container
   */
  async executeGitCommand(containerId, command, workdir = '/workspace') {
    try {
      const fullCommand = `docker exec ${containerId} sh -c "cd ${workdir} && ${command}"`;
      logger.debug('Executing git command', { containerId, command });
      
      const { stdout, stderr } = await execAsync(fullCommand);
      
      if (stderr && !stderr.includes('warning')) {
        logger.warn('Git command stderr', { command, stderr });
      }
      
      return { success: true, output: stdout.trim(), error: stderr };
    } catch (error) {
      logger.error('Git command failed', { command, error: error.message });
      return { success: false, error: error.message, output: error.stdout };
    }
  }

  /**
   * Initialize git repository in container
   */
  async initRepository(containerId) {
    const result = await this.executeGitCommand(containerId, 'git init');
    if (result.success) {
      // Configure git user
      await this.executeGitCommand(containerId, 'git config user.name "AI-IDE User"');
      await this.executeGitCommand(containerId, 'git config user.email "user@ai-ide.local"');
    }
    return result;
  }

  /**
   * Get git status
   */
  async getStatus(containerId) {
    // Check if git is initialized, if not initialize it
    const checkResult = await this.executeGitCommand(containerId, 'git rev-parse --git-dir');
    if (!checkResult.success || checkResult.error.includes('not a git repository')) {
      // Auto-initialize git repository
      await this.initRepository(containerId);
    }

    const result = await this.executeGitCommand(
      containerId, 
      'git status --porcelain --branch'
    );
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      status: this.parseGitStatus(result.output)
    };
  }

  /**
   * Parse git status output
   */
  parseGitStatus(output) {
    const lines = output.split('\n');
    const status = {
      branch: 'main',
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: []
    };

    for (const line of lines) {
      if (line.startsWith('##')) {
        // Branch info
        const branchMatch = line.match(/## ([^\s.]+)/);
        if (branchMatch) status.branch = branchMatch[1];
        
        const aheadMatch = line.match(/ahead (\d+)/);
        if (aheadMatch) status.ahead = parseInt(aheadMatch[1]);
        
        const behindMatch = line.match(/behind (\d+)/);
        if (behindMatch) status.behind = parseInt(behindMatch[1]);
      } else if (line.trim()) {
        const statusCode = line.substring(0, 2);
        const filePath = line.substring(3);
        
        // Parse file status
        const fileInfo = { path: filePath, type: 'modified' };
        
        if (statusCode === '??') {
          fileInfo.type = 'untracked';
          status.untracked.push(fileInfo);
        } else {
          // Staged changes (index)
          if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
            if (statusCode[0] === 'A') fileInfo.type = 'added';
            else if (statusCode[0] === 'D') fileInfo.type = 'deleted';
            else if (statusCode[0] === 'R') fileInfo.type = 'renamed';
            else if (statusCode[0] === 'M') fileInfo.type = 'modified';
            status.staged.push({ ...fileInfo });
          }
          
          // Unstaged changes (working tree)
          if (statusCode[1] !== ' ' && statusCode[1] !== '?') {
            if (statusCode[1] === 'M') fileInfo.type = 'modified';
            else if (statusCode[1] === 'D') fileInfo.type = 'deleted';
            status.unstaged.push({ ...fileInfo });
          }
        }
      }
    }

    return status;
  }

  /**
   * Stage files
   */
  async stageFiles(containerId, files) {
    const filesList = Array.isArray(files) ? files.join(' ') : files;
    return await this.executeGitCommand(containerId, `git add ${filesList}`);
  }

  /**
   * Stage all files
   */
  async stageAll(containerId) {
    return await this.executeGitCommand(containerId, 'git add -A');
  }

  /**
   * Unstage files
   */
  async unstageFiles(containerId, files) {
    const filesList = Array.isArray(files) ? files.join(' ') : files;
    return await this.executeGitCommand(containerId, `git reset HEAD ${filesList}`);
  }

  /**
   * Unstage all files
   */
  async unstageAll(containerId) {
    return await this.executeGitCommand(containerId, 'git reset HEAD');
  }

  /**
   * Commit changes
   */
  async commit(containerId, message) {
    const escapedMessage = message.replace(/"/g, '\\"');
    return await this.executeGitCommand(containerId, `git commit -m "${escapedMessage}"`);
  }

  /**
   * Get commit history
   */
  async getLog(containerId, limit = 10) {
    const result = await this.executeGitCommand(
      containerId,
      `git log --oneline -n ${limit} --pretty=format:"%h|%an|%ar|%s"`
    );
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const commits = result.output.split('\n').map(line => {
      const [hash, author, time, message] = line.split('|');
      return { hash, author, time, message };
    }).filter(c => c.hash);

    return { success: true, commits };
  }

  /**
   * Get branches
   */
  async getBranches(containerId) {
    const result = await this.executeGitCommand(containerId, 'git branch -a');
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const branches = result.output.split('\n')
      .map(b => b.trim().replace(/^\* /, ''))
      .filter(b => b);

    return { success: true, branches };
  }

  /**
   * Create branch
   */
  async createBranch(containerId, branchName) {
    return await this.executeGitCommand(containerId, `git branch ${branchName}`);
  }

  /**
   * Checkout branch
   */
  async checkoutBranch(containerId, branchName) {
    return await this.executeGitCommand(containerId, `git checkout ${branchName}`);
  }

  /**
   * Get diff for file
   */
  async getDiff(containerId, filePath, staged = false) {
    const command = staged 
      ? `git diff --cached ${filePath}`
      : `git diff ${filePath}`;
    return await this.executeGitCommand(containerId, command);
  }

  /**
   * Discard changes
   */
  async discardChanges(containerId, files) {
    const filesList = Array.isArray(files) ? files.join(' ') : files;
    return await this.executeGitCommand(containerId, `git checkout -- ${filesList}`);
  }
}

export default new GitService();
