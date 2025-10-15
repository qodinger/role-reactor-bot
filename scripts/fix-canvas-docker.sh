#!/bin/bash

# Fix Canvas in Docker - Rebuild with proper dependencies
echo "🔧 Fixing Canvas in Docker..."

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Remove old image to force rebuild
echo "🗑️ Removing old image..."
docker rmi role-reactor-bot 2>/dev/null || true

# Clean up build cache
echo "🧹 Cleaning build cache..."
docker builder prune -f

# Rebuild with no cache to ensure fresh build
echo "🔨 Rebuilding Docker image with Canvas dependencies..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Start the container
echo "🚀 Starting container..."
docker-compose -f docker-compose.prod.yml up -d

# Show logs
echo "📋 Container logs:"
docker-compose -f docker-compose.prod.yml logs -f --tail=50
