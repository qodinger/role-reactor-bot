# List Roles Command

## Overview

The List Roles command allows administrators to view all role-reaction messages set up in their server.

## File Structure

```
list-roles/
├── index.js          # Main command definition and entry point
├── handlers.js       # Core logic and interaction handling
├── embeds.js         # Discord embed creation
├── utils.js          # Utility functions and helpers
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by the `schedule-role` command:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, role mapping retrieval, and error handling
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, role processing, and logging utilities

## Key Features

- List all role-reaction messages in the server
- Display message IDs, channels, and associated roles
- Role count and mention information
- Comprehensive error handling
- Permission-based access control

## Usage

```
/list-roles
```

## Permissions Required

- `ManageRoles` permission
- Administrator role or equivalent

## Output

- Shows count of role-reaction messages
- Lists each message with:
  - Message ID
  - Channel location
  - Number of roles
  - Role mentions

## Dependencies

- Discord.js
- Role mapping manager for retrieving stored mappings
- Permission validation utilities
- Theme configuration for colors and styling
