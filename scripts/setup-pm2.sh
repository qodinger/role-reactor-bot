#!/bin/bash

# Role Reactor Bot - PM2 Initial Setup
# Run once on a fresh VPS to install PM2, nginx, and start the bot

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
error()   { echo -e "${RED}[ERROR]${NC} $1"; }

APP_DIR="/root/projects/role-reactor-bot"
BOT_NAME="role-reactor-bot"

show_banner() {
    echo ""
    echo "╭─────────────────────────────────────────────────────────────╮"
    echo "│           Role Reactor Bot - PM2 Initial Setup             │"
    echo "╰─────────────────────────────────────────────────────────────╯"
    echo ""
}

show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo ""
    echo "This script will:"
    echo "  1. Install PM2 globally"
    echo "  2. Configure PM2 to start on boot"
    echo "  3. Start the bot"
    echo "  4. Install and configure nginx reverse proxy"
    echo "  5. Setup SSL with certbot"
}

setup() {
    show_banner

    # Install PM2
    info "Checking PM2 installation..."
    if ! command -v pm2 &> /dev/null; then
        info "Installing PM2..."
        npm install -g pm2
        success "PM2 installed"
    else
        success "PM2 already installed"
    fi

    # Configure PM2 startup
    info "Configuring PM2 startup..."
    pm2 startup

    # Create logs directory
    info "Creating logs directory..."
    mkdir -p "$APP_DIR/logs"

    # Start the bot
    info "Starting bot..."
    cd "$APP_DIR" || { error "Cannot access $APP_DIR"; exit 1; }
    pm2 start ecosystem.config.cjs

    # Save process list
    info "Saving process list..."
    pm2 save

    # Setup log rotation
    info "Setting up log rotation..."
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 7
    pm2 set pm2-logrotate:compress true

    # Install nginx
    info "Installing nginx..."
    if ! command -v nginx &> /dev/null; then
        sudo apt update
        sudo apt install -y nginx
        sudo systemctl enable nginx
        sudo systemctl start nginx
        success "nginx installed"
    else
        success "nginx already installed"
    fi

    # Configure nginx
    info "Configuring nginx reverse proxy..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

    if [ -f "$PROJECT_DIR/nginx.conf" ]; then
        sudo cp "$PROJECT_DIR/nginx.conf" /etc/nginx/sites-available/rolereactor
    else
        sudo cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/rolereactor
    fi

    sudo ln -sf /etc/nginx/sites-available/rolereactor /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default

    if sudo nginx -t 2>/dev/null; then
        sudo systemctl reload nginx
        success "nginx configured: api.rolereactor.xyz → localhost:3030"
    else
        warn "nginx config test failed. Check SSL certificates."
        warn "Run: sudo certbot --nginx -d api.rolereactor.xyz"
    fi

    # Setup SSL
    info "Checking SSL certificates..."
    if [ ! -d "/etc/letsencrypt/live/api.rolereactor.xyz" ]; then
        if command -v certbot &> /dev/null; then
            info "Requesting SSL certificate..."
            sudo certbot --nginx -d api.rolereactor.xyz --non-interactive --agree-tos --email sengphachanh.dev@gmail.com || warn "SSL setup failed — run certbot manually"
        else
            warn "certbot not installed. Run: sudo apt install certbot python3-certbot-nginx"
        fi
    else
        success "SSL certificates already configured"
    fi

    # Show status
    sleep 2
    pm2 status

    echo ""
    echo "╭─────────────────────────────────────────────────────────────╮"
    echo "│                   Setup Complete!                          │"
    echo "│  Bot:     pm2 status                                      │"
    echo "│  nginx:   sudo systemctl status nginx                     │"
    echo "│  Logs:    pm2 logs $BOT_NAME                              │"
    echo "╰─────────────────────────────────────────────────────────────╯"
    echo ""
    echo "Useful commands:"
    echo "  pm2 logs $BOT_NAME              # View bot logs"
    echo "  pm2 restart $BOT_NAME           # Restart bot"
    echo "  pm2 stop $BOT_NAME              # Stop bot"
    echo "  pm2 monit                       # Monitor resources"
    echo "  sudo nginx -t                   # Test nginx config"
    echo "  sudo systemctl reload nginx     # Reload nginx"
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
