@echo off
REM AI-IDE Universal Docker Runner Build Script (Windows)
REM Updated: Now builds single universal container with all language runtimes

echo 🐳 Building AI-IDE Universal Runner Image...

REM Get the directory where the script is located
set SCRIPT_DIR=%~dp0
REM Go to project root (parent of scripts directory)
cd /d "%SCRIPT_DIR%.."

echo 📍 Working directory: %CD%
echo.

REM Build Universal Runner (Python + Node.js + Java + C++)
echo 📦 Building universal runner image with all language runtimes...
echo    - Python 3.10
echo    - Node.js 18
echo    - OpenJDK 17
echo    - GCC/G++ 11
echo.
cd /d "%CD%\runner-images\universal"
docker build -t ai-ide-universal-runner .

if %errorlevel% neq 0 (
    echo ❌ Failed to build universal runner image
    cd /d "%SCRIPT_DIR%.."
    exit /b 1
)

echo ✅ Universal runner image built successfully
echo.

REM Return to project root
cd /d "%SCRIPT_DIR%.."

echo 🎉 Universal runner image built successfully!
echo.
echo 🌐 Available image:
echo - ai-ide-universal-runner (Python • Node.js • Java • C++)
echo.
echo Verifying runtimes...
docker run --rm ai-ide-universal-runner bash -c "echo '✅ Python:' && python3 --version && echo '✅ Node.js:' && node --version && echo '✅ Java:' && java --version | head -1 && echo '✅ C++:' && g++ --version | head -1"
echo.
echo 📋 Image details:
docker images | findstr ai-ide-universal

echo.
echo 💡 To remove old language-specific images (optional):
echo    docker rmi ai-ide-python-runner ai-ide-node-runner ai-ide-java-runner ai-ide-cpp-runner
