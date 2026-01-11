import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { apiService } from '../services/api.js';

const AuthContext = createContext();

// Configure axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
axios.defaults.withCredentials = true;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('accessToken'));

  // Sync API service token when token changes
  useEffect(() => {
    apiService.setToken(token);
  }, [token]);

  // Set up axios interceptor for token
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const response = await axios.post('/auth/refresh');
            const newToken = response.data.data.accessToken;
            
            setToken(newToken);
            localStorage.setItem('accessToken', newToken);
            
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axios(originalRequest);
          } catch (refreshError) {
            logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [token]);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      
      if (storedToken) {
        setToken(storedToken);
        try {
          const response = await axios.get('/auth/me');
          const userData = response.data.data.user;
          setUser(userData);
        } catch (error) {
          console.error('Failed to authenticate:', error.message);
          localStorage.removeItem('accessToken');
          setToken(null);
        }
      }
      
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = () => {
    // Redirect to Google OAuth
    window.location.href = `${axios.defaults.baseURL}/auth/google`;
  };



  const logout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('accessToken');
    }
  };

  const updatePreferences = async (preferences) => {
    try {
      const response = await axios.put('/auth/preferences', preferences);
      setUser(prevUser => ({
        ...prevUser,
        preferences: response.data.data.preferences
      }));
      return response.data;
    } catch (error) {
      console.error('Update preferences error:', error);
      throw error;
    }
  };

  // Handle OAuth callback - Run BEFORE auth initialization
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const error = urlParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Authentication failed. Please try again.';
      switch (error) {
        case 'access_denied':
          errorMessage = 'You denied access to Google Drive. Please grant permission to use this application.';
          break;
        case 'invalid_state':
          errorMessage = 'Authentication request expired. Please try logging in again.';
          break;
        case 'no_code':
          errorMessage = 'No authorization code received from Google. Please try again.';
          break;
        case 'callback_failed':
          errorMessage = 'Authentication process failed. Please check your connection and try again.';
          break;
      }
      
      alert(`Authentication Error: ${errorMessage}`);
      
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (tokenFromUrl) {
      console.log('OAuth callback - received token, length:', tokenFromUrl.length);
      
      // Store token FIRST before state update
      localStorage.setItem('accessToken', tokenFromUrl);
      setToken(tokenFromUrl);
      
      // Get user profile
      axios.get('/auth/me')
        .then(response => {
          const userData = response.data.data.user;
          setUser(userData);
          setLoading(false);
          console.log('✅ Authenticated:', userData.email);
        })
        .catch(error => {
          console.error('Failed to get user profile after OAuth:', error.message);
          // Clear token if profile fetch fails
          setToken(null);
          localStorage.removeItem('accessToken');
          setLoading(false);
          alert('Failed to load user profile. Please try logging in again.');
        });

      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    updatePreferences,
    token,
    setUser,
    setToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};