# XP Settings Command

## Overview

The XP Settings command allows administrators to view and manage the XP system configuration for their server.

## File Structure

```
xp-settings/
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
- **`handlers.js`**: Core business logic, database operations, and interaction processing
- **`embeds.js`**: Discord embed creation and formatting
- **`components.js`**: Interactive UI components (buttons, select menus)
- **`utils.js`**: Helper functions, validation, and logging utilities

## Key Features

- View current XP system configuration
- Interactive buttons for enabling/disabling XP features
- Real-time settings display
- Permission-based access control
- Comprehensive error handling

## Usage

```
/xp-settings
```

## Permissions Required

- `ManageGuild` permission
- Admin role or equivalent

## Dependencies

- Discord.js
- Database manager for guild settings
- Theme configuration for colors and emojis
- Permission validation utilities
