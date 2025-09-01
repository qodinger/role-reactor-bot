# Update Roles Command

## Overview

The Update Roles command allows administrators to modify existing role-reaction messages, including title, description, roles, and color.

## File Structure

```
update-roles/
├── index.js          # Main command definition and entry point
├── handlers.js       # Core logic and interaction handling
├── embeds.js         # Discord embed creation
├── utils.js          # Utility functions and helpers
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by the `schedule-role` command:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, role processing, and update handling
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, validation, and logging utilities

## Key Features

- Update existing role-reaction messages
- Modify title, description, roles, and color
- Validate all input parameters
- Process role changes and update reactions
- Update both message content and storage mapping
- Comprehensive error handling and user feedback

## Usage

```
/update-roles message_id:1234567890123456789 title:"New Title" description:"New Description" roles:"🎮:Gamer,🎨:Artist" color:"#FF6B6B"
```

## Permissions Required

- `ManageRoles` permission
- Administrator role or equivalent

## Updateable Fields

- **title**: Message title
- **description**: Message description
- **roles**: Role list with emojis
- **color**: Embed color (hex format)

## Process

1. Validates message ID format
2. Checks if role mapping exists
3. Processes role updates if provided
4. Validates color format if provided
5. Updates the Discord message
6. Saves updated mapping to storage
7. Provides feedback on changes made

## Dependencies

- Discord.js
- Role mapping manager for storage operations
- Role manager for processing role changes
- Permission validation utilities
- Response message utilities for embeds

## Error Handling

- Invalid message ID format
- Message not found in server
- Role processing errors
- Invalid color format
- Permission issues
- Network/API errors
