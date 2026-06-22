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

# 7. Install and configure Caddy reverse proxy
log "Installing Caddy..."
if ! command -v caddy &> /dev/null; then
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update
    sudo apt install -y caddy
    success "Caddy installed"
else
    success "Caddy already installed"
fi

log "Configuring Caddy reverse proxy..."
cat << 'CADDYFILE' > /etc/caddy/Caddyfile
api.rolereactor.app {
    reverse_proxy localhost:3030
}
CADDYFILE

log "Starting Caddy..."
sudo systemctl restart caddy
sudo systemctl enable caddy
success "Caddy configured: api.rolereactor.app → localhost:3030"

# 8. Show status
sleep 2
pm2 status

success "Setup complete!"
echo ""
echo "Services:"
echo "  Bot:     pm2 status"
echo "  Caddy:   sudo systemctl status caddy"
echo "  Logs:    pm2 logs $BOT_NAME"
echo ""
echo "Useful commands:"
echo "  pm2 logs $BOT_NAME        # View bot logs"
echo "  pm2 restart $BOT_NAME     # Restart bot"
echo "  pm2 stop $BOT_NAME        # Stop bot"
echo "  pm2 monit                 # Monitor resources"
echo "  sudo systemctl restart caddy  # Restart Caddy"
echo ""
