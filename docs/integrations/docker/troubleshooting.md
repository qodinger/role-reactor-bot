# Docker Troubleshooting Guide

## Issue: xp Command Shows "Unknown Command" in Production

### 🔍 **Root Cause**

The issue is caused by **command collection synchronization problems** in Docker containers, where commands are not properly loaded into both the client and command handler collections.

### 🛠️ **Fixes Applied**

#### 1. **Enhanced Command Loading with Retry Logic**

- Added Docker environment detection
- Added startup delays for container stability
- Added retry logic for command loading
- Added synchronization verification

#### 2. **Docker-Specific Startup Script**

- Created `scripts/docker-startup.sh`
- Added proper permission handling
- Added environment variable validation
- Added system stability waits

#### 3. **Enhanced Health Monitoring**

- Added `/health/docker` endpoint
- Added `/health/commands` endpoint
- Added command synchronization status
- Added Docker environment information

### 🚀 **Deployment Steps**

#### Step 1: Update Environment Variables

```bash
# Add to your .env.production file
DOCKER_ENV=true
NODE_ENV=production
```

#### Step 2: Rebuild and Deploy

```bash
# Stop existing container
docker-compose -f docker-compose.prod.yml down

# Rebuild with new fixes
docker-compose -f docker-compose.prod.yml build --no-cache

# Start the container
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f role-reactor-bot
```

#### Step 3: Verify Health Status

```bash
# Check basic health
curl http://localhost:3030/health

# Check Docker-specific health
curl http://localhost:3030/health/docker

# Check command health
curl http://localhost:3030/health/commands
```

### 🔧 **Troubleshooting Commands**

#### Check Container Status

```bash
# View container status
docker ps -a

# View container logs
docker logs role-reactor-bot

# Execute commands in container
docker exec -it role-reactor-bot sh
```

#### Check Command Loading

```bash
# Inside container, check if commands are loaded
docker exec -it role-reactor-bot node -e "
const { getCommandHandler } = require('./src/utils/core/commandHandler.js');
const handler = getCommandHandler();
console.log('Commands:', handler.getAllCommandsDebug());
"
```

#### Check File Permissions

```bash
# Check data directory permissions
docker exec -it role-reactor-bot ls -la /usr/src/app/data

# Check logs directory permissions
docker exec -it role-reactor-bot ls -la /usr/src/app/logs
```

### 📊 **Expected Log Output**

After the fix, you should see:

```
🐳 Docker environment detected, waiting for system stability...
✅ Data directory is accessible
🚀 Docker startup wait completed
✅ Command collections are synchronized (25 commands)
✅ Loaded 25 commands successfully (0 errors)
```

### ❌ **Common Issues and Solutions**

#### Issue: Commands Still Not Synchronized

**Solution**: Check container logs for timing issues

```bash
docker logs role-reactor-bot | grep -i "command\|sync"
```

#### Issue: Permission Denied Errors

**Solution**: Check volume permissions

```bash
# Fix permissions on host
sudo chown -R 1001:1001 ./data ./logs
```

#### Issue: Container Won't Start

**Solution**: Check environment variables

```bash
# Verify .env.production file exists and has correct values
cat .env.production
```

### 🔍 **Debugging Commands**

#### Use the Health Command in Discord

```
/health
```

This will show command synchronization status and any mismatches.

#### Check Command Collections

```bash
# Inside container
docker exec -it role-reactor-bot sh
cd /usr/src/app
node -e "
const { getCommandHandler } = require('./src/utils/core/commandHandler.js');
const handler = getCommandHandler();
const debug = handler.getAllCommandsDebug();
console.log(JSON.stringify(debug, null, 2));
"
```

### 📝 **Monitoring and Alerts**

#### Health Check Endpoints

- `/health` - Basic health status
- `/health/docker` - Docker-specific information
- `/health/commands` - Command loading status

#### Log Monitoring

```bash
# Monitor logs in real-time
docker-compose -f docker-compose.prod.yml logs -f --tail=100

# Search for specific errors
docker logs role-reactor-bot 2>&1 | grep -i "error\|warn\|command"
```

### 🚨 **Emergency Recovery**

If commands are still not working:

1. **Restart the container**:

   ```bash
   docker-compose -f docker-compose.prod.yml restart
   ```

2. **Check command deployment**:

   ```bash
   docker exec -it role-reactor-bot node scripts/deploy-commands.js
   ```

3. **Verify Discord API status**:
   - Check if Discord is experiencing issues
   - Verify bot token is still valid
   - Check bot permissions in Discord

### 📞 **Getting Help**

If the issue persists:

1. Check the health endpoints for detailed status
2. Review container logs for error messages
3. Verify environment variables are correct
4. Check Discord Developer Portal for bot status
5. Ensure all required permissions are granted

### 🔄 **Prevention**

To prevent future issues:

1. Always use the startup script in Docker
2. Monitor health endpoints regularly
3. Set up log monitoring and alerts
4. Use proper volume permissions
5. Test in staging environment first
