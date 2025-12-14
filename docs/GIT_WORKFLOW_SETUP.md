# Git Workflow Setup Guide

Quick setup guide for using the Git workflow helpers.

## Setup Git Helpers

### Option 1: Source in Current Session

```bash
source scripts/git-helpers.sh
```

### Option 2: Add to Shell Profile (Permanent)

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Git workflow helpers for role-reactor-bot
if [ -f "/path/to/role-reactor-bot/scripts/git-helpers.sh" ]; then
    source /path/to/role-reactor-bot/scripts/git-helpers.sh
fi
```

Or use a relative path from your home directory:

```bash
# If project is in ~/dev/projects/discord-bots/role-reactor-bot
if [ -f "$HOME/dev/projects/discord-bots/role-reactor-bot/scripts/git-helpers.sh" ]; then
    source "$HOME/dev/projects/discord-bots/role-reactor-bot/scripts/git-helpers.sh"
fi
```

After adding, reload your shell:

```bash
source ~/.bashrc  # or ~/.zshrc
```

## Verify Setup

```bash
git-workflow-help
```

You should see a list of available commands.

## Quick Start Examples

### Starting a New Feature

```bash
git-feature userinfo-serverinfo
# Creates and switches to: feature/userinfo-serverinfo
```

### Finishing a Feature

```bash
git-finish-feature
# Merges current feature branch to dev and cleans up
```

### Starting a Fix

```bash
git-fix help-patterns
# Creates and switches to: fix/help-patterns
```

### Starting a Hotfix

```bash
git-hotfix deployment-issue
# Creates and switches to: hotfix/deployment-issue
```

## Available Commands

See [Git Workflow Guide](./GIT_WORKFLOW.md) for full documentation.

### Feature Commands

- `git-feature <name>` - Create feature branch
- `git-finish-feature` - Merge to dev and cleanup

### Fix Commands

- `git-fix <name>` - Create fix branch
- `git-finish-fix` - Merge to main and cleanup

### Hotfix Commands

- `git-hotfix <name>` - Create hotfix branch
- `git-finish-hotfix` - Merge to main and dev

### Utility Commands

- `git-sync-main` - Sync current branch with main
- `git-sync-dev` - Sync current branch with dev
- `git-status-branches` - Show branch status
- `git-cleanup` - Clean up merged branches
- `git-workflow-help` - Show help

## Troubleshooting

### Command Not Found

If you get "command not found":

1. Make sure you've sourced the script: `source scripts/git-helpers.sh`
2. Check the script is executable: `chmod +x scripts/git-helpers.sh`
3. Verify the path is correct in your shell profile

### Permission Denied

```bash
chmod +x scripts/git-helpers.sh
```

### Script Not Working

Check if you're in the project directory:

```bash
pwd  # Should show path to role-reactor-bot
```
