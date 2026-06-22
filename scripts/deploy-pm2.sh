#!/bin/bash

# PM2 Deployment Script - Update and restart bot
# Run this after pushing changes to deploy updates

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

APP_DIR="/root/projects/role-reactor-bot"

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

# 3. Ensure PM2 starts on boot
log "Checking PM2 startup..."
if ! pm2 startup 2>/dev/null | grep -q "already"; then
    warn "PM2 startup not configured. Run 'pm2 startup' once on the VPS, then 'pm2 save'."
fi

# 4. Setup log rotation if not already configured
log "Checking log rotation..."
if ! pm2 list 2>/dev/null | grep -q "pm2-logrotate"; then
    log "Installing pm2-logrotate..."
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 7
    pm2 set pm2-logrotate:compress true
    success "Log rotation configured"
else
    success "Log rotation already active"
fi

# 5. Restart bot with zero downtime
log "Restarting bot..."
pm2 reload role-reactor-bot --update-env

# 6. Save process list for auto-restart
pm2 save

# 7. Show status
sleep 2
pm2 status

success "Deployment complete!"
echo ""
echo "View logs: pm2 logs role-reactor-bot"
echo ""
