import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import './ProjectDashboard.css';

// Project templates with different tech stacks
const PROJECT_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Empty project - start from scratch',
    icon: '📄',
    files: []
  },
  {
    id: 'python',
    name: 'Python Project',
    description: 'Python with main.py and requirements.txt',
    icon: '🐍',
    files: [
      { name: 'main.py', content: '# Python Project\nprint("Hello from Python!")\n', type: 'file' },
      { name: 'requirements.txt', content: '', type: 'file' },
      { name: 'README.md', content: '# Python Project\n\nYour Python project starts here.', type: 'file' }
    ]
  },
  {
    id: 'javascript',
    name: 'Node.js Project',
    description: 'Node.js with package.json and index.js',
    icon: '📦',
    files: [
      { name: 'index.js', content: '// Node.js Project\nconsole.log("Hello from Node.js!");\n', type: 'file' },
      { name: 'package.json', content: '{\n  "name": "my-project",\n  "version": "1.0.0",\n  "main": "index.js"\n}', type: 'file' },
      { name: 'README.md', content: '# Node.js Project\n\nYour Node.js project starts here.', type: 'file' }
    ]
  },
  {
    id: 'react',
    name: 'React App',
    description: 'React application starter',
    icon: '⚛️',
    files: [
      { name: 'App.jsx', content: 'import React from "react";\n\nfunction App() {\n  return (\n    <div>\n      <h1>Hello React!</h1>\n    </div>\n  );\n}\n\nexport default App;\n', type: 'file' },
      { name: 'index.js', content: 'import React from "react";\nimport ReactDOM from "react-dom";\nimport App from "./App";\n\nReactDOM.render(<App />, document.getElementById("root"));\n', type: 'file' },
      { name: 'package.json', content: '{\n  "name": "react-app",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.0.0",\n    "react-dom": "^18.0.0"\n  }\n}', type: 'file' },
      { name: 'README.md', content: '# React App\n\nYour React application starts here.', type: 'file' }
    ]
  },
  {
    id: 'jupyter',
    name: 'Jupyter Notebook',
    description: 'Data science with Jupyter',
    icon: '📊',
    files: [
      { name: 'notebook.ipynb', content: '{\n  "cells": [],\n  "metadata": {},\n  "nbformat": 4,\n  "nbformat_minor": 2\n}', type: 'file' },
      { name: 'requirements.txt', content: 'jupyter\nnumpy\npandas\nmatplotlib\n', type: 'file' },
      { name: 'README.md', content: '# Jupyter Project\n\nData science project with Jupyter notebooks.', type: 'file' }
    ]
  },
  {
    id: 'java',
    name: 'Java Project',
    description: 'Java application with Maven',
    icon: '☕',
    files: [
      { name: 'Main.java', content: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}\n', type: 'file' },
      { name: 'pom.xml', content: '<project>\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>com.example</groupId>\n  <artifactId>my-app</artifactId>\n  <version>1.0</version>\n</project>', type: 'file' },
      { name: 'README.md', content: '# Java Project\n\nYour Java project starts here.', type: 'file' }
    ]
  },
  {
    id: 'cpp',
    name: 'C++ Project',
    description: 'C++ with CMake',
    icon: '⚙️',
    files: [
      { name: 'main.cpp', content: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++!" << std::endl;\n    return 0;\n}\n', type: 'file' },
      { name: 'CMakeLists.txt', content: 'cmake_minimum_required(VERSION 3.10)\nproject(MyProject)\nadd_executable(main main.cpp)\n', type: 'file' },
      { name: 'README.md', content: '# C++ Project\n\nYour C++ project starts here.', type: 'file' }
    ]
  }
];

function ProjectDashboard({ onProjectOpen }) {
  const { user, logout } = useAuth();
  const { projects, currentProject, createProject, loadProject, loadProjects } = useProject();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      logout();
    }
  };

  useEffect(() => {
    // Load user's projects when dashboard mounts
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    setIsCreating(true);
    try {
      const template = PROJECT_TEMPLATES.find(t => t.id === selectedTemplate);
      
      // Create project with proper format expected by backend
      const projectData = {
        name: newProjectName.trim(),
        description: template?.description || `${template?.name || 'New'} project`,
        language: getLanguageFromTemplate(template?.id),
        framework: getFrameworkFromTemplate(template?.id),
        template: template?.id || 'blank'
      };
      
      const newProject = await createProject(projectData);
      
      if (newProject) {
        // After project is created, create initial files if template has them
        if (template?.files && template.files.length > 0) {
          // Files will be created by the backend based on the template
          console.log('Project created with template:', template.id);
        }
        
        setShowCreateModal(false);
        setNewProjectName('');
        setSelectedTemplate('blank');
        // Open the new project
        handleOpenProject(newProject);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      
      // Check if it's an authentication error
      if (error.message && (
        error.message.includes('authentication') || 
        error.message.includes('OAuth') ||
        error.message.includes('access token') ||
        error.message.includes('credential')
      )) {
        alert('⚠️ Your Google Drive session has expired.\n\nPlease log out and log back in to refresh your connection.');
      } else {
        alert('Failed to create project: ' + error.message);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Helper to get primary language from template
  const getLanguageFromTemplate = (templateId) => {
    const languageMap = {
      'blank': 'javascript',
      'python': 'python',
      'javascript': 'javascript',
      'react': 'javascript',
      'jupyter': 'python',
      'java': 'java',
      'cpp': 'cpp'
    };
    return languageMap[templateId] || 'javascript';
  };

  // Helper to get framework from template
  const getFrameworkFromTemplate = (templateId) => {
    const frameworkMap = {
      'react': 'react',
      'jupyter': 'jupyter',
      'blank': null,
      'python': null,
      'javascript': 'nodejs',
      'java': 'maven',
      'cpp': 'cmake'
    };
    return frameworkMap[templateId] || null;
  };

  const handleOpenProject = async (project) => {
    try {
      // Load the full project data
      await loadProject(project.id || project._id);
      // Navigate to IDE
      onProjectOpen();
    } catch (error) {
      console.error('Failed to open project:', error);
      alert('Failed to open project: ' + error.message);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="project-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-title">
            <h1>🚀 AI-IDE</h1>
            <p>Welcome back, {user?.name || 'Developer'}!</p>
          </div>
          <div className="header-actions">
            <button 
              className="create-project-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <span className="btn-icon">+</span>
              New Project
            </button>
            <button 
              className="logout-btn"
              onClick={handleLogout}
              title="Logout"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="dashboard-content">
        <div className="projects-section">
          <div className="section-header">
            <h2>Your Projects</h2>
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="projects-grid">
            {filteredProjects.length === 0 ? (
              <div className="no-projects">
                <div className="no-projects-icon">📁</div>
                <h3>No projects yet</h3>
                <p>Create your first project to get started</p>
                <button 
                  className="create-first-project-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create Project
                </button>
              </div>
            ) : (
              filteredProjects.map((project) => (
                <div 
                  key={project.id || project._id} 
                  className="project-card"
                  onClick={() => handleOpenProject(project)}
                >
                  <div className="project-card-header">
                    <div className="project-icon">📦</div>
                    <div className="project-menu">⋮</div>
                  </div>
                  <div className="project-card-body">
                    <h3 className="project-name">{project.name}</h3>
                    <p className="project-description">
                      {project.description || 'No description'}
                    </p>
                    <div className="project-meta">
                      <span className="project-date">
                        📅 {formatDate(project.updatedAt || project.createdAt)}
                      </span>
                      <span className="project-files">
                        📄 {project.fileCount || 0} files
                      </span>
                    </div>
                  </div>
                  <div className="project-card-footer">
                    <button className="open-project-btn">
                      Open Project →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !isCreating && setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Project</h2>
              <button 
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  placeholder="my-awesome-project"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                  disabled={isCreating}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Choose a Template</label>
                <div className="templates-grid">
                  {PROJECT_TEMPLATES.map((template) => (
                    <div
                      key={template.id}
                      className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                      onClick={() => !isCreating && setSelectedTemplate(template.id)}
                    >
                      <div className="template-icon">{template.icon}</div>
                      <div className="template-info">
                        <h4>{template.name}</h4>
                        <p>{template.description}</p>
                      </div>
                      {selectedTemplate === template.id && (
                        <div className="template-selected-badge">✓</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateProject}
                disabled={isCreating || !newProjectName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDashboard;
