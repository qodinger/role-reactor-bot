#!/bin/bash

# Role Reactor Bot - Docker Deployment Script
# Pulls latest code, builds fresh image, and deploys

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

show_banner() {
    echo ""
    echo "╭─────────────────────────────────────────────────────────────╮"
    echo "│           Role Reactor Bot - Docker Deployment             │"
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
    echo "  2. Stop existing containers"
    echo "  3. Clean Docker cache"
    echo "  4. Build fresh Docker image"
    echo "  5. Deploy and verify the new version"
}

check_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

get_version() {
    if [ -f "package.json" ]; then
        grep -o '"version": *"[^"]*"' package.json | grep -o '"[^"]*"$' | tr -d '"'
    else
        error "package.json not found!"
        exit 1
    fi
}

deploy() {
    show_banner
    check_docker

    CURRENT_VERSION=$(get_version)
    info "Current version: $CURRENT_VERSION"

    # Pull latest code
    info "Pulling latest changes..."
    git fetch --all --tags --force
    git pull origin main

    NEW_VERSION=$(get_version)
    info "Repository version: $NEW_VERSION"

    # Stop existing containers
    info "Stopping existing containers..."
    docker compose -f docker-compose.prod.yml down 2>/dev/null || true
    docker stop role-reactor-bot 2>/dev/null || true
    docker rm role-reactor-bot 2>/dev/null || true

    # Clean old images
    info "Cleaning Docker cache..."
    docker images --format "{{.Repository}}:{{.Tag}}\t{{.ID}}" | grep role-reactor | while read image id; do
        docker rmi "$id" --force 2>/dev/null || true
    done
    docker builder prune -f --filter "until=24h" 2>/dev/null || true

    # Verify files exist
    if [ ! -f "docker-compose.prod.yml" ]; then
        error "docker-compose.prod.yml not found!"
        exit 1
    fi

    # Build fresh image
    info "Building Docker image (version: $NEW_VERSION)..."
    docker compose -f docker-compose.prod.yml build --pull

    # Verify image version
    info "Verifying image version..."
    IMAGE_NAME=$(docker compose -f docker-compose.prod.yml images -q role-reactor-bot 2>/dev/null | head -1)
    if [ -n "$IMAGE_NAME" ]; then
        DOCKER_VERSION=$(docker run --rm --entrypoint="" "$IMAGE_NAME" node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")
    else
        DOCKER_VERSION="unknown"
    fi

    if [ "$DOCKER_VERSION" != "$NEW_VERSION" ]; then
        error "Version mismatch! Docker: $DOCKER_VERSION, Expected: $NEW_VERSION"
        exit 1
    fi
    success "Docker image version: $DOCKER_VERSION"

    # Setup permissions
    info "Setting up directory permissions..."
    mkdir -p logs data
    chown -R 1001:1001 logs data 2>/dev/null || chmod -R 777 logs data

    # Start container
    info "Starting container..."
    docker compose -f docker-compose.prod.yml up -d

    # Wait and verify
    info "Waiting for container to start..."
    sleep 5

    if docker ps | grep -q "role-reactor-bot"; then
        RUNNING_VERSION=$(docker exec role-reactor-bot node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")
        if [ "$RUNNING_VERSION" = "$NEW_VERSION" ]; then
            success "Deployment successful! Version: $RUNNING_VERSION"
            docker logs role-reactor-bot --tail 10 2>/dev/null || true
        else
            error "Version mismatch! Expected: $NEW_VERSION, Running: $RUNNING_VERSION"
            exit 1
        fi
    else
        error "Container is not running!"
        docker logs role-reactor-bot --tail 20 2>/dev/null || true
        exit 1
    fi

    # Health check
    info "Performing health check..."
    sleep 10
    if docker ps --format '{{.Status}}' | grep -q "healthy\|health: starting"; then
        success "Health check passed!"
    else
        warn "Health check shows issues. Check logs for details."
        docker logs role-reactor-bot --tail 30
    fi

    echo ""
    echo "╭─────────────────────────────────────────────────────────────╮"
    echo "│                 Deployment Complete!                       │"
    echo "│  Version: $NEW_VERSION                                    │"
    echo "│  Status:  Running                                         │"
    echo "│  Logs:    docker logs role-reactor-bot -f                 │"
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
