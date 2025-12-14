#!/bin/bash

# Git Workflow Helper Scripts
# Usage: source scripts/git-helpers.sh (or add to your .bashrc/.zshrc)

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Start a new feature branch
git-feature() {
    if [ -z "$1" ]; then
        echo "Usage: git-feature <feature-name>"
        echo "Example: git-feature userinfo-serverinfo"
        return 1
    fi
    
    local feature_name="feature/$1"
    
    echo -e "${BLUE}Starting feature: $feature_name${NC}"
    git checkout dev 2>/dev/null || git checkout main
    git pull origin dev 2>/dev/null || git pull origin main
    git checkout -b "$feature_name"
    echo -e "${GREEN}Created and switched to: $feature_name${NC}"
}

# Start a new fix branch
git-fix() {
    if [ -z "$1" ]; then
        echo "Usage: git-fix <fix-name>"
        echo "Example: git-fix help-patterns"
        return 1
    fi
    
    local fix_name="fix/$1"
    
    echo -e "${BLUE}Starting fix: $fix_name${NC}"
    git checkout main
    git pull origin main
    git checkout -b "$fix_name"
    echo -e "${GREEN}Created and switched to: $fix_name${NC}"
}

# Start a new hotfix branch
git-hotfix() {
    if [ -z "$1" ]; then
        echo "Usage: git-hotfix <hotfix-name>"
        echo "Example: git-hotfix deployment-issue"
        return 1
    fi
    
    local hotfix_name="hotfix/$1"
    
    echo -e "${YELLOW}Starting hotfix: $hotfix_name${NC}"
    git checkout main
    git pull origin main
    git checkout -b "$hotfix_name"
    echo -e "${GREEN}Created and switched to: $hotfix_name${NC}"
}

# Finish a feature (merge to dev)
git-finish-feature() {
    local current_branch=$(git branch --show-current)
    
    if [[ ! "$current_branch" =~ ^feature/ ]]; then
        echo -e "${YELLOW}Warning: Not on a feature branch${NC}"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
    fi
    
    echo -e "${BLUE}Finishing feature: $current_branch${NC}"
    git checkout dev
    git pull origin dev
    git merge "$current_branch"
    git push origin dev
    echo -e "${GREEN}Merged $current_branch to dev${NC}"
    
    read -p "Delete branch $current_branch? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git branch -d "$current_branch"
        git push origin --delete "$current_branch" 2>/dev/null
        echo -e "${GREEN}Deleted branch: $current_branch${NC}"
    fi
}

# Finish a fix (merge to main)
git-finish-fix() {
    local current_branch=$(git branch --show-current)
    
    if [[ ! "$current_branch" =~ ^fix/ ]]; then
        echo -e "${YELLOW}Warning: Not on a fix branch${NC}"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
    fi
    
    echo -e "${BLUE}Finishing fix: $current_branch${NC}"
    git checkout main
    git pull origin main
    git merge "$current_branch"
    git push origin main
    echo -e "${GREEN}Merged $current_branch to main${NC}"
    
    # Also merge to dev
    read -p "Also merge to dev? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout dev
        git pull origin dev
        git merge "$current_branch"
        git push origin dev
        echo -e "${GREEN}Merged $current_branch to dev${NC}"
    fi
    
    read -p "Delete branch $current_branch? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git branch -d "$current_branch"
        git push origin --delete "$current_branch" 2>/dev/null
        echo -e "${GREEN}Deleted branch: $current_branch${NC}"
    fi
}

# Finish a hotfix (merge to main and dev)
git-finish-hotfix() {
    local current_branch=$(git branch --show-current)
    
    if [[ ! "$current_branch" =~ ^hotfix/ ]]; then
        echo -e "${YELLOW}Warning: Not on a hotfix branch${NC}"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
    fi
    
    echo -e "${YELLOW}Finishing hotfix: $current_branch${NC}"
    
    # Merge to main
    git checkout main
    git pull origin main
    git merge "$current_branch"
    git push origin main
    echo -e "${GREEN}Merged $current_branch to main${NC}"
    
    # Merge to dev
    git checkout dev
    git pull origin dev
    git merge "$current_branch"
    git push origin dev
    echo -e "${GREEN}Merged $current_branch to dev${NC}"
    
    read -p "Delete branch $current_branch? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git branch -d "$current_branch"
        git push origin --delete "$current_branch" 2>/dev/null
        echo -e "${GREEN}Deleted branch: $current_branch${NC}"
    fi
}

# Sync current branch with main
git-sync-main() {
    local current_branch=$(git branch --show-current)
    echo -e "${BLUE}Syncing $current_branch with main${NC}"
    git fetch origin
    git merge origin/main
    echo -e "${GREEN}Synced with main${NC}"
}

# Sync current branch with dev
git-sync-dev() {
    local current_branch=$(git branch --show-current)
    echo -e "${BLUE}Syncing $current_branch with dev${NC}"
    git fetch origin
    git merge origin/dev
    echo -e "${GREEN}Synced with dev${NC}"
}

# Show branch status
git-status-branches() {
    echo -e "${BLUE}Branch Status:${NC}"
    echo ""
    echo -e "${GREEN}Current branch:${NC} $(git branch --show-current)"
    echo ""
    echo -e "${GREEN}Local branches:${NC}"
    git branch
    echo ""
    echo -e "${GREEN}Remote branches:${NC}"
    git branch -r
}

# Clean up merged branches
git-cleanup() {
    echo -e "${BLUE}Cleaning up merged branches...${NC}"
    git fetch --prune
    git branch --merged | grep -v "\*\|main\|dev" | xargs -n 1 git branch -d 2>/dev/null
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Show help
git-workflow-help() {
    echo -e "${BLUE}Git Workflow Helper Commands:${NC}"
    echo ""
    echo -e "${GREEN}Feature branches:${NC}"
    echo "  git-feature <name>          - Create and switch to feature branch"
    echo "  git-finish-feature          - Merge feature to dev and cleanup"
    echo ""
    echo -e "${GREEN}Fix branches:${NC}"
    echo "  git-fix <name>              - Create and switch to fix branch"
    echo "  git-finish-fix              - Merge fix to main and cleanup"
    echo ""
    echo -e "${GREEN}Hotfix branches:${NC}"
    echo "  git-hotfix <name>           - Create and switch to hotfix branch"
    echo "  git-finish-hotfix           - Merge hotfix to main and dev"
    echo ""
    echo -e "${GREEN}Sync branches:${NC}"
    echo "  git-sync-main               - Sync current branch with main"
    echo "  git-sync-dev                - Sync current branch with dev"
    echo ""
    echo -e "${GREEN}Utilities:${NC}"
    echo "  git-status-branches         - Show branch status"
    echo "  git-cleanup                 - Clean up merged branches"
    echo "  git-workflow-help           - Show this help"
}

