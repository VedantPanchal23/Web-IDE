@echo off
REM AI-IDE Development Setup Script (Windows)
REM Sets up development tools and validates configuration

echo 🛠️ Setting up AI-IDE Development Environment...

REM Setup Git hooks  
echo 📋 Setting up Git hooks...
if exist ".git" (
    copy .githooks\pre-commit .git\hooks\pre-commit > nul
    echo ✅ Pre-commit hook installed
) else (
    echo ⚠️ Not a Git repository. Skipping Git hooks setup.
)

REM Backend setup
echo 🔧 Setting up backend tools...
cd backend
call npm install
echo Running backend validation...
call npm run validate
if %errorlevel% equ 0 (
    echo ✅ Backend tools configured successfully
) else (
    echo ⚠️ Backend validation warnings
)
cd ..

REM Frontend setup
echo ⚛️ Setting up frontend tools...
cd frontend  
call npm install
echo Running frontend validation...
call npm run validate
if %errorlevel% equ 0 (
    echo ✅ Frontend tools configured successfully
) else (
    echo ⚠️ Frontend validation warnings
)
cd ..

REM Create VS Code settings
echo 💼 Creating VS Code workspace settings...
if not exist ".vscode" mkdir .vscode

echo { > .vscode\settings.json
echo   "editor.formatOnSave": true, >> .vscode\settings.json
echo   "editor.codeActionsOnSave": { >> .vscode\settings.json
echo     "source.fixAll.eslint": true >> .vscode\settings.json
echo   }, >> .vscode\settings.json
echo   "eslint.workingDirectories": ["backend", "frontend"], >> .vscode\settings.json
echo   "prettier.requireConfig": true, >> .vscode\settings.json
echo   "files.associations": { >> .vscode\settings.json
echo     "*.js": "javascript", >> .vscode\settings.json
echo     "*.jsx": "javascriptreact" >> .vscode\settings.json
echo   } >> .vscode\settings.json
echo } >> .vscode\settings.json

echo ✅ VS Code settings created

echo.
echo 🎉 Development environment setup complete!
echo.
echo 📋 Development workflow:
echo   • Format code: npm run format (in backend\ or frontend\)
echo   • Lint code: npm run lint (in backend\ or frontend\) 
echo   • Validate all: npm run validate (in backend\ or frontend\)
echo   • Pre-commit hooks will run automatically on git commit
echo.
echo 🚀 Ready for development!