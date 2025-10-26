# XP Command

## Overview

The XP command allows administrators to configure and manage the XP system for their server with a simplified, single-command interface.

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

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic for XP system management
- **`embeds.js`**: Discord embed creation and formatting
- **`components.js`**: Interactive UI components (buttons, select menus)
- **`utils.js`**: Helper functions, validation, and logging utilities

## Command Usage

### `/xp`

A simplified single command that displays current XP system settings and provides interactive buttons for configuration.

**Features:**

- **Real-time settings display** - Shows current XP configuration
- **Interactive configuration** - Use buttons to enable/disable features
- **Level-up management** - Configure level-up messages and channels
- **XP source configuration** - Manage different XP sources (messages, commands, roles, voice)
- **Permission-based access** - Only administrators can configure

## Key Features

- **Simplified interface** - Single command instead of multiple subcommands
- **Interactive buttons** - Easy configuration through Discord UI
- **Real-time settings display** - See current configuration at a glance
- **Permission-based access control** - Secure admin-only access
- **Comprehensive error handling** - Graceful error recovery
- **Database integration** - Persistent settings storage

## Usage

```
/xp
```

The command will display current XP settings with interactive buttons for:

- **Configure** - General XP system configuration
- **Level-Up Messages** - Configure level-up notifications
- **Enable/Disable** - Toggle XP system on/off
- **XP Sources** - Configure different XP earning methods

## Permissions Required

- `ManageGuild` permission
- Admin role or equivalent

## Dependencies

- Discord.js
- Database manager for guild settings
- Theme configuration for colors and emojis
- Permission validation utilities
