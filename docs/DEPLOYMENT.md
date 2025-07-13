# Deployment Guide

## 🚀 Production Deployment

### Initial Setup
```bash
# Build and start production container
pnpm docker:build
pnpm docker:prod

# Check status
docker ps | grep role-reactor-bot
```

### Production Updates
```bash
# Option 1: Full update (stops, rebuilds, restarts)
pnpm docker:update

# Option 2: Just restart (if no code changes)
pnpm docker:restart:prod

# Option 3: Manual update (step by step)
docker stop role-reactor-bot
docker rm role-reactor-bot
pnpm docker:build:force
pnpm docker:prod
```

### Production Monitoring
```bash
# View logs
docker logs -f role-reactor-bot

# Check container status
docker ps | grep role-reactor-bot

# Check resource usage
docker stats role-reactor-bot
```

## 🛠️ Development Workflow

### Development Mode (Live Reload)
```bash
# Start development with code mounting
pnpm docker:dev

# View logs
pnpm docker:dev:logs

# Restart development
pnpm docker:dev:restart

# Stop development
pnpm docker:dev:down
```

### Testing Changes
```bash
# Test in isolation
pnpm docker:test

# Build and test locally
pnpm docker:build
pnpm docker:run
```

## 📋 Command Reference

### Production Commands
- `pnpm docker:prod` - Start production container
- `pnpm docker:restart:prod` - Restart production container
- `pnpm docker:update` - Full update (stop, rebuild, restart)
- `pnpm docker:stop` - Stop production container
- `pnpm docker:clean` - Stop and remove container

### Development Commands
- `pnpm docker:dev` - Start development mode
- `pnpm docker:dev:logs` - View development logs
- `pnpm docker:dev:restart` - Restart development
- `pnpm docker:dev:down` - Stop development

### Build Commands
- `pnpm docker:build` - Build image (with cache)
- `pnpm docker:build:force` - Build image (no cache)
- `pnpm docker:test` - Test container functionality

## 🔄 Update Workflows

### Minor Updates (No Code Changes)
```bash
pnpm docker:restart:prod
```

### Code Updates
```bash
pnpm docker:update
```

### Development Iteration
```bash
# Start development mode
pnpm docker:dev

# Make code changes (auto-reloads)
# Test functionality

# Deploy to production
pnpm docker:update
```

## 🚨 Emergency Procedures

### Container Crashed
```bash
# Check status
docker ps -a | grep role-reactor-bot

# Restart if stopped
docker start role-reactor-bot

# Or full restart
pnpm docker:restart:prod
```

### Database Issues
```bash
# Check MongoDB connection
docker logs role-reactor-bot | grep -i mongo

# Restart with fresh connection
pnpm docker:restart:prod
```

### Bot Not Responding
```bash
# Check logs
docker logs role-reactor-bot --tail 50

# Restart bot
pnpm docker:restart:prod

# If still issues, full update
pnpm docker:update
```

## 📊 Monitoring

### Health Checks
```bash
# Container status
docker ps | grep role-reactor-bot

# Resource usage
docker stats role-reactor-bot

# Recent logs
docker logs role-reactor-bot --tail 20
```

### Log Analysis
```bash
# Follow logs in real-time
docker logs -f role-reactor-bot

# Search for errors
docker logs role-reactor-bot | grep -i error

# Search for specific events
docker logs role-reactor-bot | grep "messageDelete"
``` 