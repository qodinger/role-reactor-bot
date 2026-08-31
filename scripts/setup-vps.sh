#!/bin/bash

# Role Reactor Bot - Full VPS Setup
# Run once on a fresh Ubuntu/Debian VPS to set up everything from scratch

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "Run as root: sudo ./scripts/setup-vps.sh"
fi

DOMAIN="api.rolereactor.xyz"
EMAIL="sengphachanh.dev@gmail.com"
APP_DIR="/root/projects/role-reactor-bot"

show_banner() {
    echo ""
    echo "╭─────────────────────────────────────────────────────────────╮"
    echo "│       Role Reactor Bot - Full VPS Setup (PM2 + Nginx)      │"
    echo "╰─────────────────────────────────────────────────────────────╯"
    echo ""
}

show_usage() {
    echo "Usage: sudo $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo ""
    echo "This script will:"
    echo "  1.  Update system packages"
    echo "  2.  Install Node.js 22, pnpm, PM2"
    echo "  3.  Install nginx and certbot"
    echo "  4.  Clone the repository"
    echo "  5.  Configure nginx reverse proxy with SSL"
    echo "  6.  Start the bot with PM2"
    echo "  7.  Configure firewall"
}

setup() {
    show_banner

    # System updates
    info "Updating system packages..."
    apt update && apt upgrade -y
    success "System updated"

    # Install Node.js 22
    info "Installing Node.js 22..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt install -y nodejs
    fi
    success "Node.js $(node -v) installed"

    # Install pnpm
    info "Installing pnpm..."
    if ! command -v pnpm &> /dev/null; then
        npm install -g pnpm@9.9.0
    fi
    success "pnpm $(pnpm -v) installed"

    # Install PM2
    info "Installing PM2..."
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi
    success "PM2 installed"

    # Install Nginx
    info "Installing nginx..."
    if ! command -v nginx &> /dev/null; then
        apt install -y nginx
        systemctl enable nginx
        systemctl start nginx
    fi
    success "nginx installed"

    # Install Certbot
    info "Installing certbot..."
    if ! command -v certbot &> /dev/null; then
        apt install -y certbot python3-certbot-nginx
    fi
    success "certbot installed"

    # Create app directory
    info "Setting up application directory..."
    mkdir -p "$APP_DIR/logs" "$APP_DIR/data"

    # Clone or update repository
    if [ ! -d "$APP_DIR/.git" ]; then
        info "Cloning repository..."
        git clone https://github.com/rolereactor/bot.git "$APP_DIR"
    else
        info "Repository exists, pulling latest..."
        cd "$APP_DIR" && git pull origin main
    fi
    success "Code ready"

    # Install dependencies
    info "Installing dependencies..."
    cd "$APP_DIR" && pnpm install --prod
    success "Dependencies installed"

    # Create .env file if missing
    if [ ! -f "$APP_DIR/.env" ]; then
        warn ".env file not found — creating template..."
        cat > "$APP_DIR/.env" << 'EOF'
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
        warn "Please edit $APP_DIR/.env with your actual values!"
    fi

    # Setup nginx
    info "Configuring nginx reverse proxy..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

    if [ -f "$PROJECT_DIR/nginx.conf" ]; then
        cp "$PROJECT_DIR/nginx.conf" /etc/nginx/sites-available/rolereactor
    else
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
    fi

    ln -sf /etc/nginx/sites-available/rolereactor /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        success "nginx configured: $DOMAIN → localhost:3030"
    else
        warn "nginx config test failed"
    fi

    # Setup SSL
    info "Setting up SSL certificate..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" || warn "SSL setup failed — run certbot manually"

    # Start bot with PM2
    info "Starting bot with PM2..."
    cd "$APP_DIR"
    pm2 start ecosystem.config.cjs --env production
    pm2 save
    success "Bot started"

    # PM2 startup on boot
    info "Configuring PM2 to start on boot..."
    pm2 startup systemd -u root --hp /root | tail -1 | bash || warn "PM2 startup configured — reboot to verify"
    success "PM2 startup configured"

    # Firewall
    info "Configuring firewall..."
    if command -v ufw &> /dev/null; then
        ufw allow 'Nginx Full'
        ufw allow 22/tcp
        ufw --force enable
        success "Firewall configured"
    else
        warn "UFW not installed — ensure ports 80, 443, 22 are open"
    fi

    # Show status
    sleep 2
    pm2 status

    echo ""
    echo "╭─────────────────────────────────────────────────────────────╮"
    echo "│                    Setup Complete!                         │"
    echo "│  URL:   https://$DOMAIN                                   │"
    echo "│  Dir:   $APP_DIR                                          │"
    echo "│  Bot:   pm2 status                                        │"
    echo "│  Logs:  pm2 logs role-reactor-bot                         │"
    echo "╰─────────────────────────────────────────────────────────────╯"
    echo ""
    echo "Next steps:"
    echo "  1. Edit $APP_DIR/.env with your actual tokens"
    echo "  2. Restart: pm2 restart role-reactor-bot"
    echo "  3. Logs: pm2 logs role-reactor-bot"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)  show_usage; exit 0 ;;
        *) error "Unknown option: $1"; show_usage; exit 1 ;;
    esac
done

setup
