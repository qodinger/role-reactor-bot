#!/bin/bash

# Docker Startup Script for Role Reactor Bot
# Ensures proper initialization in containerized environments

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

# Check if we're in a Docker container
if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup; then
    info "Docker environment detected"
    export DOCKER_ENV=true
else
    warn "Not running in Docker, but continuing..."
fi

# Ensure proper permissions for mounted volumes
info "Setting up permissions..."
if [ -d "/usr/src/app/data" ]; then
    if [ -w "/usr/src/app/data" ]; then
        chmod -R 755 /usr/src/app/data 2>/dev/null || warn "Could not set data directory permissions (normal for non-root containers)"
    fi
fi

if [ -d "/usr/src/app/logs" ]; then
    if [ -w "/usr/src/app/logs" ]; then
        chmod -R 755 /usr/src/app/logs 2>/dev/null || warn "Could not set logs directory permissions (normal for non-root containers)"
    fi
fi

# Check environment variables
info "Checking environment..."
if [ -z "$DISCORD_TOKEN" ]; then
    error "DISCORD_TOKEN is not set!"
    exit 1
fi

if [ -z "$DISCORD_CLIENT_ID" ]; then
    error "DISCORD_CLIENT_ID is not set!"
    exit 1
fi

if [ -z "$NODE_ENV" ]; then
    warn "NODE_ENV not set, defaulting to production"
    export NODE_ENV=production
fi

success "Environment check passed"

# Start the bot
info "Starting Role Reactor Bot..."
exec node src/index.js
