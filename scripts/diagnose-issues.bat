@echo off
echo ============================================
echo AI-IDE Project Diagnostic Script
echo ============================================
echo.

echo [1/7] Checking Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
) else (
    echo OK: Node.js is installed
)
echo.

echo [2/7] Checking Docker...
docker --version
if %errorlevel% neq 0 (
    echo ERROR: Docker not found or not running!
    echo Please start Docker Desktop
) else (
    echo OK: Docker is installed
)
echo.

echo [3/7] Checking Docker daemon...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker daemon is not running!
    echo Please start Docker Desktop
) else (
    echo OK: Docker daemon is running
    docker ps
)
echo.

echo [4/7] Listing existing Docker images...
docker images | findstr ai-ide
if %errorlevel% neq 0 (
    echo WARNING: No AI-IDE images found
) else (
    echo Found AI-IDE images:
)
echo.

echo [5/7] Checking MongoDB...
echo Attempting to connect to MongoDB...
cd backend
if exist node_modules (
    echo OK: Node modules exist
) else (
    echo WARNING: Backend node_modules not found
    echo Run: cd backend && npm install
)
cd ..
echo.

echo [6/7] Checking Frontend...
cd frontend
if exist node_modules (
    echo OK: Frontend node_modules exist
) else (
    echo WARNING: Frontend node_modules not found
    echo Run: cd frontend && npm install
)
cd ..
echo.

echo [7/7] Checking Environment Files...
if exist .env (
    echo OK: .env file exists
) else (
    echo WARNING: .env file not found
    echo Copy .env.example to .env and configure
)
echo.

echo ============================================
echo Diagnosis Complete!
echo ============================================
echo.
echo NEXT STEPS:
echo 1. If Docker errors: Start Docker Desktop
echo 2. If node_modules missing: Run npm install
echo 3. If .env missing: Copy .env.example to .env
echo.
echo To build Docker images, run:
echo   scripts\build-runners.bat
echo.
pause
