#!/bin/bash

# AI-IDE Development Environment Setup Script

echo "🚀 Starting AI-IDE Development Environment..."

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from development template..."
    cp .env.development .env
    echo "✅ Environment file created. Please update with your API keys."
fi

# Start development services
echo "🐳 Starting development services with Docker Compose..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check MongoDB connection
echo "🔍 Checking MongoDB connection..."
docker exec ai-ide-mongodb-dev mongosh --eval "db.runCommand('ping')" --quiet

# Check Redis connection  
echo "🔍 Checking Redis connection..."
docker exec ai-ide-redis-dev redis-cli -a redis123 ping

echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo "🎯 Starting backend development server..."
cd backend && npm run dev &
BACKEND_PID=$!

echo "🎯 Starting frontend development server..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo "✅ Development environment ready!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:3001"
echo "🏥 Health:   http://localhost:3001/health"
echo "📊 MongoDB:  mongodb://admin:password123@localhost:27017"
echo "🔴 Redis:    redis://:redis123@localhost:6379"
echo ""
echo "📋 To stop all services:"
echo "   ./scripts/stop-dev.sh"
echo ""
echo "🔄 To restart services:"
echo "   ./scripts/restart-dev.sh"

# Save PIDs for later cleanup
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid