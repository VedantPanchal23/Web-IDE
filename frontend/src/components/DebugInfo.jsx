import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../context/ProjectContext';

const DebugInfo = () => {
  const auth = useAuth();
  const project = useProject();

  const authToken = localStorage.getItem('accessToken');
  
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      backgroundColor: '#2d2d2d',
      color: '#fff',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      maxWidth: '400px',
      zIndex: 10000,
      border: '1px solid #444'
    }}>
      <h4 style={{ margin: '0 0 10px 0' }}>🐛 Debug Info</h4>
      <div><strong>Auth Status:</strong></div>
      <div>• Authenticated: {auth.isAuthenticated ? '✅' : '❌'}</div>
      <div>• User: {auth.user?.name || 'None'}</div>
      <div>• Token in localStorage: {authToken ? '✅ Present' : '❌ Missing'}</div>
      <div>• Token length: {authToken?.length || 0}</div>
      
      <div style={{ marginTop: '10px' }}><strong>Project Status:</strong></div>
      <div>• Projects loaded: {project.projects?.length || 0}</div>
      <div>• Current project: {project.currentProject?.name || 'None'}</div>
      <div>• Loading: {project.loading ? '✅' : '❌'}</div>
      <div>• Error: {project.error || 'None'}</div>
      <div>• File tree items: {project.fileTree?.length || 0}</div>
      
      <button 
        onClick={() => {
          console.log('🔍 Full auth state:', auth);
          console.log('🔍 Full project state:', project);
          console.log('🔍 localStorage token:', authToken);
        }}
        style={{
          marginTop: '10px',
          padding: '5px 10px',
          backgroundColor: '#007acc',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        Log Full State
      </button>
      
      <button 
        onClick={() => project.loadProjects()}
        style={{
          marginTop: '5px',
          marginLeft: '5px',
          padding: '5px 10px',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        Retry Load Projects
      </button>
    </div>
  );
};

export default DebugInfo;