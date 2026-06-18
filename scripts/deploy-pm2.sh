#!/bin/bash

# PM2 Deployment Script - Update and restart bot
# Run this after pushing changes to deploy updates

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }

APP_DIR="/opt/role-reactor-bot"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          Role Reactor Bot - PM2 Deployment                  ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

cd $APP_DIR

# 1. Pull latest code
log "Pulling latest changes..."
git pull origin main

# 2. Install any new dependencies
log "Installing dependencies..."
pnpm install --prod

# 3. Restart bot with zero downtime
log "Restarting bot..."
pm2 reload role-reactor-bot --update-env

# 4. Show status
sleep 2
pm2 status

success "Deployment complete!"
echo ""
echo "View logs: pm2 logs role-reactor-bot"
echo ""
