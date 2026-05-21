# Role Reactor Bot - Deployment Guide

## Quick Start

For the fastest deployment of the latest version:

```bash
# Method 1: Using pnpm script (recommended)
pnpm run deploy:latest

# Method 2: Direct script execution
./scripts/deploy-latest.sh
```

## Available Deployment Methods

### 1. Latest Version Deployment (Recommended)

The `deploy-latest.sh` script handles all edge cases and ensures the latest version is deployed correctly.

```bash
# Standard deployment
pnpm run deploy:latest

# Verbose output (shows detailed docker commands)
pnpm run deploy:latest:verbose

# Force deployment (clears all caches)
pnpm run deploy:latest:force
```

**What this script does:**

1. Pulls latest changes from git
2. Stops and removes existing containers
3. Cleans Docker cache and images
4. Builds fresh Docker image with `--no-cache` and `--pull`
5. Verifies the built image contains the correct version
6. Starts the new container
7. Verifies deployment success and health

### 2. Manual Deployment

```bash
pnpm run docker:clean           # Stop and clean
pnpm run docker:build:force     # Build with no cache
pnpm run docker:prod            # Start production containers
```

---

## Environment Setup

Create a `.env` file on the VPS with the following variables:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=production
CORS_ALLOWED_ORIGINS=https://api.rolereactor.app
```

> **Note:** Environment variables are loaded directly from the host environment or `.env` file. There is no `.env.production` file — secrets are never baked into the image.

---

## Reverse Proxy & SSL (Caddy)

Production uses Caddy as a reverse proxy. It handles SSL certificates automatically via Let's Encrypt.

### Caddyfile

Edit `Caddyfile` at the project root to set your domain:

```
api.rolereactor.app {
    reverse_proxy role-reactor-bot:3030
    ...
}
```

### DNS Setup

Add an A record in your DNS provider pointing your domain to the VPS IP:

```
api.rolereactor.app  →  <your VPS IP>
```

### Firewall

Open ports 80 and 443 on the VPS before starting:

```bash
ufw allow 80 && ufw allow 443
```

### First Deploy

On first `docker compose up`, Caddy automatically:
- Fetches a free SSL certificate from Let's Encrypt
- Sets up HTTPS on port 443
- Redirects HTTP → HTTPS
- Schedules automatic certificate renewal

No certbot or cron jobs needed.

---

## Monitoring

### View Live Logs

```bash
# Bot logs
docker logs role-reactor-bot -f

# Caddy logs
docker logs role-reactor-caddy -f
```

### Container Status

```bash
pnpm run docker:status
```

### Health Endpoint

```bash
# Via domain (external)
curl https://api.rolereactor.app/health

# Via localhost (internal, bypasses Caddy)
curl http://localhost:3030/health
```

---

## Troubleshooting

### Version Mismatch (Old Version Still Running)

```bash
pnpm run deploy:latest:force
```

### Container Fails to Start

```bash
# Check logs for errors
docker logs role-reactor-bot

# Verify env vars are set
docker exec role-reactor-bot printenv | grep DISCORD

# Fix volume permissions
./scripts/fix-permissions.sh
```

### Build Failures

```bash
pnpm run deploy:latest:force
```

### Database Connection Issues

```bash
# Check if MongoDB is reachable
sudo systemctl status mongod

# Verify connection string inside container
docker exec role-reactor-bot printenv | grep MONGODB
```

### SSL Certificate Not Issuing

```bash
# Check DNS propagation
dig api.rolereactor.app

# Check Caddy logs
docker logs role-reactor-caddy
```

---

## Rollback

```bash
# 1. Check available tags
git tag -l

# 2. Checkout specific version
git checkout v1.7.0

# 3. Force deploy that version
pnpm run deploy:latest:force

# 4. Return to main when ready
git checkout main
```

---

## Development Deployment

```bash
# Start development environment (hot reload)
pnpm run docker:dev

# View logs
pnpm run docker:dev:logs

# Stop
pnpm run docker:dev:down
```

For full Docker documentation, see the [Docker Integration Guide](../integrations/docker/README.md).

---

**Last Updated:** 2026-05-21
