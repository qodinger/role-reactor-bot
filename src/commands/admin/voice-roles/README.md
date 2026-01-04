# Voice Roles Command

## Overview

The Voice Roles command allows administrators to configure roles that automatically manage users in voice channels. When users are assigned specific roles, the bot will automatically disconnect, mute, deafen, or move them in voice channels based on the configured role settings.

## File Structure

```
voice-roles/
├── index.js          # Command definition, subcommands, entry point
├── handlers.js       # Core logic for add/remove/list operations
├── embeds.js         # Discord embed creation for list display
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by other admin commands:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, database operations, and voice roles action processing
- **`embeds.js`**: Discord embed creation and formatting for role list display

## Subcommands

### `/voice-roles disconnect`

Manage roles that automatically disconnect users from voice channels.

- **`add`**: Add a role that will disconnect users from voice channels
  - Options: `role` (required)
- **`remove`**: Remove a role from the disconnect list
  - Options: `role` (required)

### `/voice-roles mute`

Manage roles that automatically mute users in voice channels.

- **`add`**: Add a role that will mute users in voice channels
  - Options: `role` (required)
- **`remove`**: Remove a role from the mute list
  - Options: `role` (required)

### `/voice-roles deafen`

Manage roles that automatically deafen users in voice channels.

- **`add`**: Add a role that will deafen users in voice channels
  - Options: `role` (required)
- **`remove`**: Remove a role from the deafen list
  - Options: `role` (required)

### `/voice-roles move`

Manage roles that automatically move users to specific voice channels.

- **`add`**: Add a role that will move users to a specific voice channel
  - Options: `role` (required), `channel` (required)
- **`remove`**: Remove a role from the move list
  - Options: `role` (required)

### `/voice-roles list`

List all roles configured for voice roles with their current status.

## Usage Examples

```
/voice-roles disconnect add role:@Muted
/voice-roles mute add role:@Restricted
/voice-roles deafen add role:@Punished
/voice-roles move add role:@SupportTeam channel:#support-voice
/voice-roles disconnect remove role:@Muted
/voice-roles list
```

## Permissions Required

### User Permissions

- `ManageRoles` permission
- Administrator permissions (enforced by command handler)

### Bot Permissions

The bot needs different permissions depending on the action:

- **`MoveMembers`**: Required for disconnect and move operations
- **`MuteMembers`**: Required for mute operations
- **`DeafenMembers`**: Required for deafen operations

The bot will check for these permissions before executing each action and provide clear error messages if permissions are missing.

## Key Features

- **Automatic Voice Management**: Actions are automatically applied when users join voice channels or when roles are assigned
- **Auto-Apply to Existing Members**: When a role is first configured, the action is automatically applied to users already in voice channels
- **Multiple Action Types**: Support for disconnect, mute, deafen, and move operations
- **Role-Based Configuration**: Configure different roles for different actions
- **List Management**: View all configured voice control roles with indicators for deleted roles or channels
- **Performance Optimized**: Batching and rate limiting for large operations to prevent API rate limits
- **Background Processing**: Large operations process in the background without blocking command responses
- **Duplicate Prevention**: Prevents duplicate actions if users are already in the desired state
- **Permission Validation**: Comprehensive permission checks for both users and bot

## How It Works

1. **Role Assignment**: When a user is assigned a voice control role, the bot automatically applies the configured action
2. **Voice Join**: When a user with a voice control role joins a voice channel, the action is immediately applied
3. **Existing Members**: When a role is first configured, the action is applied to all users already in voice channels with that role
4. **State Checking**: The bot checks if users are already in the desired state before applying actions to prevent redundant operations

## Use Cases

- **Punishment Roles**: Automatically mute or disconnect users with punishment roles
- **Restricted Access**: Prevent certain roles from accessing voice channels
- **Organizational Management**: Automatically move users to specific channels based on their roles
- **Event Management**: Organize users into event-specific voice channels

## Performance Considerations

- **Batching**: Processes up to 5 members at a time to prevent rate limits
- **Rate Limiting**: 200ms delay between batches for API rate limit compliance
- **Background Processing**: Large operations (>50 members) process in the background
- **Immediate Feedback**: Users receive immediate confirmation while background processing continues
- **Timeout Prevention**: Limits immediate processing to 50 members to prevent command timeouts

## Dependencies

- Discord.js
- Storage manager for voice control role persistence
- Theme configuration for colors and styling
- Permission validation utilities
- Event handlers for `guildMemberUpdate` and `voiceStateUpdate`
