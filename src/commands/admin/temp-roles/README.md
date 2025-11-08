# Temp Roles Command

## Overview

The Temp Roles command provides a comprehensive system for managing temporary role assignments that automatically expire after a specified duration. It features a modern, visually appealing interface with rich embeds, smart notifications, and robust error handling.

## File Structure

```
temp-roles/
├── index.js          # Command definition, subcommands, entry point
├── handlers.js       # Core logic for assign/list/remove flows
├── embeds.js         # Discord embed creation for all views
├── utils.js          # Helpers (validation, processing, logging)
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by other admin commands:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, database operations, and interaction processing
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, validation, and logging utilities

## Subcommands

- **`/temp-roles assign`**: Assign temporary roles to users that expire after a set duration
  - Options: `users` (string, required), `role` (role, required), `duration` (string, required), `reason` (string, optional), `notify` (boolean, optional), `notify-expiry` (boolean, optional)
- **`/temp-roles list`**: List active temporary roles for a user or all users in the server
  - Options: `user` (user, optional)
- **`/temp-roles remove`**: Remove a temporary role from users before it expires
  - Options: `users` (string, required), `role` (role, required), `reason` (string, optional), `notify` (boolean, optional)

## Usage Examples

```
/temp-roles assign users:"@User1, @User2" role:@VIP duration:"2d" reason:"Event participation"
/temp-roles assign users:"123456789, 987654321" role:@Moderator duration:"1w" reason:"Trial moderator" notify:true notify-expiry:true
/temp-roles list
/temp-roles list user:@User1
/temp-roles remove users:"@User1, @User2" role:@VIP reason:"Early removal requested" notify:true
```

## Permissions Required

- `ManageRoles` permission
- Admin role or equivalent

## Key Features

- Flexible duration support (1h, 2d, 1w, 30m, 1y)
- Bulk operations for multiple users
- Automatic role expiration
- Smart notifications (assignment, expiry, and removal DMs)
- Modern rich embeds with visual indicators
- Comprehensive validation and error handling
- Role ownership validation
- BSON error prevention
- **Voice Restrictions**: Automatically enforces Connect/Speak restrictions when assigning restrictive roles to users in voice channels
  - **Connect Disabled**: Users are automatically disconnected from voice channels when the role is assigned
  - **Speak Disabled**: Users are automatically muted in voice channels when the role is assigned
  - **Automatic Unmute**: Users are automatically unmuted when the restrictive role is removed
  - **Requirements**: Bot needs `Move Members` permission (for disconnecting) and `Mute Members` permission (for muting)

## Dependencies

- Discord.js
- Database manager for temporary role storage
- Theme configuration for colors and emojis
- Permission validation utilities
- Storage manager for data persistence
