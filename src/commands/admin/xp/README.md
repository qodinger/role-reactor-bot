# XP Command

## Overview

The XP command allows administrators to configure and manage the XP system for their server using subcommands.

## File Structure

```
xp/
├── index.js          # Main command definition and entry point
├── handlers.js       # Core logic and interaction handling
├── embeds.js         # Discord embed creation
├── components.js     # UI components (buttons, etc.)
├── utils.js          # Utility functions and helpers
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by other admin commands:

- **`index.js`**: Command definition with subcommands, permission validation, and main execution flow
- **`handlers.js`**: Core business logic for setup and settings subcommands
- **`embeds.js`**: Discord embed creation and formatting
- **`components.js`**: Interactive UI components (buttons, select menus)
- **`utils.js`**: Helper functions, validation, and logging utilities

## Subcommands

### `/xp setup`

Configure the XP system with various options:

- `enabled` - Enable or disable the XP system
- `message-xp` - Enable XP for sending messages
- `command-xp` - Enable XP for using commands
- `role-xp` - Enable XP for role assignments

### `/xp settings`

View and manage the XP system settings with interactive buttons.

## Key Features

- Subcommand-based configuration
- Interactive buttons for enabling/disabling XP features
- Real-time settings display
- Permission-based access control
- Comprehensive error handling

## Usage

```
/xp setup enabled:true message-xp:true command-xp:true role-xp:true
/xp settings
```

## Permissions Required

- `ManageGuild` permission
- Admin role or equivalent

## Dependencies

- Discord.js
- Database manager for guild settings
- Theme configuration for colors and emojis
- Permission validation utilities
