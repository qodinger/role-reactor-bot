#!/bin/bash

# Start Bot Script - Safely starts the bot after ensuring no other instances are running
# Usage: ./scripts/start-bot.sh

echo "🚀 Starting Role Reactor Bot..."

# First, stop any existing instances
echo "🛑 Checking for existing bot instances..."
EXISTING=$(ps aux | grep -E "(node src/index.js|nodemon)" | grep -v grep | wc -l)

if [ "$EXISTING" -gt 0 ]; then
    echo "⚠️  Found $EXISTING existing bot processes. Stopping them first..."
    ./scripts/stop-bot.sh
    sleep 3
fi

# Verify no processes are running
REMAINING=$(ps aux | grep -E "(node src/index.js|nodemon)" | grep -v grep | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo "❌ Failed to stop existing processes. Please run ./scripts/stop-bot.sh manually."
    exit 1
fi

echo "✅ No existing bot instances found. Starting fresh..."

# Start the bot
echo "🎯 Starting bot with nodemon..."
npm run dev
