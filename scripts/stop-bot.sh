#!/bin/bash

# Stop Bot Script - Completely stops all bot instances
# Usage: ./scripts/stop-bot.sh

echo "🛑 Stopping Role Reactor Bot..."

# Kill all bot processes
echo "📋 Killing bot processes..."
pkill -f "node src/index.js" 2>/dev/null
pkill -f "nodemon" 2>/dev/null

# Wait a moment for processes to terminate
sleep 2

# Force kill if any are still running
echo "🔨 Force killing any remaining processes..."
pkill -9 -f "node src/index.js" 2>/dev/null
pkill -9 -f "nodemon" 2>/dev/null

# Check if any processes are still running
REMAINING=$(ps aux | grep -E "(node src/index.js|nodemon)" | grep -v grep | wc -l)

if [ "$REMAINING" -eq 0 ]; then
    echo "✅ All bot instances stopped successfully!"
else
    echo "⚠️  Warning: $REMAINING processes still running:"
    ps aux | grep -E "(node src/index.js|nodemon)" | grep -v grep
    echo "💡 Try running: pkill -9 -f 'node src/index.js'"
fi

# Check ports
echo "🔍 Checking ports..."
lsof -i :3030,3031,3032,3033 | grep node || echo "✅ No bot processes using ports"

echo "🏁 Bot stop complete!"
