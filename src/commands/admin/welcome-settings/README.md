# Welcome Settings Command

## Overview

The Welcome Settings command allows administrators to view and manage the current configuration of the welcome system.

## File Structure

```
welcome-settings/
├── index.js          # Main command definition and entry point
├── handlers.js       # Core logic and interaction handling
├── embeds.js         # Discord embed creation
├── components.js     # UI components (buttons, etc.)
├── utils.js          # Utility functions and helpers
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by the `schedule-role` command:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, database operations, and error handling
- **`embeds.js`**: Discord embed creation and formatting
- **`components.js`**: Interactive UI components (buttons, select menus)
- **`utils.js`**: Helper functions, validation, and logging utilities

## Key Features

- View current welcome system configuration
- Display welcome channel, auto-role, and message settings
- Show available message placeholders
- Interactive buttons for configuration and testing
- Permission-based access control
- Comprehensive error handling

## Usage

```
/welcome-settings
```

## Permissions Required

- `ManageGuild` permission
- Administrator role or equivalent

## Displayed Information

- System status (enabled/disabled)
- Welcome channel configuration
- Message format (embed/text)
- Auto-role assignment
- Custom welcome message
- Available placeholders

## Interactive Components

- **Configure**: Opens welcome system configuration
- **Test Welcome**: Tests the welcome message (if enabled)
- **Toggle**: Enable/disable the system
- **Reset**: Reset to default settings

## Dependencies

- Discord.js
- Database manager for welcome settings
- Permission validation utilities
- Theme configuration for colors and emojis
- Response message utilities for embeds

## Error Handling

- Database connection issues
- Missing welcome settings repository
- Permission validation errors
- Network/API errors
