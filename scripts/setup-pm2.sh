#!/bin/bash

# PM2 Initial Setup Script - Run once on fresh VPS
# This sets up PM2 to start on boot and configures log rotation

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }

APP_DIR="/root/projects/role-reactor-bot"
BOT_NAME="role-reactor-bot"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          Role Reactor Bot - PM2 Initial Setup               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# 1. Install PM2 globally if not present
log "Checking PM2 installation..."
if ! command -v pm2 &> /dev/null; then
    log "Installing PM2..."
    npm install -g pm2
    success "PM2 installed"
else
    success "PM2 already installed"
fi

# 2. Setup PM2 startup (auto-start on boot)
log "Configuring PM2 startup..."
pm2 startup

# 3. Create logs directory
log "Creating logs directory..."
mkdir -p "$APP_DIR/logs"

# 4. Start the bot
log "Starting bot..."
cd $APP_DIR
pm2 start ecosystem.config.cjs

# 5. Save process list
log "Saving process list..."
pm2 save

# 6. Install and configure log rotation
log "Setting up log rotation..."
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# 7. Show status
sleep 2
pm2 status

success "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Follow the PM2 startup instructions above"
echo "  2. Run: pm2 save"
echo "  3. Verify: pm2 status"
echo ""
echo "Useful commands:"
echo "  pm2 logs $BOT_NAME        # View logs"
echo "  pm2 restart $BOT_NAME     # Restart bot"
echo "  pm2 stop $BOT_NAME        # Stop bot"
echo "  pm2 monit                 # Monitor resources"
echo ""
