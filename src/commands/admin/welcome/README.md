# Welcome Command

## Overview

The Welcome command lets administrators configure and manage the welcome message system for new members joining the server.

## File Structure

```
welcome/
├── index.js              # Command definition, subcommands, entry point
├── handlers.js           # Main command handlers (setup/settings)
├── embeds.js             # Discord embed creation for settings and configuration
├── components.js         # Interactive components (buttons, select menus)
├── modals.js             # Modal forms for configuration
├── utils.js              # Core utilities and validation
└── README.md             # This documentation
```

## Architecture

Following the modular pattern established by other admin commands:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, database operations, and interaction processing
- **`embeds.js`**: Discord embed creation and formatting
- **`components.js`**: Interactive UI components (buttons, select menus)
- **`modals.js`**: Modal forms for configuration input
- **`utils.js`**: Helper functions, validation, and logging utilities

## Subcommands

- **`/welcome setup`**: Initial configuration of the welcome system
  - Options: `channel` (required), `message` (optional), `auto-role` (optional), `enabled` (optional), `embed` (optional)
- **`/welcome settings`**: View and manage current welcome system settings

## Usage Examples

```
/welcome setup channel:#welcome message:"Welcome {user} to {server}! 🎉" auto-role:@Member
/welcome settings
```

## Permissions Required

- `ManageGuild` permission
- Admin role or equivalent

## Key Features

- Interactive channel and role selection dropdowns
- Custom message configuration with placeholders
- Auto-role assignment for new members
- Test welcome functionality
- Toggle between embed and text formats
- Real-time settings display

## Message Placeholders

- `{user}` - Mentions the user who joined
- `{user.name}` - Username of the user who joined
- `{user.tag}` - Full tag of the user who joined
- `{user.id}` - ID of the user who joined
- `{server}` - Server name
- `{server.id}` - Server ID
- `{memberCount}` - Current member count
- `{memberCount.ordinal}` - Ordinal member count (1st, 2nd, etc.)

## Dependencies

- Discord.js
- Database manager for guild settings
- Theme configuration for colors and emojis
- Permission validation utilities
