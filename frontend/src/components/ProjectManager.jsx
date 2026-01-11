import { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';

const ProjectCard = ({ project, onSelect, onDelete, isSelected }) => (
  <div
    style={{
      background: isSelected ? '#264f78' : '#21262d',
      border: `1px solid ${isSelected ? '#58a6ff' : '#30363d'}`,
      borderRadius: '8px',
      padding: '16px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      position: 'relative'
    }}
    onClick={() => onSelect(project)}
  >
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '8px'
    }}>
      <h3 style={{
        margin: 0,
        fontSize: '16px',
        fontWeight: '600',
        color: '#f0f6fc'
      }}>
        {project.name}
      </h3>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(project.id);
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#656d76',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '4px'
        }}
        title="Delete project"
      >
        🗑️
      </button>
    </div>
    
    {project.description && (
      <p style={{
        margin: '0 0 12px 0',
        fontSize: '14px',
        color: '#8b949e',
        lineHeight: '1.4'
      }}>
        {project.description}
      </p>
    )}
    
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      fontSize: '12px',
      color: '#656d76'
    }}>
      <span style={{
        background: '#0969da',
        color: '#ffffff',
        padding: '2px 6px',
        borderRadius: '12px',
        fontSize: '10px'
      }}>
        {project.language}
      </span>
      
      {project.framework && (
        <span>{project.framework}</span>
      )}
      
      <span>{project.fileCount || 0} files</span>
      
      <span>
        {new Date(project.lastAccessed).toLocaleDateString()}
      </span>
    </div>
  </div>
);

const CreateProjectForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    language: 'javascript',
    framework: '',
    template: ''
  });

  const [errors, setErrors] = useState({});

  const languages = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'html', label: 'HTML/CSS' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' }
  ];

  const frameworks = {
    javascript: ['React', 'Vue', 'Angular', 'Express', 'Next.js'],
    typescript: ['React', 'Vue', 'Angular', 'Express', 'Next.js', 'NestJS'],
    python: ['Django', 'Flask', 'FastAPI', 'Jupyter'],
    html: ['Bootstrap', 'Tailwind CSS']
  };

  const templates = {
    javascript: ['Basic', 'React App', 'Express Server', 'Node.js CLI'],
    typescript: ['Basic', 'React App', 'Express Server', 'Library'],
    python: ['Basic', 'Web App', 'Data Science', 'CLI Tool'],
    html: ['Basic', 'Landing Page', 'Portfolio', 'Documentation']
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // Reset dependent fields
      ...(field === 'language' ? { framework: '', template: '' } : {})
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Project name must be at least 2 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim()
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#f0f6fc'
        }}>
          Project Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="My Awesome Project"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: `1px solid ${errors.name ? '#f85149' : '#30363d'}`,
            borderRadius: '6px',
            background: '#0d1117',
            color: '#f0f6fc',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        {errors.name && (
          <span style={{
            display: 'block',
            marginTop: '4px',
            fontSize: '12px',
            color: '#f85149'
          }}>
            {errors.name}
          </span>
        )}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#f0f6fc'
        }}>
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="A brief description of your project..."
          rows="3"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #30363d',
            borderRadius: '6px',
            background: '#0d1117',
            color: '#f0f6fc',
            fontSize: '14px',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#f0f6fc'
          }}>
            Language *
          </label>
          <select
            value={formData.language}
            onChange={(e) => handleChange('language', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #30363d',
              borderRadius: '6px',
              background: '#0d1117',
              color: '#f0f6fc',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          >
            {languages.map(lang => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#f0f6fc'
          }}>
            Framework
          </label>
          <select
            value={formData.framework}
            onChange={(e) => handleChange('framework', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #30363d',
              borderRadius: '6px',
              background: '#0d1117',
              color: '#f0f6fc',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          >
            <option value="">None</option>
            {(frameworks[formData.language] || []).map(fw => (
              <option key={fw} value={fw}>
                {fw}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#f0f6fc'
        }}>
          Template
        </label>
        <select
          value={formData.template}
          onChange={(e) => handleChange('template', e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #30363d',
            borderRadius: '6px',
            background: '#0d1117',
            color: '#f0f6fc',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        >
          <option value="">Basic Project</option>
          {(templates[formData.language] || []).map(template => (
            <option key={template} value={template}>
              {template}
            </option>
          ))}
        </select>
      </div>

      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end'
      }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            border: '1px solid #30363d',
            borderRadius: '6px',
            background: 'transparent',
            color: '#f0f6fc',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            background: '#238636',
            color: '#ffffff',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Create Project
        </button>
      </div>
    </form>
  );
};

export default function ProjectManager({ isOpen, onClose }) {
  // ProjectManager render
  
  const { 
    projects, 
    currentProject, 
    loadProjects, 
    loadProject, 
    createProject, 
    deleteProject,
    loading,
    error,
    clearError 
  } = useProject();

  const [view, setView] = useState('list'); // 'list' or 'create'
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
      setSelectedProject(currentProject);
    }
  }, [isOpen, loadProjects, currentProject]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleSelectProject = async (project) => {
    try {
      setSelectedProject(project);
      await loadProject(project.id);
      onClose();
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const handleCreateProject = async (projectData) => {
    try {
      await createProject(projectData);
      setView('list');
      onClose();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await deleteProject(projectId);
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  if (!isOpen) return null;

  // Debug: log the projects state
  console.log('ProjectManager render:', { projects, loading, error, isOpen });

  // Show loading if projects is undefined but we're still loading
  if (projects === undefined && !loading) {
    console.warn('Projects is undefined and not loading - possible context issue');
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={(e) => {
        // Close modal if clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div style={{
        background: '#161b22',
        borderRadius: '12px',
        border: '1px solid #30363d',
        width: '90%',
        maxWidth: view === 'create' ? '500px' : '800px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: '#f0f6fc'
          }}>
            {view === 'create' ? 'Create New Project' : 'Project Manager'}
          </h2>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {view === 'list' && (
              <button
                onClick={() => setView('create')}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#238636',
                  color: '#ffffff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                New Project
              </button>
            )}
            
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            padding: '12px 24px',
            background: '#442726',
            borderBottom: '1px solid #30363d',
            color: '#f85149',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Debug Info (Development) */}
        {import.meta.env.MODE === 'development' && (
          <div style={{
            padding: '8px 24px',
            background: '#0d1117',
            borderBottom: '1px solid #30363d',
            fontSize: '12px',
            color: '#8b949e'
          }}>
            <button
              onClick={() => {
                const debugInfo = window.apiService?.debugAuth();
                console.log('Authentication Debug:', debugInfo);
                alert(`Auth Debug - Check console. Token in localStorage: ${debugInfo?.token ? 'YES' : 'NO'}`);
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #30363d',
                borderRadius: '4px',
                background: '#21262d',
                color: '#f0f6fc',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              🐛 Debug Auth
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px'
        }}>
          {view === 'create' ? (
            <CreateProjectForm
              onSubmit={handleCreateProject}
              onCancel={() => setView('list')}
            />
          ) : (
            <div>
              {loading ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#8b949e'
                }}>
                  Loading projects...
                </div>
              ) : (projects && projects.length === 0) ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#8b949e'
                }}>
                  <p style={{ fontSize: '18px', marginBottom: '8px' }}>📁</p>
                  <p style={{ marginBottom: '16px' }}>No projects yet</p>
                  <button
                    onClick={() => setView('create')}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      background: '#238636',
                      color: '#ffffff',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Create your first project
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '16px'
                }}>
                  {projects && projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onSelect={handleSelectProject}
                      onDelete={handleDeleteProject}
                      isSelected={selectedProject?.id === project.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}