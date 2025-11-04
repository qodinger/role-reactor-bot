# Core Management Command

## Overview

A developer-only command for managing user bonus Cores (donation Cores) in the Role Reactor Discord Bot.

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

- **`/core-management add`**: Add bonus Cores (donation Cores only)
  - Options: `user` (required), `amount` (required), `reason` (required)
- **`/core-management remove`**: Remove bonus Cores (donation Cores only)
  - Options: `user` (required), `amount` (required), `reason` (required)
- **`/core-management set`**: Set bonus Cores (donation Cores only, not subscription Cores)
  - Options: `user` (required), `amount` (required), `reason` (required)
- **`/core-management view`**: View a user's Core information and breakdown
  - Options: `user` (required)
- **`/core-management add-donation`**: Verify a Ko-fi donation and grant bonus Cores
  - Options: `user` (required), `amount` (required), `ko-fi-url` (required), `reason` (optional)
- **`/core-management cancel-subscription`**: Cancel a user's subscription
  - Options: `user` (required), `reason` (optional)

## Usage Examples

```
/core-management add user:@username amount:100 reason:Compensation for bug report
/core-management remove user:@username amount:50 reason:Refund for failed generation
/core-management set user:@username amount:500 reason:Account migration
/core-management view user:@username
/core-management add-donation user:@username amount:5 ko-fi-url:https://ko-fi.com/s/abc123
/core-management cancel-subscription user:@username reason:User request
```

## Permissions Required

- Developer role permissions
- Server-only command (not available in DMs)

## Key Features

- **Bonus core management** - Donation cores only
- **Ko-fi donation verification** - Verify and grant bonus Cores from Ko-fi donations
- **Comprehensive audit logging** - Track all Core management operations
- **Rich embed displays** - Clear visual representation of Core information
- **Total balance impact tracking** - Shows how operations affect total balance
- **Simple and official design** - Clean, professional interface

## Available Options

- **add** (subcommand): Add bonus Cores (donation Cores only)
- **remove** (subcommand): Remove bonus Cores (donation Cores only)
- **set** (subcommand): Set bonus Cores (donation Cores only, not subscription Cores)
- **view** (subcommand): View a user's Core information and breakdown
- **add-donation** (subcommand): Verify a Ko-fi donation and grant bonus Cores
- **cancel-subscription** (subcommand): Cancel a user's subscription

## Dependencies

- Discord.js
- Storage manager for data persistence
- Theme configuration for colors and styling
- Ko-fi integration for donation verification
