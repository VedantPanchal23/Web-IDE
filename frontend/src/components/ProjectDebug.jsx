import React from 'react';
import { useProject } from '../context/ProjectContext';

const ProjectDebug = () => {
  const { 
    projects, 
    currentProject, 
    loadProjects, 
    debugState,
    setCurrentFile,
    fileTree,
    currentFile,
    saveFileContent
  } = useProject();

  const selectFirstProject = () => {
    if (projects && projects.length > 0) {
      console.log('🔧 Manually selecting first project:', projects[0]);
      window.location.reload(); // Force reload to trigger auto-selection
    }
  };

  const testSave = async () => {
    if (currentFile && currentProject) {
      console.log('🧪 Testing save function...');
      try {
        await saveFileContent(currentFile.id, currentFile.content + '\n// Test save');
        console.log('✅ Test save successful');
      } catch (error) {
        console.error('❌ Test save failed:', error);
      }
    } else {
      console.log('❌ Cannot test save: missing file or project');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      backgroundColor: '#2d2d2d',
      color: '#fff',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 10000,
      border: '1px solid #444',
      fontFamily: 'monospace'
    }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>🔧 Project Debug</div>
      
      <div><strong>Projects:</strong> {projects?.length || 0}</div>
      {projects?.map((p, i) => (
        <div key={p.id} style={{ marginLeft: '10px', fontSize: '11px' }}>
          {i + 1}. {p.name} (ID: {p.id?.slice(-8)})
        </div>
      ))}
      
      <div style={{ marginTop: '8px' }}>
        <strong>Current Project:</strong> {currentProject?.name || '❌ None'}
      </div>
      
      <div style={{ marginTop: '8px' }}>
        <strong>File Tree:</strong> {fileTree?.length || 0} items
      </div>
      
      <div style={{ marginTop: '8px' }}>
        <strong>Current File:</strong> {currentFile?.name || '❌ None'}
        {currentFile && (
          <div style={{ fontSize: '10px', marginLeft: '10px' }}>
            ID: {currentFile.id?.slice(-8)} | Size: {currentFile.content?.length || 0}
          </div>
        )}
      </div>
      
      <div style={{ marginTop: '10px' }}>
        <button 
          onClick={() => {
            console.log('🐛 Current state:', { projects, currentProject, fileTree });
            debugState && debugState();
          }}
          style={{
            padding: '5px 8px',
            marginRight: '5px',
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Log State
        </button>
        
        <button 
          onClick={() => loadProjects()}
          style={{
            padding: '5px 8px',
            marginRight: '5px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Reload Projects
        </button>
        
        <button 
          onClick={selectFirstProject}
          style={{
            padding: '5px 8px',
            marginRight: '5px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Force Reload
        </button>
        
        <button 
          onClick={testSave}
          style={{
            padding: '5px 8px',
            backgroundColor: '#fd7e14',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Test Save
        </button>
      </div>
    </div>
  );
};

export default ProjectDebug;