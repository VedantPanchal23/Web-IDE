# 📝 Code Editor - Monaco Editor Integration

## Overview
Professional code editor powered by Monaco Editor (same engine as VS Code) with full IntelliSense, syntax highlighting, and advanced editing features.

---

## ✨ Key Features

### 1. **Syntax Highlighting**
- **Supported Languages**: Python, JavaScript, Java, C++, JSON, HTML, CSS, Markdown, and 50+ more
- **Theme**: VS Code Dark theme
- **Auto-detection**: Detects language from file extension

### 2. **IntelliSense & Autocomplete**
- Real-time code completion
- Parameter hints
- Quick info on hover
- Auto-import suggestions

### 3. **Code Navigation**
- Go to Definition (F12)
- Find All References (Shift+F12)
- Peek Definition (Alt+F12)
- Symbol search (Ctrl+Shift+O)

### 4. **Editing Features**
- **Multi-cursor**: Alt+Click or Ctrl+Alt+Up/Down
- **Find & Replace**: Ctrl+F / Ctrl+H
- **Code folding**: Click gutter or Ctrl+Shift+[
- **Auto-indentation**: Automatic code formatting
- **Bracket matching**: Highlights matching brackets

### 5. **Split Editor**
- Side-by-side editing
- Compare files
- Drag & drop files between editors
- Independent scroll

---

## 🎯 Usage

### Basic Operations
```javascript
// Create new file
File Explorer → Right-click → New File

// Open existing file
Click file in File Explorer

// Save file
Ctrl+S (Windows/Linux)
Cmd+S (Mac)

// Close file
Click × on tab or Ctrl+W
```

### Keyboard Shortcuts
| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Save | Ctrl+S | Cmd+S |
| Find | Ctrl+F | Cmd+F |
| Replace | Ctrl+H | Cmd+H |
| Comment | Ctrl+/ | Cmd+/ |
| Format | Shift+Alt+F | Shift+Option+F |
| Command Palette | F1 | F1 |
| Go to Line | Ctrl+G | Cmd+G |

---

## 🔧 Technical Details

### Component
- **Location**: `frontend/src/components/EnhancedMonacoEditor.jsx`
- **Library**: `@monaco-editor/react` v4.6.0
- **Engine**: Monaco Editor v0.44.0

### Configuration
```javascript
{
  theme: 'vs-dark',
  automaticLayout: true,
  fontSize: 14,
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  tabSize: 2,
  insertSpaces: true
}
```

### Language Support
```javascript
// Auto-detection mapping
const languageMap = {
  '.py': 'python',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.html': 'html',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown'
};
```

---

## 🎨 Features in Action

### 1. Code Completion
```python
# Type 'imp' and press Ctrl+Space
import <cursor>  # Auto-suggests: math, os, sys, etc.
```

### 2. Error Detection
```javascript
// Real-time error highlighting
const x = 10
x = 20  // Error: Cannot assign to 'x' because it is a constant
```

### 3. Code Folding
```java
public class Main {  // Click [-] to fold
    public static void main(String[] args) {
        // Method body
    }
}
```

---

## 🚀 Advanced Features

### File Watching
- **Auto-refresh**: Files reload when changed externally
- **Debouncing**: 300ms delay to prevent rapid reloads
- **Status indicator**: Shows when file is reloading

### Split View
```javascript
// Open split editor
1. Click Split Editor button
2. Drag file to split pane
3. Edit both files simultaneously
```

### AI Integration
- **Inline completion**: AI suggests code as you type
- **Code explanation**: Select code → Right-click → Explain
- **Refactoring**: AI-powered improvement suggestions

---

## ⚙️ Customization

### Change Theme
```javascript
// Edit in frontend/src/components/EnhancedMonacoEditor.jsx
<Editor
  theme="vs-dark"  // Options: 'vs-dark', 'vs-light', 'hc-black'
  // ... other props
/>
```

### Adjust Font Size
```javascript
options={{
  fontSize: 16,  // Default: 14
  fontFamily: 'Consolas, "Courier New", monospace'
}}
```

### Enable/Disable Minimap
```javascript
options={{
  minimap: {
    enabled: false  // Hide minimap
  }
}}
```

---

## 🐛 Troubleshooting

### Issue: Editor not loading
**Solution**: Check browser console for errors, ensure Monaco CDN is accessible

### Issue: Syntax highlighting not working
**Solution**: Verify file extension is recognized, check language mapping

### Issue: IntelliSense not appearing
**Solution**: Press Ctrl+Space manually, ensure language server is active

---

## 📖 References

- [Monaco Editor API](https://microsoft.github.io/monaco-editor/api/index.html)
- [VS Code Keyboard Shortcuts](https://code.visualstudio.com/shortcuts/keyboard-shortcuts-windows.pdf)
- [Language Support](https://code.visualstudio.com/docs/languages/overview)
