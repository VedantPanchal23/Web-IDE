@echo off
REM AI-IDE Development Environment Stop Script (Windows)

echo 🛑 Stopping AI-IDE Development Environment...

REM Stop Docker Compose services
echo 🐳 Stopping Docker services...
docker-compose -f docker-compose.dev.yml down

REM Stop any running Node.js processes (frontend/backend)
echo 🔄 Stopping Node.js development servers...
taskkill /f /im node.exe 2>nul
taskkill /f /im nodemon.exe 2>nul

echo ✅ Development environment stopped!
echo.
echo 💡 To start again, run: scripts\start-dev.bat