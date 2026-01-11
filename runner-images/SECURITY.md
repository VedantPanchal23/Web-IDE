# AI-IDE Docker Security Configuration

## Security Hardening Applied:

### 1. Non-Root User Execution
- Both Python and Node.js runners use dedicated `runner` user
- No root privileges inside containers
- Workspace permissions properly configured

### 2. Resource Limits
- CPU: Limited to 1 core per container
- Memory: 512MB limit per execution
- Network: Restricted to localhost only
- Disk: 100MB temporary storage limit

### 3. Execution Timeouts
- Maximum execution time: 30 seconds
- Automatic cleanup after timeout
- Process isolation per execution

### 4. File System Restrictions
- Read-only container filesystem
- Writable workspace limited to /workspace/code
- No access to host filesystem
- Temporary files automatically cleaned

### 5. Network Isolation
- No internet access during code execution
- Localhost communication only for LSP
- Blocked external API calls

## Docker Run Security Options

```bash
# Python Runner Security Options
docker run --rm \
  --user runner \
  --cpus="1.0" \
  --memory="512m" \
  --network none \
  --read-only \
  --tmpfs /workspace/code:exec,size=100m \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  ai-ide-python:latest

# Node.js Runner Security Options  
docker run --rm \
  --user runner \
  --cpus="1.0" \
  --memory="512m" \
  --network none \
  --read-only \
  --tmpfs /workspace/code:exec,size=100m \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  ai-ide-node:latest
```

## Usage in Backend

The backend will use these security options when creating containers:

```javascript
const securityOptions = {
  User: 'runner',
  Memory: 512 * 1024 * 1024, // 512MB
  CpuQuota: 100000, // 1 CPU
  NetworkMode: 'none',
  ReadonlyRootfs: true,
  SecurityOpt: ['no-new-privileges'],
  CapDrop: ['ALL']
}
```





py
docker build -t ai-ide-python:latest .

no
docker build -t ai-ide-node:latest .