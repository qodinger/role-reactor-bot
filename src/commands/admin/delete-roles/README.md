# Delete Roles Command

## Overview

The Delete Roles command allows administrators to remove role-reaction messages and their associated role mappings from the server.

## File Structure

```
delete-roles/
├── index.js          # Main command definition and entry point
├── handlers.js       # Core logic and interaction handling
├── utils.js          # Utility functions and helpers
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by the `schedule-role` command:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, role mapping removal, and error handling
- **`utils.js`**: Helper functions, validation, and logging utilities

## Key Features

- Delete role-reaction messages by message ID
- Remove role mappings from storage
- Validate message ID format and existence
- Comprehensive error handling and user feedback
- Permission-based access control
- Logging of deletion activities

## Usage

```
/delete-roles message_id:1234567890123456789
```

## Permissions Required

- `ManageRoles` permission
- Administrator role or equivalent

## Process

1. Validates message ID format
2. Checks if role mapping exists
3. Attempts to fetch and delete the message
4. Removes role mapping from storage
5. Provides feedback on success/failure

## Dependencies

- Discord.js
- Role mapping manager for storage operations
- Permission validation utilities
- Response message utilities for embeds

## Error Handling

- Invalid message ID format
- Message not found in server
- Permission issues
- Network/API errors
