# Setup Welcome Command

## Overview

The Setup Welcome command allows administrators to configure the welcome system for new members joining the server.

## File Structure

```
setup-welcome/
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

- Configure welcome channel for new members
- Set custom welcome messages with placeholders
- Configure automatic role assignment
- Enable/disable welcome system
- Choose between embed and text format
- Interactive buttons for testing and editing
- Comprehensive permission validation

## Usage

```
/setup-welcome channel:#welcome message:"Welcome {user} to {server}!" auto-role:@Member enabled:true embed:true
```

## Permissions Required

- `ManageGuild` permission
- Administrator role or equivalent

## Configuration Options

- **channel**: Required channel for welcome messages
- **message**: Custom welcome message with placeholders
- **auto-role**: Role to automatically assign to new members
- **enabled**: Enable or disable the welcome system
- **embed**: Use embed format for welcome messages

## Placeholders

- `{user}` - Mentions the new member
- `{server}` - Server name
- `{memberCount}` - Current member count

## Dependencies

- Discord.js
- Database manager for welcome settings
- Permission validation utilities
- Input sanitization utilities
- Response message utilities for embeds

## Error Handling

- Missing bot permissions
- Channel permission issues
- Invalid auto-role configuration
- Database connection errors
- Input validation errors
