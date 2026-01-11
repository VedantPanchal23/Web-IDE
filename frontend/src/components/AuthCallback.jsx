import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuth();

  useEffect(() => {
    const handleCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const error = urlParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        navigate('/login', { replace: true });
        return;
      }

      if (token) {
        console.log('OAuth token received:', token);
        
        // Store token in localStorage
        localStorage.setItem('accessToken', token);
        
        // Update auth context
        setToken(token);
        
        // Fetch user profile
        fetchUserProfile(token);
      } else {
        console.error('No token received in OAuth callback');
        navigate('/login', { replace: true });
      }
    };

    const fetchUserProfile = async (token) => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.data.user);
          navigate('/', { replace: true });
        } else {
          throw new Error('Failed to fetch user profile');
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        localStorage.removeItem('accessToken');
        setToken(null);
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
  }, [navigate, setUser, setToken]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-300">Completing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;