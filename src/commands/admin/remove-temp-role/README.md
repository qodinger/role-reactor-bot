# Remove Temporary Role Command

## Overview

The Remove Temporary Role command allows administrators to remove temporary roles from users before they expire naturally.

## File Structure

```
remove-temp-role/
├── index.js          # Main command definition and entry point
├── handlers.js       # Core logic and interaction handling
├── embeds.js         # Discord embed creation
├── utils.js          # Utility functions and helpers
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by the `schedule-role` command:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, role removal, and error handling
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, validation, and logging utilities

## Key Features

- Remove temporary roles from users before expiration
- Validate that the role is actually a temporary role
- Check user permissions and role ownership
- Remove both the Discord role and database record
- Comprehensive error handling and user feedback
- Logging of removal activities

## Usage

```
/remove-temp-role user:@username role:@Moderator reason:"Event ended early"
```

## Permissions Required

- `ManageRoles` permission
- Administrator role or equivalent

## Parameters

- **user**: The user to remove the temporary role from
- **role**: The temporary role to remove
- **reason**: Optional reason for the removal

## Process

1. Validates user and bot permissions
2. Checks if the target user exists in the server
3. Verifies the user has the specified role
4. Validates that it's a temporary role (not expired)
5. Removes the role from the user
6. Removes the temporary role data from storage
7. Provides confirmation and details

## Validation Steps

- **User exists**: Target user must be a server member
- **Role ownership**: User must currently have the role
- **Temporary role**: Role must be a valid temporary role
- **Not expired**: Role must not have already expired
- **Bot permissions**: Bot must have Manage Roles permission

## Dependencies

- Discord.js
- Temporary roles utility for data management
- Permission validation utilities
- Response message utilities for embeds

## Error Handling

- Missing bot permissions
- User not found in server
- User doesn't have the role
- Role is not a temporary role
- Role has already expired
- Permission issues during removal
- Database operation failures

## Related Commands

- `/assign-temp-role` - Create temporary roles
- `/list-temp-roles` - View active temporary roles
- `/schedule-role` - Schedule future role assignments

## Use Cases

- Event roles that need to be removed early
- Temporary moderation roles
- Time-limited access roles
- Testing and development scenarios
