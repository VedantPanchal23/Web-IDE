import React, { useState, useEffect } from 'react';
import './NotificationToast.css';

/**
 * NotificationToast Component
 * 
 * Displays toast notifications for file changes and other events
 */
const NotificationToast = () => {
  const [notifications, setNotifications] = useState([]);
  const [nextId, setNextId] = useState(1);

  useEffect(() => {
    // Listen for notification events
    const handleNotification = (event) => {
      const { message, type = 'info', duration = 4000 } = event.detail;

      const notification = {
        id: nextId,
        message,
        type, // info, success, warning, error
        timestamp: Date.now()
      };

      setNextId(prev => prev + 1);
      setNotifications(prev => [...prev, notification]);

      // Auto-remove after duration
      setTimeout(() => {
        removeNotification(notification.id);
      }, duration);
    };

    document.addEventListener('show-notification', handleNotification);

    return () => {
      document.removeEventListener('show-notification', handleNotification);
    };
  }, [nextId]);

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✗';
      case 'info':
      default: return 'ℹ';
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`notification-toast ${notification.type}`}
          onClick={() => removeNotification(notification.id)}
        >
          <span className="notification-icon">
            {getIcon(notification.type)}
          </span>
          <span className="notification-message">
            {notification.message}
          </span>
          <button
            className="notification-close"
            onClick={(e) => {
              e.stopPropagation();
              removeNotification(notification.id);
            }}
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;
