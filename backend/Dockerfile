# Backend Dockerfile for production builds
FROM node:18-slim

# Create app directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create docker group and non-root user
RUN groupadd -r docker || true && \
    groupadd -r appuser && \
    useradd -r -g appuser -G docker appuser
RUN chown -R appuser:appuser /app
# Temporarily run as root for Docker access (will fix security later)
# USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["npm", "start"]