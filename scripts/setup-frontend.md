# Frontend Setup Instructions

## Prerequisites
- Node.js 16+ installed
- npm or yarn package manager

## Initial Setup

1. **Create Vite + React Application:**
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

2. **Install Additional Dependencies:**
```bash
# Core dependencies for IDE functionality
npm install monaco-editor @monaco-editor/react
npm install xterm @xterm/xterm @xterm/addon-fit @xterm/addon-search
npm install socket.io-client
npm install axios
npm install react-router-dom
npm install @tanstack/react-query
npm install zustand
npm install react-hot-toast

# Development dependencies
npm install -D @types/node
```

3. **Configure Vite (vite.config.js):**
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    include: ['monaco-editor']
  }
})
```

4. **Update src/index.css (Plain CSS Setup):**
```css
/* Reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background-color: #1e1e1e;
  color: #d4d4d4;
  overflow: hidden;
}

/* IDE Layout */
.ide-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.sidebar {
  width: 250px;
  background-color: #252526;
  border-right: 1px solid #3c3c3c;
  overflow-y: auto;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.toolbar {
  height: 40px;
  background-color: #2d2d30;
  border-bottom: 1px solid #3c3c3c;
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.editor-area {
  flex: 1;
  display: flex;
}

.terminal-area {
  height: 200px;
  background-color: #1e1e1e;
  border-top: 1px solid #3c3c3c;
}

/* Monaco Editor styling */
.monaco-editor {
  font-family: 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace !important;
}

/* File tree styling */
.file-tree {
  padding: 8px;
}

.file-tree-item {
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  user-select: none;
}

.file-tree-item:hover {
  background-color: #2a2d2e;
}

.file-tree-item.selected {
  background-color: #094771;
}

/* Terminal styling */
.terminal-container {
  height: 100%;
  background-color: #0c0c0c;
}

/* Button styles */
.btn {
  background-color: #0e639c;
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 13px;
}

.btn:hover {
  background-color: #1177bb;
}

.btn:disabled {
  background-color: #3c3c3c;
  cursor: not-allowed;
}

/* Input styles */
.input {
  background-color: #3c3c3c;
  border: 1px solid #464647;
  color: #cccccc;
  padding: 4px 8px;
  border-radius: 2px;
}

.input:focus {
  outline: none;
  border-color: #007acc;
}
```

## Project Structure
After setup, your frontend should have:
```
frontend/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Editor/        # Monaco Editor wrapper
│   │   ├── Terminal/      # xterm.js terminal
│   │   ├── FileTree/      # File explorer
│   │   └── Toolbar/       # Top toolbar
│   ├── pages/             # Route components
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API calls and WebSocket
│   ├── store/             # Zustand state management
│   ├── utils/             # Helper functions
│   └── styles/            # Additional CSS
├── public/
└── package.json
```

## Next Steps
1. Run the setup commands above
2. Test the development server: `npm run dev`
3. Verify Monaco Editor loads properly
4. Test WebSocket connection to backend