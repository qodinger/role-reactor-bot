# Core Management Command

## Overview

A developer-only command for managing user bonus Cores in the Role Reactor Discord Bot.

## File Structure

```
core-management/
├── index.js          # Command definition and structure
├── handlers.js       # Main command execution logic
├── embeds.js         # Embed creation functions
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by other developer commands:

- **`index.js`**: Command definition, subcommands, and main execution flow
- **`handlers.js`**: Core business logic, bonus core management, and interaction processing
- **`embeds.js`**: Discord embed creation and formatting

## Subcommands

- **`/core-management add`**: Add bonus Cores
  - Options: `user` (required), `amount` (required), `reason` (required)
- **`/core-management remove`**: Remove bonus Cores
  - Options: `user` (required), `amount` (required), `reason` (required)
- **`/core-management set`**: Set bonus Cores (not subscription Cores)
  - Options: `user` (required), `amount` (required), `reason` (required)
- **`/core-management view`**: View a user's Core information and breakdown
  - Options: `user` (required)

## Usage Examples

```
/core-management add user:@username amount:100 reason:Compensation for bug report
/core-management remove user:@username amount:50 reason:Refund for failed generation
/core-management set user:@username amount:500 reason:Account migration
/core-management view user:@username
```

## Permissions Required

- Developer role permissions
- Server-only command (not available in DMs)

## Key Features

- **Bonus core management** - Manage bonus Cores for users
- **Comprehensive audit logging** - Track all Core management operations
- **Rich embed displays** - Clear visual representation of Core information
- **Total balance impact tracking** - Shows how operations affect total balance
- **Simple and official design** - Clean, professional interface

## Available Options

- **add** (subcommand): Add bonus Cores
- **remove** (subcommand): Remove bonus Cores
- **set** (subcommand): Set bonus Cores (not subscription Cores)
- **view** (subcommand): View a user's Core information and breakdown

## Dependencies

- Discord.js
- Storage manager for data persistence
- Theme configuration for colors and styling
