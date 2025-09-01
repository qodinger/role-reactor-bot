# Temp Roles Command

## Overview

The Temp Roles command lets administrators manage temporary role assignments that automatically expire after a specified duration. It consolidates all temporary role functionality under a single command with multiple subcommands for assigning, listing, and removing temporary roles.

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

- **`index.js`**: Defines `/temp-roles` with subcommands (`assign`, `list`, `remove`), routes to handlers, validates permissions, and defers interactions.
- **`handlers.js`**: Implements business logic for assigning, listing, and removing temporary roles; orchestrates embeds and utils.
- **`embeds.js`**: Builds all rich embeds used across subcommands for assignments, listings, and removals.
- **`utils.js`**: Validation functions, role processing, user handling, time calculations, and logging utilities.

## Subcommands

- **`/temp-roles assign`**: Assign temporary roles to users that expire after a set duration.
  - Options: `users` (string, required), `role` (role, required), `duration` (string, required), `reason` (string, optional), `notify` (boolean, optional)
- **`/temp-roles list`**: List active temporary roles for a user or all users in the server.
  - Options: `user` (user, optional)
- **`/temp-roles remove`**: Remove a temporary role from a user before it expires.
  - Options: `user` (user, required), `role` (role, required), `reason` (string, optional)

## Usage Examples

```
/temp-roles assign users:"@User1, @User2" role:@VIP duration:"2d" reason:"Event participation"
/temp-roles assign users:"123456789, 987654321" role:@Moderator duration:"1w" reason:"Trial moderator" notify:true
/temp-roles list
/temp-roles list user:@User1
/temp-roles remove user:@User1 role:@VIP reason:"Early removal requested"
```

## Permissions Required

- `ManageRoles` for command usage
- Bot requires appropriate role hierarchy and permissions to assign/remove roles
- Bot needs higher role position than target roles in server hierarchy

## Key Features

- **Flexible Duration Support**: Natural duration formats (1h, 2d, 1w, 30m, 1y)
- **Bulk Assignment**: Assign roles to multiple users simultaneously with comma separation
- **User Input Flexibility**: Support for user mentions (@user) and user IDs
- **Automatic Expiration**: Roles automatically removed when duration expires
- **Comprehensive Validation**: Role hierarchy, permissions, and duration checks
- **Rich Embeds**: Detailed feedback with assignment results, user info, and timestamps
- **Optional DM Notifications**: Users can receive DMs when roles are assigned (opt-in via `notify` parameter)
- **Activity Logging**: All actions logged for audit purposes

## Duration Formats

- **Minutes**: `30m`, `45m`
- **Hours**: `1h`, `24h`
- **Days**: `1d`, `7d`
- **Weeks**: `1w`, `2w`
- **Years**: `1y`
- **Mixed**: `1d 12h`, `2w 3d`

**Limits**: Minimum 1 minute, Maximum 1 year

## Error Handling

- Validates user and bot permissions before execution
- Clear error messages for invalid users, roles, or durations
- Graceful handling of Discord API errors and rate limits
- Defensive validation of role hierarchy and bot capabilities
- Comprehensive logging for debugging and audit trails

## User Experience

- **Assignment Results**: Shows success/failure counts and detailed issue reporting
- **Time Display**: Human-readable time remaining and expiration timestamps
- **Role Information**: Display role colors, names, and hierarchy position
- **Batch Processing**: Parallel processing with rate limiting for multiple users
- **Management Links**: Easy commands referenced in embeds for follow-up actions

## Notes

- Ensure the bot's role is above target roles in the hierarchy
- Users with existing roles will skip assignment to prevent duplicates
- DM notifications are sent when possible but failures are handled gracefully
- Expired roles are automatically filtered from list views
- Role assignments persist across bot restarts via database storage
- All times are displayed in Discord timestamp format for user's timezone

## Expiration System

The bot automatically handles temporary role expiration:

- **Automatic Cleanup**: Roles are checked every 60 seconds and removed when expired
- **Database Management**: Expired role records are automatically cleaned up
- **User Notifications**: Users receive DM notifications when their roles expire
- **No Manual Intervention**: Expired roles don't need to be manually removed
