import express from 'express';
import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.js';
import { File } from '../models/File.js';
import { User } from '../models/User.js';
import { driveFileService } from '../services/driveFile.service.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/v1/projects/debug
 * @desc    Debug authentication for projects
 * @access  Private
 */
router.get('/debug', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Authentication working',
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Debug failed',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/projects
 * @desc    Get all user projects
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    logger.info('Get all projects requested', { userId: req.user.id });

    // Simplified query without populate to avoid potential issues
    const projects = await Project.find({ owner: req.user.id })
      .sort({ lastAccessed: -1 })
      .limit(50);

    logger.info('Projects found', { count: projects.length, userId: req.user.id });

    res.json({
      success: true,
      message: 'Projects retrieved successfully',
      projects: projects.map(project => ({
        id: project._id,
        name: project.name,
        description: project.description,
        language: project.programmingLanguage,
        framework: project.framework,
        lastAccessed: project.lastAccessed,
        syncStatus: project.syncStatus || 'idle',
        fileCount: project.fileCount || 0,
        size: project.size || 0,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        settings: project.settings || {},
        metadata: project.metadata || {}
      }))
    });
  } catch (error) {
    logger.error('Failed to get projects', {
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve projects',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/v1/projects
 * @desc    Create a new project
 * @access  Private
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, language, framework, template } = req.body;

    logger.info('Create project requested', {
      name,
      language,
      userId: req.user.id
    });

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Project name is required'
      });
    }

    // Check if project name already exists for this user
    const existingProject = await Project.findOne({
      owner: req.user.id,
      name: name.trim()
    });

    if (existingProject) {
      return res.status(409).json({
        success: false,
        message: 'A project with this name already exists'
      });
    }

    // Get user with Drive tokens
    const user = await User.findById(req.user.id).select('+driveAccessToken +driveRefreshToken');
    if (!user || !user.driveAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Google Drive access token not found. Please re-authenticate.'
      });
    }

    // Initialize Drive service with user's access token
    driveFileService.initialize(user.driveAccessToken);

    // Get or create the main projects folder
    const projectsFolder = await driveFileService.getOrCreateProjectsFolder();

    // Create project folder in Google Drive
    const projectFolder = await driveFileService.createProjectFolder(
      name.trim(),
      projectsFolder.id
    );

    // Create project in database (temporarily without language field)
    const projectData = {
      name: name.trim(),
      description: description?.trim() || '',
      owner: req.user.id,
      programmingLanguage: language || 'javascript',
      framework: framework || null,
      driveId: projectFolder.id,
      driveFolderId: projectFolder.id,
      metadata: {
        createdFrom: template ? 'template' : 'scratch',
        template: template || null,
        version: '1.0.0'
      }
    };

    logger.info('Creating project with data (without language):', projectData);

    const project = new Project(projectData);
    
    // Set programmingLanguage after creation to avoid validation issues
    project.programmingLanguage = language || 'javascript';
    
    logger.info('Set programmingLanguage after creation:', project.programmingLanguage);

    await project.save();

    // Try to save project first to isolate the issue
    await project.save();
    
    // Create initial files based on template or language
    let initialFiles = [];
    try {
      initialFiles = await createInitialFiles(project, language, template, user.driveAccessToken);
      
      // Update project file count
      project.fileCount = initialFiles.length;
      await project.save();
    } catch (error) {
      logger.error('Failed to create initial files, but project was saved', {
        error: error.message,
        projectId: project._id
      });
    }

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project: {
        id: project._id,
        name: project.name,
        description: project.description,
        language: project.programmingLanguage,
        framework: project.framework,
        driveId: project.driveId,
        syncStatus: project.syncStatus,
        fileCount: project.fileCount,
        createdAt: project.createdAt,
        settings: project.settings,
        metadata: project.metadata
      },
      files: initialFiles
    });
  } catch (error) {
    logger.error('Failed to create project', {
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to create project',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Helper function to create initial files
async function createInitialFiles(project, language, template, accessToken) {
  const files = [];

  try {
    driveFileService.initialize(accessToken);

    const templates = {
      blank: [
        { name: 'README.md', content: `# ${project.name}\n\n${project.description || 'Your project description here.'}\n\n## Getting Started\n\nStart building your project!\n` }
      ],
      javascript: [
        { name: 'index.js', content: '// Node.js Project\nconsole.log("Hello from Node.js!");\n' },
        { name: 'package.json', content: `{\n  "name": "${project.name.toLowerCase().replace(/\\s+/g, '-')}",\n  "version": "1.0.0",\n  "description": "${project.description || ''}",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js"\n  }\n}\n` },
        { name: 'README.md', content: `# ${project.name}\n\n${project.description || ''}\n\n## Getting Started\n\n\`\`\`bash\nnode index.js\n\`\`\`\n` }
      ],
      python: [
        { name: 'main.py', content: '# Python Project\nprint("Hello from Python!")\n' },
        { name: 'requirements.txt', content: '# Add your Python dependencies here\n' },
        { name: 'README.md', content: `# ${project.name}\n\n${project.description || ''}\n\n## Getting Started\n\n\`\`\`bash\npython main.py\n\`\`\`\n` }
      ],
      react: [
        { name: 'App.jsx', content: 'import React from "react";\n\nfunction App() {\n  return (\n    <div>\n      <h1>Hello React!</h1>\n      <p>Welcome to your React app</p>\n    </div>\n  );\n}\n\nexport default App;\n' },
        { name: 'index.js', content: 'import React from "react";\nimport ReactDOM from "react-dom";\nimport App from "./App";\n\nReactDOM.render(<App />, document.getElementById("root"));\n' },
        { name: 'package.json', content: `{\n  "name": "${project.name.toLowerCase().replace(/\\s+/g, '-')}",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.0.0",\n    "react-dom": "^18.0.0"\n  }\n}\n` },
        { name: 'README.md', content: `# ${project.name}\n\nReact application.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n` }
      ],
      jupyter: [
        { name: 'notebook.ipynb', content: '{\n  "cells": [],\n  "metadata": {},\n  "nbformat": 4,\n  "nbformat_minor": 2\n}\n' },
        { name: 'requirements.txt', content: 'jupyter\nnumpy\npandas\nmatplotlib\nseaborn\n' },
        { name: 'README.md', content: `# ${project.name}\n\nData science project with Jupyter notebooks.\n\n## Getting Started\n\n\`\`\`bash\npip install -r requirements.txt\njupyter notebook\n\`\`\`\n` }
      ],
      java: [
        { name: 'Main.java', content: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}\n' },
        { name: 'pom.xml', content: `<project xmlns="http://maven.apache.org/POM/4.0.0">\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>com.example</groupId>\n  <artifactId>${project.name.toLowerCase().replace(/\\s+/g, '-')}</artifactId>\n  <version>1.0</version>\n  <properties>\n    <maven.compiler.source>11</maven.compiler.source>\n    <maven.compiler.target>11</maven.compiler.target>\n  </properties>\n</project>\n` },
        { name: 'README.md', content: `# ${project.name}\n\nJava project with Maven.\n\n## Getting Started\n\n\`\`\`bash\nmvn compile\nmvn exec:java\n\`\`\`\n` }
      ],
      cpp: [
        { name: 'main.cpp', content: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++!" << std::endl;\n    return 0;\n}\n' },
        { name: 'CMakeLists.txt', content: `cmake_minimum_required(VERSION 3.10)\nproject(${project.name.replace(/\\s+/g, '_')})\nset(CMAKE_CXX_STANDARD 17)\nadd_executable(main main.cpp)\n` },
        { name: 'README.md', content: `# ${project.name}\n\nC++ project with CMake.\n\n## Getting Started\n\n\`\`\`bash\nmkdir build && cd build\ncmake ..\nmake\n./main\n\`\`\`\n` }
      ],
      html: [
        { name: 'index.html', content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>${project.name}</title>\n    <link rel="stylesheet" href="style.css">\n</head>\n<body>\n    <h1>Welcome to ${project.name}!</h1>\n    <p>${project.description || ''}</p>\n    <script src="script.js"></script>\n</body>\n</html>\n` },
        { name: 'style.css', content: 'body {\n    font-family: Arial, sans-serif;\n    margin: 40px;\n    line-height: 1.6;\n}\n\nh1 {\n    color: #333;\n}\n' },
        { name: 'script.js', content: '// Add your JavaScript code here\nconsole.log("Project loaded successfully!");\n' }
      ]
    };

    // Use template name if provided, fallback to language
    const templateKey = template || language || 'blank';
    const fileTemplates = templates[templateKey] || templates.blank;

    for (const fileTemplate of fileTemplates) {
      // Create file in Google Drive
      const driveFile = await driveFileService.createFile(
        fileTemplate.name,
        fileTemplate.content,
        project.driveFolderId,
        'text/plain'
      );

      // Create file in database
      const file = new File({
        name: fileTemplate.name,
        path: `/${fileTemplate.name}`,
        type: 'file',
        content: fileTemplate.content,
        project: project._id,
        driveId: driveFile.id,
        mimeType: 'text/plain',
        size: Buffer.byteLength(fileTemplate.content, 'utf8'),
        metadata: {
          lastEditedBy: project.owner
        }
      });

      await file.save();
      files.push({
        id: file._id,
        name: file.name,
        path: file.path,
        type: file.type,
        size: file.size,
        extension: file.extension,
        metadata: file.metadata,
        syncStatus: file.syncStatus
      });
    }

    return files;
  } catch (error) {
    logger.error('Failed to create initial files', {
      error: error.message,
      projectId: project._id
    });
    return [];
  }
}

/**
 * @route   GET /api/v1/projects/:id
 * @desc    Get a specific project
 * @access  Private
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Get project requested', { projectId: id, userId: req.user.id });

    const project = await Project.findOne({
      _id: id,
      owner: req.user.id
    }).populate('files');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Update last accessed time
    await project.updateLastAccessed();

    // Get file tree
    const fileTree = await File.getFileTree(project._id);

    res.json({
      success: true,
      message: 'Project retrieved successfully',
      project: {
        id: project._id,
        name: project.name,
        description: project.description,
        language: project.programmingLanguage,
        framework: project.framework,
        lastAccessed: project.lastAccessed,
        syncStatus: project.syncStatus,
        fileCount: project.fileCount,
        size: project.size,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        settings: project.settings,
        metadata: project.metadata,
        fileTree
      }
    });
  } catch (error) {
    logger.error('Failed to get project', {
      error: error.message,
      projectId: req.params.id,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve project',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   PUT /api/v1/projects/:id
 * @desc    Update a project
 * @access  Private
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, language, framework, settings } = req.body;

    logger.info('Update project requested', { projectId: id, userId: req.user.id });

    const project = await Project.findOne({
      _id: id,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if new name conflicts with existing projects
    if (name && name !== project.name) {
      const existingProject = await Project.findOne({
        owner: req.user.id,
        name: name.trim(),
        _id: { $ne: id }
      });

      if (existingProject) {
        return res.status(409).json({
          success: false,
          message: 'A project with this name already exists'
        });
      }

      // Update folder name in Google Drive
      try {
        const user = await User.findById(req.user.id).select('+driveAccessToken');
        if (user && user.driveAccessToken) {
          driveFileService.initialize(user.driveAccessToken);
          await driveFileService.renameFile(project.driveId, name.trim());
        }
      } catch (error) {
        logger.warn('Failed to update project folder name in Drive', {
          error: error.message,
          projectId: id
        });
      }
    }

    // Update project fields
    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();
    if (language) project.language = language;
    if (framework !== undefined) project.framework = framework;
    if (settings) {
      project.settings = { ...project.settings, ...settings };
    }

    await project.save();

    res.json({
      success: true,
      message: 'Project updated successfully',
      project: {
        id: project._id,
        name: project.name,
        description: project.description,
        language: project.programmingLanguage,
        framework: project.framework,
        settings: project.settings,
        updatedAt: project.updatedAt
      }
    });
  } catch (error) {
    logger.error('Failed to update project', {
      error: error.message,
      projectId: req.params.id,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to update project',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   DELETE /api/v1/projects/:id
 * @desc    Delete project
 * @access  Private
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Project deletion requested', { projectId: id, userId: req.user.id });

    const project = await Project.findOne({
      _id: id,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Delete project folder from Google Drive
    try {
      const user = await User.findById(req.user.id).select('+googleDrive');
      if (user && user.googleDrive && user.googleDrive.accessToken) {
        driveFileService.initialize(
          user.googleDrive.accessToken,
          user.googleDrive.refreshToken,
          user.googleDrive.tokenExpiry
        );
        // Use driveFolderId instead of driveId
        if (project.driveFolderId) {
          await driveFileService.deleteFile(project.driveFolderId);
          logger.info('Deleted project folder from Drive', { 
            projectId: id, 
            driveFolderId: project.driveFolderId 
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to delete project folder from Drive', {
        error: error.message,
        projectId: id
      });
    }

    // Delete all files associated with the project from database
    await File.deleteMany({ project: id });

    // Delete the project from database
    await Project.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Project deleted successfully',
      deletedProject: {
        id,
        name: project.name
      }
    });
  } catch (error) {
    logger.error('Failed to delete project', {
      error: error.message,
      projectId: req.params.id,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete project',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/v1/projects/:id/workspace-path
 * @desc    Get workspace path for a project (for file watcher)
 * @access  Private
 */
router.get('/:id/workspace-path', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      _id: id,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // In production, this would be the actual workspace path
    // For Docker containers, we use a standard workspace path
    const workspacePath = project.workspacePath || `/workspace/${project.name}`;

    // Get container ID from active terminals
    let containerId = null;
    try {
      const terminalServiceModule = await import('../services/terminal.service.js');
      const terminalService = terminalServiceModule.default;
      const userTerminals = terminalService.getUserTerminals(req.user.id);
      const projectTerminal = userTerminals.find(t => t.projectId === id);
      if (projectTerminal && projectTerminal.container) {
        containerId = projectTerminal.container.id;
      }
    } catch (terminalError) {
      logger.debug('Could not get container ID from terminal service', {
        error: terminalError.message,
        projectId: id
      });
    }

    res.json({
      success: true,
      projectId: id,
      workspacePath,
      projectName: project.name,
      containerId
    });
  } catch (error) {
    logger.error('Failed to get workspace path', {
      error: error.message,
      projectId: req.params.id,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get workspace path',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;
