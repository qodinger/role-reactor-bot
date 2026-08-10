#!/bin/bash

# Role Reactor Bot - PM2 Deployment Script
# Pulls latest code and restarts the bot

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

show_banner() {
    echo ""
    echo "╭─────────────────────────────────────────────────────────────╮"
    echo "│           Role Reactor Bot - PM2 Deployment                │"
    echo "╰─────────────────────────────────────────────────────────────╯"
    echo ""
}

show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --verbose  Enable verbose output"
    echo ""
    echo "This script will:"
    echo "  1. Pull the latest code from the repository"
    echo "  2. Install new dependencies"
    echo "  3. Restart the bot with zero downtime"
}

deploy() {
    show_banner

    cd "$APP_DIR" || { error "Cannot access $APP_DIR"; exit 1; }

    # Pull latest code
    info "Pulling latest changes..."
    git pull origin main

    # Install dependencies
    info "Installing dependencies..."
    pnpm install --prod

    # Check PM2 startup config
    info "Checking PM2 startup..."
    if ! pm2 startup 2>/dev/null | grep -q "already"; then
        warn "PM2 startup not configured. Run 'pm2 startup' once on the VPS, then 'pm2 save'."
    fi

    # Setup log rotation
    info "Checking log rotation..."
    if ! pm2 list 2>/dev/null | grep -q "pm2-logrotate"; then
        info "Installing pm2-logrotate..."
        pm2 install pm2-logrotate
        pm2 set pm2-logrotate:max_size 10M
        pm2 set pm2-logrotate:retain 7
        pm2 set pm2-logrotate:compress true
        success "Log rotation configured"
    else
        success "Log rotation already active"
    fi

    # Restart bot
    info "Restarting bot..."
    pm2 reload role-reactor-bot --update-env
    pm2 save

    sleep 2
    pm2 status

    echo ""
    echo "╭─────────────────────────────────────────────────────────────╮"
    echo "│                 Deployment Complete!                       │"
    echo "│  Logs:    pm2 logs role-reactor-bot                       │"
    echo "│  Status:  pm2 status                                      │"
    echo "╰─────────────────────────────────────────────────────────────╯"
    echo ""
}

# Parse arguments
VERBOSE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)  show_usage; exit 0 ;;
        -v|--verbose) VERBOSE=true; set -x; shift ;;
        *) error "Unknown option: $1"; show_usage; exit 1 ;;
    esac
done

deploy
