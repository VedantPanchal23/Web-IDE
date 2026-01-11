# 💻 Integrated Terminal

## Overview
Browser-based terminal with full ANSI support, real-time WebSocket communication, and automatic language detection for seamless code execution.

---

## ✨ Key Features

### 1. **Full Terminal Emulation**
- **Engine**: xterm.js with FitAddon
- **ANSI Support**: Colors, formatting, cursor control
- **Interactive**: Real-time input/output
- **Scrollback**: 1000 lines history

### 2. **Auto Language Detection**
- Detects language from file extension
- Executes code with correct runtime
- Supports: Python, JavaScript, Java, C++
- One-click execution

### 3. **WebSocket Streaming**
- Real-time output streaming
- Low latency (<100ms)
- Bidirectional communication
- Session persistence

### 4. **Multiple Sessions**
- Create multiple terminals
- Independent sessions
- Switch between terminals
- Close individual sessions

---

## 🎯 Usage

### Basic Commands
```bash
# Run current file (auto-detected)
Click "Run" button or Ctrl+Enter

# Python
> python3 script.py
Hello, World!

# JavaScript
> node app.js
Server started on port 3000

# Java
> javac Main.java && java Main
Output from Java program

# C++
> g++ main.cpp -o main && ./main
Compiled and executed
```

### Terminal Operations
```bash
# Clear terminal
Ctrl+L or type 'clear'

# Cancel running process
Ctrl+C

# Navigate history
Up/Down arrow keys

# Copy selection
Select text → Right-click → Copy

# Paste
Right-click → Paste or Ctrl+Shift+V
```

---

## 🔧 Technical Details

### Component
- **Location**: `frontend/src/components/Terminal.jsx`
- **Library**: `xterm` v5.3.0, `xterm-addon-fit` v0.8.0
- **Backend**: WebSocket manager in `backend/src/lib/terminalManager.js`

### WebSocket Protocol
```javascript
// Client → Server
{
  type: 'input',
  data: 'python3 script.py\n'
}

// Server → Client
{
  type: 'output',
  data: 'Hello, World!\n'
}

{
  type: 'exit',
  code: 0
}
```

### Language Detection
```javascript
const languageDetection = {
  '.py': {
    command: 'python3',
    example: 'python3 script.py'
  },
  '.js': {
    command: 'node',
    example: 'node app.js'
  },
  '.java': {
    command: 'javac && java',
    example: 'javac Main.java && java Main'
  },
  '.cpp': {
    command: 'g++',
    example: 'g++ main.cpp -o main && ./main'
  }
};
```

---

## 🚀 Features in Detail

### 1. Auto-Detection & Execution
```javascript
// When you click "Run":
1. Detects file extension (.py, .js, .java, .cpp)
2. Sends file to backend
3. Creates Docker container
4. Executes with correct runtime
5. Streams output to terminal
```

### 2. Real-Time Streaming
```python
# Python script with output
for i in range(10):
    print(f"Progress: {i}")
    time.sleep(1)

# Output appears line-by-line in real-time
```

### 3. Interactive Input
```python
# Python script with input
name = input("Enter your name: ")
print(f"Hello, {name}!")

# Terminal accepts user input
> python3 interactive.py
Enter your name: <user types here>
Hello, John!
```

---

## ⚙️ Configuration

### Terminal Settings
```javascript
// In Terminal.jsx
const terminal = new Terminal({
  cursorBlink: true,
  cursorStyle: 'block',
  fontSize: 14,
  fontFamily: 'Consolas, monospace',
  theme: {
    background: '#1e1e1e',
    foreground: '#ffffff',
    cursor: '#ffffff'
  },
  scrollback: 1000
});
```

### WebSocket Configuration
```javascript
// Backend: backend/src/lib/terminalManager.js
const wss = new WebSocketServer({
  port: 3002,
  perMessageDeflate: false,
  clientTracking: true
});
```

---

## 🎨 Terminal Themes

### Dark Theme (Default)
```javascript
theme: {
  background: '#1e1e1e',
  foreground: '#ffffff',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5'
}
```

---

## 📊 Execution Flow

```
┌─────────────┐
│   Editor    │
│ (click Run) │
└──────┬──────┘
       │
       ↓
┌─────────────────┐
│    Terminal     │
│  Auto-detect    │
│   language      │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│   WebSocket     │
│  Send command   │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│    Backend      │
│  Create Docker  │
│   container     │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│  Execute Code   │
│  Stream output  │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│    Terminal     │
│ Display output  │
└─────────────────┘
```

---

## 🐛 Troubleshooting

### Issue: Terminal not connecting
**Solution**: 
```bash
# Check WebSocket connection
Browser Console → Network → WS tab
# Should show connected WebSocket

# Restart backend
cd backend
npm run dev
```

### Issue: Output not appearing
**Solution**:
- Check Docker container is running: `docker ps`
- Check backend logs for errors
- Verify file path is correct

### Issue: Cannot type in terminal
**Solution**:
- Click inside terminal to focus
- Check if process is running (Ctrl+C to cancel)
- Refresh page if frozen

---

## 🔗 API Endpoints

### WebSocket Events
```javascript
// Connect
ws://localhost:3002

// Events
- 'connection': New terminal session
- 'input': User command/input
- 'output': Command output
- 'exit': Process terminated
- 'error': Execution error
- 'close': Session closed
```

---

## 📖 References

- [xterm.js Documentation](https://xtermjs.org/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [ANSI Escape Codes](https://en.wikipedia.org/wiki/ANSI_escape_code)
