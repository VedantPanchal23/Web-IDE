import { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';
import { apiService } from '../services/api.js';
import fileWatcherClient from '../services/fileWatcherClient.js';

// Initial state
const initialState = {
  projects: [],
  currentProject: null,
  fileTree: [],
  currentFile: null,
  openTabs: [], // Array of open file tabs
  unsavedChanges: new Map(), // Map of fileId -> boolean for tracking unsaved changes
  fileCache: new Map(), // Map of fileId -> file content for caching
  loading: false, // For projects and major operations
  fileTreeLoading: false, // For file tree operations
  fileLoading: false, // Separate loading state for file content
  error: null,
  syncStatus: 'idle' // idle, syncing, synced, error
};

// Action types
const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_FILE_TREE_LOADING: 'SET_FILE_TREE_LOADING',
  SET_FILE_LOADING: 'SET_FILE_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_PROJECTS: 'SET_PROJECTS',
  SET_CURRENT_PROJECT: 'SET_CURRENT_PROJECT',
  SET_FILE_TREE: 'SET_FILE_TREE',
  SET_CURRENT_FILE: 'SET_CURRENT_FILE',
  UPDATE_FILE_CONTENT: 'UPDATE_FILE_CONTENT',
  ADD_FILE: 'ADD_FILE',
  REMOVE_FILE: 'REMOVE_FILE',
  SET_SYNC_STATUS: 'SET_SYNC_STATUS',
  CLEAR_STATE: 'CLEAR_STATE',
  CACHE_FILE: 'CACHE_FILE',
  // Tab management actions
  ADD_TAB: 'ADD_TAB',
  CLOSE_TAB: 'CLOSE_TAB',
  MOVE_TAB: 'MOVE_TAB',
  SET_UNSAVED_CHANGES: 'SET_UNSAVED_CHANGES'
};

// Reducer function
function projectReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case ActionTypes.SET_FILE_TREE_LOADING:
      return { ...state, fileTreeLoading: action.payload };
    
    case ActionTypes.SET_FILE_LOADING:
      return { ...state, fileLoading: action.payload };
    
    case ActionTypes.SET_ERROR:
      return { ...state, error: action.payload, loading: false, fileTreeLoading: false, fileLoading: false };
    
    case ActionTypes.SET_PROJECTS:
      return { ...state, projects: action.payload, loading: false };
    
    case ActionTypes.SET_CURRENT_PROJECT:
      return { 
        ...state, 
        currentProject: action.payload, 
        fileTree: action.payload?.fileTree || [],
        loading: false,
        // Clear cache when switching projects to avoid stale data
        fileCache: new Map(),
        currentFile: null,
        openTabs: [],
        unsavedChanges: new Map()
      };
    
    case ActionTypes.SET_FILE_TREE:
      return { ...state, fileTree: action.payload };
    
    case ActionTypes.SET_CURRENT_FILE:
      return { 
        ...state, 
        currentFile: action.payload,
        // Add to tabs if not already open and file exists
        openTabs: action.payload && !state.openTabs.find(tab => tab.id === action.payload.id)
          ? [...state.openTabs, action.payload]
          : state.openTabs
      };
    
    case ActionTypes.CACHE_FILE:
      const newCache = new Map(state.fileCache);
      newCache.set(action.payload.fileId, action.payload.file);
      return {
        ...state,
        fileCache: newCache
      };
    
    case ActionTypes.UPDATE_FILE_CONTENT:
      // Updating file content in cache
      
      const updatedCache = new Map(state.fileCache);
      if (updatedCache.has(action.payload.id)) {
        const cachedFile = updatedCache.get(action.payload.id);
        const updatedFile = {
          ...cachedFile,
          content: action.payload.content
        };
        updatedCache.set(action.payload.id, updatedFile);
        // File cached
      } else {
        console.log('⚠️ File not in cache, creating new entry');
        updatedCache.set(action.payload.id, {
          id: action.payload.id,
          content: action.payload.content
        });
      }
      
      const newState = {
        ...state,
        currentFile: state.currentFile?.id === action.payload.id 
          ? { ...state.currentFile, content: action.payload.content }
          : state.currentFile,
        fileCache: updatedCache
      };
      
      // Cache updated
      return newState;
    
    case ActionTypes.ADD_FILE:
      // Instead of manually adding to fileTree, trigger a refresh
      return {
        ...state,
        fileTree: action.payload || state.fileTree
      };
    
    case ActionTypes.REMOVE_FILE:
      return {
        ...state,
        fileTree: state.fileTree.filter(file => file.id !== action.payload),
        currentFile: state.currentFile?.id === action.payload ? null : state.currentFile
      };
    
    case ActionTypes.SET_SYNC_STATUS:
      return { ...state, syncStatus: action.payload };
    
    case ActionTypes.ADD_TAB:
      return {
        ...state,
        openTabs: state.openTabs.find(tab => tab.id === action.payload.id)
          ? state.openTabs
          : [...state.openTabs, action.payload]
      };
    
    case ActionTypes.CLOSE_TAB:
      const updatedTabs = state.openTabs.filter(tab => tab.id !== action.payload);
      const newUnsavedChanges = new Map(state.unsavedChanges);
      newUnsavedChanges.delete(action.payload);
      
      return {
        ...state,
        openTabs: updatedTabs,
        unsavedChanges: newUnsavedChanges,
        // If closing current file, switch to next available tab
        currentFile: state.currentFile?.id === action.payload 
          ? (updatedTabs.length > 0 ? updatedTabs[updatedTabs.length - 1] : null)
          : state.currentFile
      };
    
    case ActionTypes.MOVE_TAB:
      const { fromIndex, toIndex } = action.payload;
      const newOpenTabs = [...state.openTabs];
      const [movedTab] = newOpenTabs.splice(fromIndex, 1);
      newOpenTabs.splice(toIndex, 0, movedTab);
      
      return {
        ...state,
        openTabs: newOpenTabs
      };
    
    case ActionTypes.SET_UNSAVED_CHANGES:
      const newUnsavedMap = new Map(state.unsavedChanges);
      if (action.payload.hasChanges) {
        newUnsavedMap.set(action.payload.fileId, true);
      } else {
        newUnsavedMap.delete(action.payload.fileId);
      }
      
      return {
        ...state,
        unsavedChanges: newUnsavedMap
      };
    
    case ActionTypes.CLEAR_STATE:
      return {
        ...initialState,
        unsavedChanges: new Map(), // Ensure Map is properly reinitialized
        fileCache: new Map() // Clear file cache when switching projects
      };
    
    default:
      return state;
  }
}

// Create context
const ProjectContext = createContext();

// Provider component
export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  // Initialize file watcher client on mount
  useEffect(() => {
    fileWatcherClient.connect();

    // Setup file change listeners
    const unsubscribeFileChange = fileWatcherClient.on('file-change', (data) => {
      // Refresh file tree to show changes
      if (state.currentProject) {
        refreshFileTree();
      }

      // Show notification
      const message = {
        'added': `File added: ${data.filePath}`,
        'changed': `File changed: ${data.filePath}`,
        'deleted': `File deleted: ${data.filePath}`,
        'dir-added': `Directory added: ${data.dirPath}`,
        'dir-deleted': `Directory deleted: ${data.dirPath}`
      }[data.type] || 'File system change detected';

      // Dispatch notification event
      document.dispatchEvent(new CustomEvent('show-notification', {
        detail: { message, type: 'info' }
      }));
    });

    // Cleanup on unmount
    return () => {
      unsubscribeFileChange();
      fileWatcherClient.disconnect();
    };
  }, []);

  // Register/unregister file watcher when project changes
  useEffect(() => {
    if (state.currentProject?.id) {
      fileWatcherClient.registerProject(state.currentProject.id)
        .catch(error => {
          console.error('Failed to register file watcher:', error);
        });
    } else {
      // Unregister when no project is selected
      fileWatcherClient.unregisterProject();
    }
  }, [state.currentProject?.id]);

  // Action creators
  const setLoading = useCallback((loading) => {
    dispatch({ type: ActionTypes.SET_LOADING, payload: loading });
  }, []);

  const setFileTreeLoading = useCallback((fileTreeLoading) => {
    dispatch({ type: ActionTypes.SET_FILE_TREE_LOADING, payload: fileTreeLoading });
  }, []);

  const setFileLoading = useCallback((fileLoading) => {
    dispatch({ type: ActionTypes.SET_FILE_LOADING, payload: fileLoading });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: ActionTypes.SET_ERROR, payload: error });
  }, []);

  const setSyncStatus = useCallback((status) => {
    dispatch({ type: ActionTypes.SET_SYNC_STATUS, payload: status });
  }, []);

  // Load all projects
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await apiService.getProjects();
      const projects = response.data?.projects || [];
      dispatch({ type: ActionTypes.SET_PROJECTS, payload: projects });
      console.log('✅ Projects loaded:', projects.length);
      setLoading(false);
    } catch (error) {
      console.error('❌ Failed to load projects:', error.message);
      setError(error.message);
      setLoading(false);
    }
  }, []);

  // Load specific project
  const loadProject = useCallback(async (projectId) => {
    try {
      setLoading(true);
      const response = await apiService.getProject(projectId);
      dispatch({ type: ActionTypes.SET_CURRENT_PROJECT, payload: response.data.project });
      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  }, []);

  // Refresh file tree
  const refreshFileTree = useCallback(async () => {
    try {
      if (!state.currentProject) return;
      
      setFileTreeLoading(true);
      const response = await apiService.getProjectFiles(state.currentProject.id);
      dispatch({ type: ActionTypes.SET_FILE_TREE, payload: response.data.fileTree });
      setFileTreeLoading(false);
    } catch (error) {
      setError(error.message);
      setFileTreeLoading(false);
    }
  }, [state.currentProject, setFileTreeLoading, setError]);

  // Create new project
  const createProject = useCallback(async (projectData) => {
    try {
      setLoading(true);
      const response = await apiService.createProject(projectData);
      
      // Add to projects list
      dispatch({ type: ActionTypes.SET_PROJECTS, payload: [...state.projects, response.data.project] });
      
      // Set as current project
      dispatch({ type: ActionTypes.SET_CURRENT_PROJECT, payload: response.data.project });
      
      return response.data.project;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, [state.projects]);

  // Delete project
  const deleteProject = useCallback(async (projectId) => {
    try {
      setLoading(true);
      await apiService.deleteProject(projectId);
      
      // Remove from projects list
      const updatedProjects = state.projects.filter(p => p.id !== projectId);
      dispatch({ type: ActionTypes.SET_PROJECTS, payload: updatedProjects });
      
      // Clear current project if it was deleted
      if (state.currentProject?.id === projectId) {
        dispatch({ type: ActionTypes.SET_CURRENT_PROJECT, payload: null });
      }
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, [state.projects, state.currentProject]);

  // Load file content with caching
  const loadFileContent = useCallback(async (fileId, forceRefresh = false) => {
    try {
      // Load file content
      
      if (!state.currentProject) {
        // If we have projects but no current project, try to use the first one
        if (state.projects && state.projects.length > 0) {
          console.log('🔄 Auto-selecting first available project:', state.projects[0].name);
          dispatch({ type: ActionTypes.SET_CURRENT_PROJECT, payload: state.projects[0] });
          // Retry the load with the project now set
          return loadFileContent(fileId, forceRefresh);
        }
        
        console.error('❌ Cannot load: No current project', {
          stateKeys: Object.keys(state),
          projects: state.projects?.length || 0,
          currentFile: state.currentFile?.id,
          availableProjects: state.projects?.map(p => ({ id: p.id, name: p.name })) || [],
          hasToken: !!localStorage.getItem('accessToken'),
          loading: state.loading,
          error: state.error
        });
        
        // If no projects, try to load them
        if (state.projects.length === 0 && !state.loading) {
          console.log('🔄 No projects found, attempting to load projects...');
          try {
            await loadProjects();
            // After loading, check if we now have projects
            // Note: This won't work immediately due to async nature, but will trigger re-render
          } catch (error) {
            console.error('🚫 Failed to load projects:', error);
            setError('Failed to load projects. Please try refreshing the page or check your connection.');
          }
        }
        
        return;
      }
      
      // Check cache first (unless forcing refresh)
      if (!forceRefresh && state.fileCache.has(fileId)) {
        const cachedFile = state.fileCache.get(fileId);
        dispatch({ type: ActionTypes.SET_CURRENT_FILE, payload: cachedFile });
        return cachedFile;
      }
      
      setFileLoading(true);
      // Loading from server
      const response = await apiService.getFileContent(state.currentProject.id, fileId, !forceRefresh);
      
      // Find the file in fileTree to get its name and other properties
      const findFile = (files, id) => {
        for (const file of files) {
          if (file.id === id) return file;
          if (file.children) {
            const found = findFile(file.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      
      const fileInfo = findFile(state.fileTree, fileId);
      
      const fileWithContent = {
        id: fileId,
        name: fileInfo?.name || response.data.metadata?.name || 'unnamed',
        path: fileInfo?.path || response.data.metadata?.path || '/',
        type: fileInfo?.type || 'file',
        content: response.data.content,
        metadata: response.data.metadata
      };
      
      // Cache the file content
      dispatch({ type: ActionTypes.CACHE_FILE, payload: { fileId, file: fileWithContent } });
      
      dispatch({ type: ActionTypes.SET_CURRENT_FILE, payload: fileWithContent });
      setFileLoading(false);
      return fileWithContent;
    } catch (error) {
      console.error('Failed to load file:', error);
      setFileLoading(false);
      setError(error.message);
      throw error;
    }
  }, [state.currentProject, state.projects, state.fileCache, state.loading, setFileLoading, setError, loadProjects]);

  // Save file content
  const saveFileContent = useCallback(async (fileId, content) => {
    try {
      if (!state.currentProject) {
        // If we have projects but no current project, try to use the first one
        if (state.projects && state.projects.length > 0) {
          dispatch({ type: ActionTypes.SET_CURRENT_PROJECT, payload: state.projects[0] });
          // Retry the save with the project now set
          return saveFileContent(fileId, content);
        }
        
        console.error('Cannot save: No current project selected');
        setError('No project selected. Please select a project to save files.');
        throw new Error('No current project selected');
      }
      
      setSyncStatus('syncing');
      
      const response = await apiService.updateFileContent(state.currentProject.id, fileId, content);
      
      dispatch({ 
        type: ActionTypes.UPDATE_FILE_CONTENT, 
        payload: { id: fileId, content } 
      });
      
      setSyncStatus('synced');
      
      // Auto-clear sync status after 2 seconds
      setTimeout(() => setSyncStatus('idle'), 2000);
      
    } catch (error) {
      console.error('Save failed:', error);
      setSyncStatus('error');
      setError(error.message);
      throw error;
    }
  }, [state.currentProject, setSyncStatus, setError]);

  // Create new file
  const createFile = useCallback(async (fileData) => {
    try {
      if (!state.currentProject) return;
      
      const response = await apiService.createFile(state.currentProject.id, fileData);
      
      // Refresh the entire file tree to get proper structure
      await refreshFileTree();
      
      return response.data.file;
    } catch (error) {
      // Check if this is a Drive authentication error
      if (error.message.includes('re-authenticate') || error.message.includes('Drive access')) {
        setError('Google Drive authentication required. Please check the popup or refresh the page to re-authenticate.');
      } else {
        setError(error.message);
      }
      throw error;
    }
  }, [state.currentProject, refreshFileTree, setError]);

  // Delete file
  const deleteFile = useCallback(async (fileId) => {
    try {
      if (!state.currentProject) return;
      
      await apiService.deleteFile(state.currentProject.id, fileId);
      
      // Refresh the entire file tree to get proper structure
      await refreshFileTree();
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, [state.currentProject, refreshFileTree, setError]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Set current file (for tab switching)
  const setCurrentFile = useCallback((file) => {
    dispatch({ type: ActionTypes.SET_CURRENT_FILE, payload: file });
  }, []);

  // Clear all state (for logout)
  const clearState = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_STATE });
  }, []);

  // Tab management functions
  const addTab = useCallback((file) => {
    dispatch({ type: ActionTypes.ADD_TAB, payload: file });
  }, []);

  const closeTab = useCallback((fileId) => {
    dispatch({ type: ActionTypes.CLOSE_TAB, payload: fileId });
  }, []);

  const moveTab = useCallback((fromIndex, toIndex) => {
    dispatch({ type: ActionTypes.MOVE_TAB, payload: { fromIndex, toIndex } });
  }, []);

  const setUnsavedChanges = useCallback((fileId, hasChanges) => {
    dispatch({ type: ActionTypes.SET_UNSAVED_CHANGES, payload: { fileId, hasChanges } });
  }, []);

  const hasUnsavedChanges = useCallback((fileId) => {
    return state.unsavedChanges.has(fileId);
  }, [state.unsavedChanges]);

  // Debug function to check current state
  const debugState = useCallback(() => {
    console.log('🐛 DEBUG - Current ProjectContext state:', {
      projects: state.projects,
      projectsLength: state.projects?.length,
      currentProject: state.currentProject,
      currentProjectId: state.currentProject?.id,
      currentProjectName: state.currentProject?.name,
      fileTree: state.fileTree,
      fileTreeLength: state.fileTree?.length,
      currentFile: state.currentFile,
      loading: state.loading,
      error: state.error,
      hasToken: !!localStorage.getItem('accessToken')
    });
    return state;
  }, [state]);

  // Auto-load projects on mount and set current project if none is selected
  useEffect(() => {
    const initializeProjects = async () => {
      // Only load projects if we haven't loaded them yet and we're not already loading
      if (state.projects.length === 0 && !state.loading && !state.error) {
        try {
          await loadProjects();
        } catch (error) {
          console.error('❌ Failed to auto-load projects:', error);
        }
      }
    };

    // Small delay to ensure auth context is ready
    const timeoutId = setTimeout(initializeProjects, 100);
    
    return () => clearTimeout(timeoutId);
  }, [state.projects.length, state.loading, state.error, loadProjects]);

  // Auto-select first project if we have projects but no current project
  useEffect(() => {
    if (state.projects.length > 0 && !state.currentProject) {
      // Use setTimeout to ensure this runs after the current render cycle
      setTimeout(() => {
        dispatch({ type: ActionTypes.SET_CURRENT_PROJECT, payload: state.projects[0] });
      }, 0);
    }
  }, [state.projects.length, state.currentProject]);

  // Auto-refresh file tree when current project changes
  useEffect(() => {
    if (state.currentProject && state.fileTree.length === 0 && !state.fileTreeLoading) {
      refreshFileTree();
    }
  }, [state.currentProject, state.fileTree.length, state.fileTreeLoading, refreshFileTree]);

  const value = useMemo(() => ({
    // State
    ...state,
    
    // Actions
    loadProjects,
    loadProject,
    createProject,
    deleteProject,
    loadFileContent,
    saveFileContent,
    createFile,
    deleteFile,
    refreshFileTree,
    clearError,
    clearState,
    setLoading,
    setFileTreeLoading,
    setFileLoading,
    setError,
    setSyncStatus,
    
    // File navigation
    setCurrentFile,
    
    // Tab management
    addTab,
    closeTab,
    moveTab,
    setUnsavedChanges,
    hasUnsavedChanges,
    
    // Debug
    debugState
  }), [
    state,
    loadProjects,
    loadProject,
    createProject,
    deleteProject,
    loadFileContent,
    saveFileContent,
    createFile,
    deleteFile,
    refreshFileTree,
    clearError,
    clearState,
    setLoading,
    setFileTreeLoading,
    setFileLoading,
    setError,
    setSyncStatus,
    setCurrentFile,
    addTab,
    closeTab,
    moveTab,
    setUnsavedChanges,
    hasUnsavedChanges,
    debugState
  ]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

// Custom hook to use the project context
export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}