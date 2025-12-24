# Role Reactor Bot - Deployment Guide

## Quick Start

For the fastest deployment of the latest version:

```bash
# Method 1: Using npm/pnpm script (recommended)
pnpm run deploy:latest

# Method 2: Direct script execution
./scripts/deploy-latest.sh
```

## Available Deployment Methods

### 1. Latest Version Deployment (Recommended)

The new `deploy-latest.sh` script is the most reliable way to deploy. It handles all edge cases and ensures the latest version is deployed correctly.

**Available commands:**

```bash
# Standard deployment
pnpm run deploy:latest

# Verbose output (shows detailed docker commands)
pnpm run deploy:latest:verbose

# Force deployment (even if no changes detected)
pnpm run deploy:latest:force
```

**What this script does:**

1. ✅ Pulls latest changes from git repository
2. ✅ Stops and removes existing containers
3. ✅ Cleans Docker cache and images (prevents version mismatches)
4. ✅ Builds fresh Docker image with `--no-cache` and `--pull`
5. ✅ Verifies the built image contains the correct version
6. ✅ Starts the new container
7. ✅ Verifies deployment success and health

### 2. Legacy Deployment Methods

These scripts are still available but may encounter caching issues:

```bash
# Update scripts (may have caching issues)
pnpm run docker:update          # Basic update
pnpm run docker:force-update    # Aggressive cleanup + update

# Manual deployment
pnpm run docker:clean           # Stop and clean
pnpm run docker:build:force     # Build with no cache
pnpm run docker:prod            # Start production container
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Version Mismatch (Old Version Still Running)

**Problem:** Docker shows old version even after rebuild
**Solution:** Use the new deployment script which handles this automatically:

```bash
pnpm run deploy:latest
```

#### 2. Container Fails to Start

**Problem:** Container exits or shows unhealthy status
**Solutions:**

```bash
# Check logs for errors
docker logs role-reactor-bot

# Check environment files exist
ls -la .env*

# Verify permissions
./scripts/fix-permissions.sh
```

#### 3. Build Failures

**Problem:** Docker build fails or uses cached layers incorrectly
**Solution:**

```bash
# Use force deployment to clear all caches
pnpm run deploy:latest:force
```

#### 4. Database Connection Issues

**Problem:** Bot can't connect to database
**Solutions:**

```bash
# Check if MongoDB is running (if using local DB)
sudo systemctl status mongod

# Verify environment variables
docker exec role-reactor-bot printenv | grep MONGODB
```

### Health Checks

After deployment, verify everything is working:

```bash
# Check container status
docker ps | grep role-reactor-bot

# Check logs
docker logs role-reactor-bot -f

# Check version inside container
docker exec role-reactor-bot cat package.json | grep version
```

## Environment Setup

### Required Files

Ensure these files exist:

- `.env.production` - Production environment variables
- `docker-compose.prod.yml` - Production compose configuration

### Environment Variables

Key variables in `.env.production`:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=production
```

## Monitoring

### View Live Logs

```bash
docker logs role-reactor-bot -f
```

### Container Status

```bash
# Quick status check
docker ps | grep role-reactor-bot

# Detailed container info
docker inspect role-reactor-bot
```

### Health Endpoint

The bot exposes a health check endpoint:

```bash
curl http://localhost:3000/health
```

## Best Practices

1. **Always use the latest deployment script** for new deployments
2. **Check logs after deployment** to ensure everything started correctly
3. **Monitor memory usage** - the bot will show warnings if memory usage is high
4. **Regular updates** - deploy updates promptly to get bug fixes and new features
5. **Backup before deployment** - especially if you've made local configuration changes

## Rollback

If you need to rollback to a previous version:

```bash
# 1. Check available tags
git tag -l

# 2. Checkout specific version
git checkout v1.0.0  # Replace with desired version

# 3. Deploy that version
pnpm run deploy:latest:force

# 4. Return to main branch when ready
git checkout main
```

## Advanced Usage

### Custom Docker Commands

If you need more control:

```bash
# Build specific version
docker build -t role-reactor-bot:v1.0.1 .

# Run with custom configuration
docker run -d --name role-reactor-bot \
  --env-file .env.production \
  -p 3000:3000 \
  role-reactor-bot:v1.0.1
```

### Development Deployment

For development deployment:

```bash
# Start development environment
pnpm run docker:dev

# View development logs
pnpm run docker:dev:logs

# Stop development environment
pnpm run docker:dev:down
```

## Support

If you encounter issues:

1. Check this deployment guide
2. Review the logs: `docker logs role-reactor-bot`
3. Try the force deployment: `pnpm run deploy:latest:force`
4. Check the project's GitHub issues
5. Ensure all required environment variables are set

---

**Last Updated:** 2025-09-16
**Script Version:** deploy-latest.sh v1.0
