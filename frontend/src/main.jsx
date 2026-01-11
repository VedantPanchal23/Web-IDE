import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Aggressively suppress ALL console output containing socket.io WebSocket errors
// This must happen BEFORE any other imports
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Create a universal message checker
const shouldSuppress = (args) => {
  const str = args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.message + ' ' + arg.stack;
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }).join(' ');
  
  return (
    str.includes('Invalid frame header') ||
    (str.includes('WebSocket') && str.includes('failed')) ||
    (str.includes('WebSocket') && str.includes('disconnected')) ||
    (str.includes('socket.io') && str.includes('websocket')) ||
    (str.includes('socket.io') && str.includes('polling')) ||
    (str.includes('socket.io') && str.includes('400')) ||
    (str.includes('socket.io') && str.includes('Bad Request')) ||
    (str.includes('transport error')) ||
    (str.includes('Terminal error') && str.includes('Terminal session ended'))
  );
};

// Override all console methods
console.error = (...args) => {
  if (!shouldSuppress(args)) originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
  if (!shouldSuppress(args)) originalConsoleWarn.apply(console, args);
};

console.log = (...args) => {
  if (!shouldSuppress(args)) originalConsoleLog.apply(console, args);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
