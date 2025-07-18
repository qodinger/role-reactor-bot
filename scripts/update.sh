#!/bin/bash

# Role Reactor Bot Update Script
# This script updates the bot and restarts it safely

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if we're in the bot directory
if [ ! -f "docker-compose.yml" ]; then
    error "Please run this script from the bot directory"
    exit 1
fi

log "Starting bot update..."

# Create backup before update
log "Creating backup..."
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p backups
tar -czf "backups/backup_$DATE.tar.gz" data/ 2>/dev/null || warning "Could not create backup"

# Pull latest changes
log "Pulling latest changes..."
if git pull origin main 2>/dev/null || git pull origin master 2>/dev/null; then
    success "Updated code from repository"
else
    warning "Could not pull latest changes (maybe no internet or no changes)"
fi

# Stop the bot
log "Stopping bot..."
docker-compose down

# Rebuild and start
log "Rebuilding and starting bot..."
docker-compose build --no-cache
docker-compose up -d

# Wait for startup
log "Waiting for bot to start..."
sleep 15

# Check if bot is running
if docker-compose ps | grep -q "Up"; then
    success "Bot updated and running successfully!"
    
    # Show recent logs
    log "Recent logs:"
    docker-compose logs --tail=10
    
    # Clean up old backups (keep last 5)
    log "Cleaning up old backups..."
    ls -t backups/backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
    
else
    error "Bot failed to start after update!"
    log "Attempting to restore from backup..."
    
    # Try to restore from backup
    if [ -f "backups/backup_$DATE.tar.gz" ]; then
        tar -xzf "backups/backup_$DATE.tar.gz"
        docker-compose up -d
        sleep 10
        
        if docker-compose ps | grep -q "Up"; then
            success "Bot restored from backup and running"
        else
            error "Failed to restore from backup. Manual intervention required."
        fi
    else
        error "No backup available. Manual intervention required."
    fi
fi

log "Update process completed" 