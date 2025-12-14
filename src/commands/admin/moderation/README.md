# Moderation Command

The `/moderation` command provides comprehensive moderation tools for server administrators to manage members, including timeout, warnings, bans, kicks, and message purging.

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

Timeout (mute) a user for a specified duration.

**Options:**

- `user` (user, required): The user to timeout
- `duration` (string, required): Duration in format like `30m`, `1h`, `2d`, `1w` (minimum 10 seconds, maximum 28 days)
- `reason` (string, optional): Reason for the timeout

**Example:**

```
/moderation timeout user:@User duration:1h reason:Spam
```

### `/moderation warn`

Warn a user with logging. Warnings are tracked and can be viewed in moderation history.

**Options:**

- `user` (user, required): The user to warn
- `reason` (string, optional): Reason for the warning

**Example:**

```
/moderation warn user:@User reason:Inappropriate behavior
```

### `/moderation ban`

Ban a user from the server permanently.

**Options:**

- `user` (user, required): The user to ban
- `reason` (string, optional): Reason for the ban
- `delete-days` (integer, optional): Days of messages to delete (0-7, default: 0)

**Example:**

```
/moderation ban user:@User reason:Repeated violations delete-days:1
```

### `/moderation kick`

Kick a user from the server (they can rejoin with an invite).

**Options:**

- `user` (user, required): The user to kick
- `reason` (string, optional): Reason for the kick

**Example:**

```
/moderation kick user:@User reason:Temporary removal
```

### `/moderation unban`

Unban a previously banned user.

**Options:**

- `user` (user, required): The user to unban

**Example:**

```
/moderation unban user:@User
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

## Key Features

- **Role Hierarchy Validation**: Ensures moderators can only moderate members below them in the role hierarchy
- **Bot Permission Checks**: Validates bot has required permissions before executing actions
- **Moderation Logging**: All actions are logged with case IDs, timestamps, and reasons
- **Warning Tracking**: Warnings are tracked per user and displayed in success messages
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

## Usage Examples

```
/moderation timeout user:@Spammer duration:2h reason:Spam in multiple channels
/moderation warn user:@User reason:First warning for inappropriate language
/moderation ban user:@Troll reason:Repeated violations delete-days:7
/moderation kick user:@User reason:Temporary removal for review
/moderation unban user:@User
/moderation purge amount:25
```

## Dependencies

- Discord.js
- Storage manager for moderation logging
- Theme configuration for colors and styling
- Permission utilities for hierarchy checks
