# Docker Deployment Guide

## Quick Start

### Development
```bash
# Start development environment
npm run docker:dev

# View logs
npm run docker:dev:logs

# Stop
npm run docker:dev:down
```

### Production
```bash
# Build and start production
npm run docker:prod

# View logs
npm run docker:prod:logs

# Stop
npm run docker:prod:down
```

## Configuration

### Environment Files
- `.env.development` - Development environment
- `.env.production` - Production environment

### Ports
- **3030** - Main application port
- Health check available at `http://localhost:3030/health`

### Volumes
- `./data` - Persistent bot data
- `./logs` - Application logs

## Health Monitoring

The bot includes comprehensive health checks:
- `/health` - Full system health check
- `/health/docker` - Docker-specific health check

## Troubleshooting

### Permission Issues
If you encounter permission issues with mounted volumes:
```bash
# Fix host directory permissions
sudo chown -R 1001:1001 ./data ./logs
```

### Container Not Starting
1. Check logs: `npm run docker:logs`
2. Verify environment variables in `.env` file
3. Ensure ports are not in use: `lsof -i :3030`

### Health Check Failures
1. Check if server is running: `curl http://localhost:3030/health`
2. Verify Discord token and client ID are set
3. Check database connectivity

## Advanced Usage

### Custom Build
```bash
# Force rebuild without cache
npm run docker:build:force

# Clean everything and rebuild
npm run docker:clean
npm run docker:build:force
```

### Updates
```bash
# Update from git and rebuild
npm run docker:update

# Force update (cleans everything)
npm run docker:force-update
```

### Monitoring
```bash
# Check container status
npm run docker:status

# View real-time logs
npm run docker:logs

# Restart container
npm run docker:restart
```