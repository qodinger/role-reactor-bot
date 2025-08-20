#!/bin/bash

# Fix permissions for Docker volumes
echo "🔧 Fixing directory permissions for Docker..."

# Create directories if they don't exist
mkdir -p logs data

# Set proper ownership (adjust user:group as needed for your system)
# For macOS/Linux, you might need to use your actual user ID
echo "📁 Setting permissions for logs directory..."
chmod 755 logs
chmod 755 data

# For Docker containers, ensure the directories are writable
echo "🔐 Making directories writable by Docker container..."
chmod 777 logs
chmod 777 data

echo "✅ Permissions fixed!"
echo "📋 You can now rebuild and restart your Docker container:"
echo "   pnpm docker:update"
