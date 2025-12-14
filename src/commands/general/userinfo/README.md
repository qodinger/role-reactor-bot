# Userinfo Command

## Overview

Display detailed information about a Discord user, including account details, badges, roles, permissions, and server-specific information.

## File Structure

```
userinfo/
├── index.js          # Command definition and entry point
├── handlers.js       # Main command handlers and user data processing
├── embeds.js         # Discord embed creation and user information display
├── utils.js          # Helper functions for data formatting
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by other general commands:

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core business logic and user data handling
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions for data formatting and validation

## Usage Examples

```
/userinfo
/userinfo user:@username
/userinfo user:123456789012345678
```

## Permissions Required

- `ViewChannel` - Basic permission to view channels

## Key Features

- **Account Information**: Username, display name, tag, ID, bot status
- **Account Age**: Creation date and account age
- **Badges**: Discord badges and special flags (Staff, Partner, HypeSquad, etc.)
- **Server Member Info** (if user is in the server):
  - Join date
  - Nickname
  - Roles (with count)
  - Key permissions
  - Server booster status
  - Timeout status
  - Current voice channel
  - **Warning Count**: Number of warnings the user has received (if any)

## Notes

- If the user is not a member of the server, only basic account information will be shown
- Roles are sorted by position (highest first)
- Permissions are limited to the most important ones to avoid clutter
- The embed automatically truncates long role lists

## Dependencies

- Discord.js
- Theme configuration for colors and styling
- Moderation utilities for warning count retrieval
- Permission validation utilities
