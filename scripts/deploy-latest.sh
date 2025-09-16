#!/bin/bash

# Role Reactor Bot - Latest Version Deployment Script
# This script ensures the latest version is always deployed correctly

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to get current version from package.json
get_current_version() {
    if [ -f "package.json" ]; then
        grep -o '"version": *"[^"]*"' package.json | grep -o '"[^"]*"$' | tr -d '"'
    else
        print_error "package.json not found!"
        exit 1
    fi
}

# Function to display banner
show_banner() {
    echo ""
    echo "╭─────────────────────────────────────────────────────────────╮"
    echo "│           Role Reactor Bot - Latest Deployment             │"
    echo "╰─────────────────────────────────────────────────────────────╯"
    echo ""
}

# Main deployment function
deploy_latest() {
    show_banner
    
    # Check if docker is running
    check_docker
    
    # Get current version
    CURRENT_VERSION=$(get_current_version)
    print_status "Current version: $CURRENT_VERSION"
    
    # Step 1: Pull latest changes from repository
    print_status "Pulling latest changes from repository..."
    git fetch --all --tags
    git pull origin main
    
    # Get version after pull
    NEW_VERSION=$(get_current_version)
    print_status "Repository version: $NEW_VERSION"
    
    # Step 2: Stop and remove existing containers
    print_status "Stopping existing containers..."
    docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
    docker stop role-reactor-bot 2>/dev/null || true
    docker rm role-reactor-bot 2>/dev/null || true
    
    # Step 3: Complete Docker cleanup to avoid caching issues
    print_status "Cleaning Docker cache and images..."
    
    # Remove all role-reactor-bot related images
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}" | grep role-reactor | while read image id; do
        print_status "Removing image: $image"
        docker rmi "$id" --force 2>/dev/null || true
    done
    
    # Clean build cache
    docker builder prune -f 2>/dev/null || true
    
    # Step 4: Verify we're using the latest code
    print_status "Verifying latest code is available..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found! Make sure you're in the correct directory."
        exit 1
    fi
    
    if [ ! -f "docker-compose.prod.yml" ]; then
        print_error "docker-compose.prod.yml not found!"
        exit 1
    fi
    
    # Step 5: Build fresh image with latest code
    print_status "Building fresh Docker image (version: $NEW_VERSION)..."
    docker-compose -f docker-compose.prod.yml build --no-cache --pull
    
    # Step 6: Verify the image contains the correct version
    print_status "Verifying image version..."
    DOCKER_VERSION=$(docker run --rm --entrypoint="" role-reactor-bot_role-reactor-bot cat package.json | grep -o '"version": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' 2>/dev/null || echo "unknown")
    
    if [ "$DOCKER_VERSION" != "$NEW_VERSION" ]; then
        print_warning "Version mismatch detected! Docker: $DOCKER_VERSION, Expected: $NEW_VERSION"
        print_status "Rebuilding with absolute no-cache..."
        docker system prune -f
        docker-compose -f docker-compose.prod.yml build --no-cache --pull
        DOCKER_VERSION=$(docker run --rm --entrypoint="" role-reactor-bot_role-reactor-bot cat package.json | grep -o '"version": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' 2>/dev/null || echo "unknown")
    fi
    
    print_success "Docker image version: $DOCKER_VERSION"
    
    # Step 7: Start the new container
    print_status "Starting new container..."
    docker-compose -f docker-compose.prod.yml up -d
    
    # Step 8: Wait for container to be ready
    print_status "Waiting for container to start..."
    sleep 5
    
    # Step 9: Verify deployment
    print_status "Verifying deployment..."
    
    # Check if container is running
    if docker ps | grep -q "role-reactor-bot"; then
        # Verify version inside running container
        RUNNING_VERSION=$(docker exec role-reactor-bot cat package.json | grep -o '"version": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' 2>/dev/null || echo "unknown")
        
        if [ "$RUNNING_VERSION" = "$NEW_VERSION" ]; then
            print_success "Deployment successful!"
            print_success "Running version: $RUNNING_VERSION"
            
            # Show container status
            print_status "Container status:"
            docker ps | grep role-reactor-bot
            
            # Show recent logs
            print_status "Recent logs:"
            docker logs role-reactor-bot --tail 10 2>/dev/null || true
            
        else
            print_error "Version mismatch! Expected: $NEW_VERSION, Running: $RUNNING_VERSION"
            exit 1
        fi
    else
        print_error "Container is not running!"
        print_status "Checking logs for errors..."
        docker logs role-reactor-bot --tail 20 2>/dev/null || true
        exit 1
    fi
    
    # Step 10: Final health check
    print_status "Performing health check..."
    sleep 10  # Give the bot time to fully initialize
    
    if docker ps | grep -q "role-reactor-bot.*healthy\|role-reactor-bot.*health: starting"; then
        print_success "Health check passed! Bot is running correctly."
    else
        print_warning "Health check shows issues. Check logs for details."
        docker logs role-reactor-bot --tail 30
    fi
    
    echo ""
    echo "╭─────────────────────────────────────────────────────────────╮"
    echo "│                 Deployment Complete!                       │"
    echo "│                                                             │"
    echo "│  Version: $NEW_VERSION"
    echo "│  Status:  Running                                           │"
    echo "│                                                             │"
    echo "│  Use 'docker logs role-reactor-bot -f' to view live logs   │"
    echo "│  Use 'docker ps' to check container status                 │"
    echo "╰─────────────────────────────────────────────────────────────╯"
    echo ""
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --verbose  Enable verbose output"
    echo "  --force        Force deployment even if no changes detected"
    echo ""
    echo "This script will:"
    echo "  1. Pull the latest code from the repository"
    echo "  2. Stop existing containers"
    echo "  3. Clean Docker cache to avoid version issues"
    echo "  4. Build fresh Docker image"
    echo "  5. Deploy and verify the new version"
}

# Parse command line arguments
VERBOSE=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            set -x  # Enable bash debug mode
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run the deployment
deploy_latest
