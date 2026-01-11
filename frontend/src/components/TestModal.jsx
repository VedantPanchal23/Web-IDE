import React from 'react';

export default function TestModal({ isOpen, onClose }) {
  console.log('TestModal called with isOpen:', isOpen);
  
  if (!isOpen) return null;

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
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div style={{
        background: '#161b22',
        borderRadius: '12px',
        border: '1px solid #30363d',
        padding: '20px',
        color: '#f0f6fc',
        minWidth: '300px',
        textAlign: 'center'
      }}>
        <h2>Test Modal</h2>
        <p>This is a test modal to verify that modal rendering works.</p>
        <button 
          onClick={onClose}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            background: '#238636',
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}