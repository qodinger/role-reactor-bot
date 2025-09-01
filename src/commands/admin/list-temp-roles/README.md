# List Temporary Roles Command

## Overview

The List Temporary Roles command allows administrators to view all active temporary roles in the server or check temporary roles for a specific user.

## File Structure

```
list-temp-roles/
├── index.js          # Main command definition and entry point
├── handlers.js       # Core logic and interaction handling
├── embeds.js         # Discord embed creation
├── utils.js          # Utility functions and helpers
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by the `schedule-role` command:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, data retrieval, and error handling
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, validation, and logging utilities

## Key Features

- List all active temporary roles in the server
- Check temporary roles for a specific user
- Display expiration times in human-readable format
- Group roles by user for better organization
- Filter out expired roles automatically
- Comprehensive error handling and user feedback

## Usage

```
/list-temp-roles                    # List all temporary roles
/list-temp-roles user:@username     # List roles for specific user
```

## Permissions Required

- `ManageRoles` permission
- Administrator role or equivalent

## Display Information

- **User-specific view**: Shows roles for a single user
- **Server-wide view**: Groups roles by user
- **Role details**: Name, color, and time remaining
- **Expiration info**: Human-readable time format
- **Management tips**: How to manage temporary roles

## Time Formatting

- **Weeks**: "2 weeks", "1 week"
- **Days**: "3 days", "1 day"
- **Hours**: "5 hours", "1 hour"
- **Minutes**: "30 minutes", "1 minute"
- **Expired**: Automatically filtered out

## Process

1. Validates user and bot permissions
2. Retrieves temporary roles from database
3. Filters out expired roles
4. Fetches user and role information
5. Calculates time remaining for each role
6. Groups and formats data for display
7. Creates organized embed with results

## Dependencies

- Discord.js
- Temporary roles utility for data retrieval
- Permission validation utilities
- Response message utilities for embeds
- Theme configuration for colors and styling

## Error Handling

- Missing bot permissions
- Database connection issues
- No temporary roles found
- User not found or inaccessible
- Role information retrieval failures
- Network/API errors

## Related Commands

- `/assign-temp-role` - Create temporary roles
- `/remove-temp-role` - Remove temporary roles early
- `/schedule-role` - Schedule future role assignments
