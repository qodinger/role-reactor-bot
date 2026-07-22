#!/bin/bash

# Role Reactor Bot - Full VPS Setup Script
# Run this on a fresh Ubuntu/Debian VPS to set up everything from scratch

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warning() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "Run as root: sudo ./scripts/setup-vps.sh"
fi

DOMAIN="api.rolereactor.xyz"
EMAIL="sengphachanh.dev@gmail.com"
APP_DIR="/root/projects/role-reactor-bot"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       Role Reactor Bot - Full VPS Setup (PM2 + Nginx)       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# 1. System updates
log "Updating system packages..."
apt update && apt upgrade -y
success "System updated"

# 2. Install Node.js 22
log "Installing Node.js 22..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs
fi
success "Node.js $(node -v) installed"

# 3. Install pnpm
log "Installing pnpm..."
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm@9.9.0
fi
success "pnpm $(pnpm -v) installed"

# 4. Install PM2
log "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
success "PM2 installed"

# 5. Install Nginx
log "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    systemctl enable nginx
    systemctl start nginx
fi
success "Nginx installed"

# 6. Install Certbot
log "Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
fi
success "Certbot installed"

# 7. Create app directory
log "Setting up application directory..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/logs
mkdir -p $APP_DIR/data

# 8. Clone or copy the bot
if [ ! -d "$APP_DIR/.git" ]; then
    log "Cloning repository..."
    cd /opt
    git clone https://github.com/rolereactor/role-reactor-bot.git role-reactor-bot
    cd role-reactor-bot
else
    log "Repository exists, pulling latest..."
    cd $APP_DIR
    git pull origin main
fi
success "Code ready"

# 9. Install dependencies
log "Installing npm dependencies..."
cd $APP_DIR
pnpm install --prod
success "Dependencies installed"

# 10. Create .env file if it doesn't exist
if [ ! -f "$APP_DIR/.env" ]; then
    warning ".env file not found!"
    echo "Creating .env template..."
    cat > $APP_DIR/.env << 'EOF'
# Discord Bot
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/rolereactor

# Server
PORT=3030
NODE_ENV=production

# API Keys (optional)
OPENAI_API_KEY=your_openai_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
EOF
    warning "Please edit $APP_DIR/.env with your actual values!"
fi

# 11. Setup PM2 ecosystem config
log "Setting up PM2 configuration..."
cat > $APP_DIR/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'role-reactor-bot',
    script: 'src/index.js',
    node_args: '--max-old-space-size=256',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3030,
    },
    max_memory_restart: '200M',
    log_file: './logs/pm2-combined.log',
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
  }],
};
EOF
success "PM2 config created"

# 12. Setup Nginx (without SSL first)
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/rolereactor << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/rolereactor /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
success "Nginx configured"

# 13. Setup SSL with Certbot
log "Setting up SSL certificate..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL || warning "SSL setup failed - you may need to run certbot manually"

# 14. Start the bot with PM2
log "Starting bot with PM2..."
cd $APP_DIR
pm2 start ecosystem.config.cjs --env production
pm2 save
success "Bot started"

# 15. Setup PM2 startup script
log "Configuring PM2 to start on boot..."
pm2 startup systemd -u root --hp /root | tail -1 | bash || warning "PM2 startup configured - reboot to verify"
success "PM2 startup configured"

# 16. Open firewall ports
log "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 'Nginx Full'
    ufw allow 22/tcp
    ufw --force enable
    success "Firewall configured"
else
    warning "UFW not installed - ensure ports 80, 443, 22 are open"
fi

# 17. Final status
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Bot URL:${NC} https://$DOMAIN"
echo -e "${GREEN}App Dir:${NC} $APP_DIR"
echo ""
echo "PM2 Commands:"
echo "  pm2 status          # Check bot status"
echo "  pm2 logs            # View logs"
echo "  pm2 restart all     # Restart bot"
echo "  pm2 monit           # Monitor resources"
echo ""
echo "Nginx Commands:"
echo "  sudo nginx -t       # Test config"
echo "  sudo systemctl reload nginx"
echo ""
echo -e "${YELLOW}NEXT STEPS:${NC}"
echo "1. Edit $APP_DIR/.env with your actual tokens"
echo "2. Restart bot: pm2 restart role-reactor-bot"
echo "3. Check logs: pm2 logs role-reactor-bot"
echo ""
