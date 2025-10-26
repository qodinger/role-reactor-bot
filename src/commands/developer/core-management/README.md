# Core Management Command

A developer-only command for managing user bonus Cores (donation Cores) in the Role Reactor Discord Bot.

## File Structure

```
src/commands/developer/core-management/
├── index.js          # Command definition and structure
├── handlers.js       # Main command execution logic
├── embeds.js         # Embed creation functions
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by other commands:

- **`index.js`**: Command definition, subcommands, and main execution flow
- **`handlers.js`**: Core business logic, bonus core management, and interaction processing
- **`embeds.js`**: Discord embed creation and formatting

## Usage Examples

```
/core-management add user:@username amount:100 reason:Compensation for bug report
/core-management remove user:@username amount:50 reason:Refund for failed generation
/core-management set user:@username amount:500 reason:Account migration
/core-management view user:@username
/core-management add-donation user:@username amount:5 ko-fi-url:https://ko-fi.com/s/abc123
```

## Permissions Required

- Developer role permissions
- Server-only command (not available in DMs)

## Available Options

- **add** (subcommand): Add bonus Cores (donation Cores only)
- **remove** (subcommand): Remove bonus Cores (donation Cores only)
- **set** (subcommand): Set bonus Cores (donation Cores only, not subscription Cores)
- **view** (subcommand): View a user's Core information and breakdown
- **add-donation** (subcommand): Verify a Ko-fi donation and grant bonus Cores

## Key Features

- Bonus core management (donation cores only)
- Ko-fi donation verification
- Comprehensive audit logging
- Rich embed displays
- Total balance impact tracking
- Simple and official design

## Dependencies

- Discord.js
- Storage manager for data persistence
- Theme configuration for colors and styling
- Ko-fi integration for donation verification
