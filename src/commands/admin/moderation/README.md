# Moderation Command

## Overview

The `/moderation` command provides comprehensive moderation tools for server administrators to manage members, including timeout, warnings, bans, kicks, and message purging. It supports bulk operations for efficient moderation of multiple users at once.

## File Structure

```
moderation/
├── index.js          # Command definition and subcommands
├── handlers.js       # Core logic for all moderation actions
├── embeds.js         # Discord embed creation for moderation actions
├── utils.js          # Utilities for validation, logging, and hierarchy checks
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by other admin commands:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic for each moderation action
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, validation, hierarchy checks, and moderation logging

## Subcommands

### `/moderation timeout`

Timeout (mute) a user or multiple users for a specified duration. Supports bulk operations up to 15 users.

**Options:**

- `users` (string, required): User mentions or IDs separated by commas (e.g., `@user1 @user2` or `123456789 987654321`). Supports up to 15 users
- `duration` (string, required): Duration in format like `30m`, `1h`, `2d`, `1w` (minimum 10 seconds, maximum 28 days)
- `reason` (string, optional): Reason for the timeout

**Examples:**

```
/moderation timeout users:@User duration:1h reason:Spam
/moderation timeout users:@User1 @User2 @User3 duration:2h reason:Spam in multiple channels
```

### `/moderation warn`

Warn a user or multiple users with logging. Warnings are tracked and can be viewed in moderation history. Supports bulk operations up to 15 users.

**Options:**

- `users` (string, required): User mentions or IDs separated by commas (e.g., `@user1 @user2` or `123456789 987654321`). Supports up to 15 users
- `reason` (string, optional): Reason for the warning

**Examples:**

```
/moderation warn users:@User reason:Inappropriate behavior
/moderation warn users:@User1 @User2 reason:First warning for inappropriate language
```

### `/moderation ban`

Ban a user or multiple users from the server permanently. Supports bulk operations up to 15 users.

**Options:**

- `users` (string, required): User mentions or IDs separated by commas (e.g., `@user1 @user2` or `123456789 987654321`). Supports up to 15 users
- `reason` (string, optional): Reason for the ban
- `delete-days` (integer, optional): Days of messages to delete (0-7, default: 0)

**Examples:**

```
/moderation ban users:@User reason:Repeated violations delete-days:1
/moderation ban users:@User1 @User2 @User3 reason:Repeated violations delete-days:7
```

### `/moderation kick`

Kick a user or multiple users from the server (they can rejoin with an invite). Supports bulk operations up to 15 users.

**Options:**

- `users` (string, required): User mentions or IDs separated by commas (e.g., `@user1 @user2` or `123456789 987654321`). Supports up to 15 users
- `reason` (string, optional): Reason for the kick

**Examples:**

```
/moderation kick users:@User reason:Temporary removal
/moderation kick users:@User1 @User2 reason:Temporary removal for review
```

### `/moderation unban`

Unban a previously banned user or multiple users. Supports bulk operations up to 15 users.

**Options:**

- `users` (string, required): User mentions or IDs separated by commas (e.g., `@user1 @user2` or `123456789 987654321`). Supports up to 15 users

**Examples:**

```
/moderation unban users:@User
/moderation unban users:@User1 @User2
```

### `/moderation purge`

Delete multiple messages from a channel.

**Options:**

- `amount` (integer, required): Number of messages to delete (1-100)
- `channel` (channel, optional): Channel to purge (default: current channel)

**Example:**

```
/moderation purge amount:50 channel:#general
```

### `/moderation history`

View moderation history for a user or the entire server with pagination support.

**Options:**

- `user` (user, optional): User to view history for. If not specified, shows all server moderation history
- `page` (integer, optional): Page number for pagination (default: 1)

**Examples:**

```
/moderation history
/moderation history user:@User
/moderation history user:@User page:2
```

### `/moderation remove-warn`

Remove a specific warning from a user by case ID.

**Options:**

- `user` (user, required): The user to remove the warning from
- `case-id` (string, required): Case ID of the warning to remove

**Example:**

```
/moderation remove-warn user:@User case-id:MOD-1234567890-ABC123
```

### `/moderation list-bans`

List all banned users in the server with pagination support.

**Options:**

- `page` (integer, optional): Page number for pagination (default: 1)

**Example:**

```
/moderation list-bans
/moderation list-bans page:2
```

## Key Features

- **Bulk Operations**: Moderate up to 15 users at once for timeout, warn, ban, kick, and unban actions with faster processing
- **Role Hierarchy Validation**: Ensures moderators can only moderate members below them in the role hierarchy
- **Bot Permission Checks**: Validates bot has required permissions before executing actions
- **Moderation Logging**: All actions are logged with case IDs, timestamps, and reasons
- **Warning Tracking**: Warnings are tracked per user and displayed in success messages
- **Auto-Escalation**: Automatic timeout or kick based on warning thresholds (configurable)
- **Moderation History**: View moderation history for individual users or entire server with pagination
- **DM Notifications**: Users receive direct messages when warned, timed out, banned, kicked, or unbanned
- **Bot Protection**: Prevents moderating bots to avoid breaking bot functionality
- **Rate Limit Handling**: Built-in rate limit handling with retries for bulk operations
- **Comprehensive Error Handling**: Clear error messages for permission issues, hierarchy problems, and invalid inputs
- **Case IDs**: Each moderation action gets a unique case ID for tracking and reference

## Permissions Required

### User Permissions

- **Administrator** permission is required to use all moderation commands
- The command is registered with `ModerateMembers` as the default permission, but the handler enforces Administrator permission

### Bot Permissions

The bot needs the following permissions to execute moderation actions:

- **`ModerateMembers`**: Required for `/moderation timeout` command
- **`BanMembers`**: Required for `/moderation ban` and `/moderation unban` commands
- **`KickMembers`**: Required for `/moderation kick` command
- **`ManageMessages`**: Required for `/moderation purge` command (channel-specific)

**Note**: The bot will check for these permissions before executing each action and provide clear error messages if permissions are missing. The `/moderation warn` command does not require any special bot permissions (only user Administrator permission).

### Setting Up Bot Permissions

1. Go to **Server Settings** → **Roles**
2. Find the bot's role (Role Reactor)
3. Enable the following permissions:
   - ✅ **Moderate Members** (for timeout)
   - ✅ **Ban Members** (for ban/unban)
   - ✅ **Kick Members** (for kick)
   - ✅ **Manage Messages** (for purge)
4. **Important**: Make sure the bot's role is positioned **above** the roles of users you want to moderate in the role hierarchy

## Moderation Logging

All moderation actions are logged to storage with:

- Case ID (unique identifier)
- Guild ID
- User ID (target)
- Moderator ID
- Action type (timeout, warn, ban, kick, unban)
- Reason
- Timestamp
- Additional metadata (duration, delete days, etc.)

Logs are stored in the `moderation_logs` collection, organized by guild and user. Each user can have up to 100 log entries (oldest are removed when limit is reached).

## Auto-Escalation

The moderation system includes automatic escalation based on warning thresholds:

- **Auto-Timeout**: Automatically timeout users after reaching a configured number of warnings (default: 3 warnings)
- **Auto-Kick**: Automatically kick users after reaching a configured number of warnings (default: 5 warnings)
- **Configurable**: Thresholds can be configured via environment variables:
  - `MODERATION_TIMEOUT_AFTER_WARNINGS` (default: 3)
  - `MODERATION_KICK_AFTER_WARNINGS` (default: 5)
  - `MODERATION_AUTO_TIMEOUT_DURATION` (default: 1h)

Auto-escalation can be disabled by setting thresholds to 0.

## Usage Examples

### Single User Operations

```
/moderation timeout users:@Spammer duration:2h reason:Spam in multiple channels
/moderation warn users:@User reason:First warning for inappropriate language
/moderation ban users:@Troll reason:Repeated violations delete-days:7
/moderation kick users:@User reason:Temporary removal for review
/moderation unban users:@User
/moderation purge amount:25
```

### Bulk Operations (Up to 15 Users)

```
/moderation timeout users:@User1 @User2 @User3 duration:1h reason:Spam
/moderation warn users:@User1 @User2 reason:Inappropriate behavior
/moderation ban users:@User1 @User2 @User3 reason:Repeated violations delete-days:1
/moderation kick users:@User1 @User2 reason:Temporary removal
/moderation unban users:@User1 @User2
```

### History and Management

```
/moderation history
/moderation history user:@User
/moderation history user:@User page:2
/moderation remove-warn user:@User case-id:MOD-1234567890-ABC123
/moderation list-bans
/moderation list-bans page:2
```

## Dependencies

- Discord.js
- Storage manager for moderation logging
- Theme configuration for colors and styling
- Permission utilities for hierarchy checks
