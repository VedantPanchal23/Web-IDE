#!/bin/bash

# AI-IDE Docker Runner Images Build Script

echo "🐳 Building AI-IDE Runner Images..."

# Build Python Runner
echo "📦 Building Python runner image..."
cd runner-images/python
docker build -t ai-ide-python-runner .

if [ $? -eq 0 ]; then
    echo "✅ Python runner image built successfully"
else
    echo "❌ Failed to build Python runner image"
    exit 1
fi

# Build Node.js Runner  
echo "📦 Building Node.js runner image..."
cd ../node
docker build -t ai-ide-node-runner .

if [ $? -eq 0 ]; then
    echo "✅ Node.js runner image built successfully"
else
    echo "❌ Failed to build Node.js runner image"
    exit 1
fi

# Build C/C++ Runner
echo "📦 Building C/C++ runner image..."
cd ../cpp
docker build -t ai-ide-cpp-runner .

if [ $? -eq 0 ]; then
    echo "✅ C/C++ runner image built successfully"
else
    echo "❌ Failed to build C/C++ runner image"
    exit 1
fi

# Build Java Runner
echo "📦 Building Java runner image..."
cd ../java
docker build -t ai-ide-java-runner .

if [ $? -eq 0 ]; then
    echo "✅ Java runner image built successfully"
else
    echo "❌ Failed to build Java runner image"
    exit 1
fi

cd ../..

echo "🎉 All runner images built successfully!"
echo ""
echo "Available images:"
echo "- ai-ide-node-runner (JavaScript/TypeScript)"
echo "- ai-ide-python-runner (Python)"  
echo "- ai-ide-cpp-runner (C/C++)"
echo "- ai-ide-java-runner (Java)"
echo ""
docker images | grep ai-ide