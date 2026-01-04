#!/bin/bash

# Docker Startup Script for Role Reactor Bot
# This script ensures proper initialization in containerized environments

set -e

echo "🐳 Starting Role Reactor Bot in Docker environment..."

# Check if we're in a Docker container
if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup; then
    echo "✅ Docker environment detected"
    export DOCKER_ENV=true
else
    echo "⚠️ Not running in Docker, but continuing..."
fi

# Ensure proper permissions for mounted volumes
echo "🔐 Setting up permissions..."
if [ -d "/usr/src/app/data" ]; then
    # Only try to change permissions if we have write access
    if [ -w "/usr/src/app/data" ]; then
        chmod -R 755 /usr/src/app/data 2>/dev/null || echo "⚠️ Could not set data directory permissions (this is normal for non-root containers)"
    fi
fi

if [ -d "/usr/src/app/logs" ]; then
    # Only try to change permissions if we have write access
    if [ -w "/usr/src/app/logs" ]; then
        chmod -R 755 /usr/src/app/logs 2>/dev/null || echo "⚠️ Could not set logs directory permissions (this is normal for non-root containers)"
    fi
fi

# Wait for system to stabilize
echo "⏳ Waiting for system stability..."
sleep 2

# Check environment variables
echo "🔍 Checking environment..."
if [ -z "$DISCORD_TOKEN" ]; then
    echo "❌ DISCORD_TOKEN is not set!"
    exit 1
fi

if [ -z "$DISCORD_CLIENT_ID" ]; then
    echo "❌ DISCORD_CLIENT_ID is not set!"
    exit 1
fi

if [ -z "$NODE_ENV" ]; then
    echo "⚠️ NODE_ENV not set, defaulting to production"
    export NODE_ENV=production
fi

echo "✅ Environment check passed"

# Start the bot with proper error handling
echo "🚀 Starting Role Reactor Bot..."
exec node src/index.js
