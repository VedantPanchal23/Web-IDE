@echo off
REM AI-IDE Development Environment Setup Script (Windows)

echo 🚀 Starting AI-IDE Development Environment...

REM Copy environment file
if not exist .env (
    echo 📝 Creating .env file from development template...
    copy .env.development .env > nul
    echo ✅ Environment file created. Please update with your API keys.
)

REM Start development services
echo 🐳 Starting development services with Docker Compose...
docker-compose -f docker-compose.dev.yml up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to start...
timeout /t 10 > nul

REM Check MongoDB connection
echo 🔍 Checking MongoDB connection...
docker exec ai-ide-mongodb-dev mongosh --eval "db.runCommand('ping')" --quiet

REM Check Redis connection  
echo 🔍 Checking Redis connection...
docker exec ai-ide-redis-dev redis-cli -a redis123 ping

echo 📦 Installing backend dependencies...
cd backend
call npm install
cd ..

echo 📦 Installing frontend dependencies...
cd frontend  
call npm install
cd ..

echo ✅ Development environment ready!
echo.
echo 🌐 Frontend: http://localhost:3000
echo 🔧 Backend:  http://localhost:3001  
echo 🏥 Health:   http://localhost:3001/health
echo 📊 MongoDB:  mongodb://admin:password123@localhost:27017
echo 🔴 Redis:    redis://:redis123@localhost:6379
echo.
echo 📋 To stop all services:
echo    scripts\stop-dev.bat
echo.
echo 🔄 To restart services:
echo    scripts\restart-dev.bat
echo.
echo ▶️ To start frontend: cd frontend ^&^& npm run dev
echo ▶️ To start backend:  cd backend ^&^& npm run dev