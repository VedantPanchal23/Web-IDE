import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UserProfile.css';

const UserProfile = () => {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
  };

  if (!user) return null;

  return (
    <div className="user-profile">
      <button 
        className="profile-button"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <img 
          src={user.picture || '/default-avatar.png'} 
          alt={user.name}
          className="profile-image"
        />
        <span className="profile-name">{user.name}</span>
        <svg className="dropdown-icon" viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M7 10l5 5 5-5z"/>
        </svg>
      </button>

      {showDropdown && (
        <div className="profile-dropdown">
          <div className="profile-info">
            <img src={user.picture || '/default-avatar.png'} alt={user.name} />
            <div>
              <div className="profile-info-name">{user.name}</div>
              <div className="profile-info-email">{user.email}</div>
            </div>
          </div>

          <div className="dropdown-divider" />

          <button className="dropdown-item" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M16,17V14H9V10H16V7L21,12L16,17M14,2A2,2 0 0,1 16,4V6H14V4H5V20H14V18H16V20A2,2 0 0,1 14,22H5A2,2 0 0,1 3,20V4A2,2 0 0,1 5,2H14Z"/>
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;