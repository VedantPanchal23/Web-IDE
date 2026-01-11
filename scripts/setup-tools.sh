#!/bin/bash

# AI-IDE Development Setup Script
# Sets up Git hooks, validates tools, and prepares development environment

echo "🛠️ Setting up AI-IDE Development Environment..."

# Setup Git hooks
echo "📋 Setting up Git hooks..."
if [ -d ".git" ]; then
    # Copy pre-commit hook
    cp .githooks/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo "✅ Pre-commit hook installed"
else
    echo "⚠️ Not a Git repository. Skipping Git hooks setup."
fi

# Install dependencies and validate tools
echo "📦 Installing and validating development tools..."

# Backend setup
echo "🔧 Setting up backend tools..."
cd backend
npm install
echo "Running backend validation..."
npm run validate
if [ $? -eq 0 ]; then
    echo "✅ Backend tools configured successfully"
else
    echo "⚠️ Backend validation warnings (check output above)"
fi
cd ..

# Frontend setup  
echo "⚛️ Setting up frontend tools..."
cd frontend
npm install
echo "Running frontend validation..."
npm run validate
if [ $? -eq 0 ]; then
    echo "✅ Frontend tools configured successfully"
else
    echo "⚠️ Frontend validation warnings (check output above)"
fi
cd ..

# Create VS Code workspace settings
echo "💼 Creating VS Code workspace settings..."
mkdir -p .vscode
cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": ["backend", "frontend"],
  "prettier.requireConfig": true,
  "files.associations": {
    "*.js": "javascript",
    "*.jsx": "javascriptreact"
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/.git": true,
    "**/coverage": true
  }
}
EOF

# Create launch configuration for debugging
cat > .vscode/launch.json << 'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/index.js",
      "cwd": "${workspaceFolder}/backend",
      "envFile": "${workspaceFolder}/.env",
      "console": "integratedTerminal"
    },
    {
      "name": "Attach to Backend",
      "type": "node", 
      "request": "attach",
      "port": 9229,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
EOF

echo "✅ VS Code settings created"

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📋 Development workflow:"
echo "  • Format code: npm run format (in backend/ or frontend/)"
echo "  • Lint code: npm run lint (in backend/ or frontend/)"
echo "  • Validate all: npm run validate (in backend/ or frontend/)"
echo "  • Pre-commit hooks will run automatically on git commit"
echo ""
echo "🔧 VS Code features:"
echo "  • Auto-format on save"
echo "  • ESLint fixes on save"
echo "  • Debugging configurations available"
echo ""
echo "🚀 Ready for development!"