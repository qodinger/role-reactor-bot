# Serverinfo Command

## Overview

Display detailed information about the Discord server, including member counts, channel statistics, server settings, and features.

## File Structure

```
serverinfo/
├── index.js          # Command definition and entry point
├── handlers.js       # Main command handlers and server data processing
├── embeds.js         # Discord embed creation and server information display
├── utils.js          # Helper functions for data formatting
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by other general commands:

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core business logic and server data handling
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions for data formatting and validation

## Usage Examples

```
/serverinfo
```

## Permissions Required

- `ViewChannel` - Basic permission to view channels

## Key Features

- **Server Information**: Name, ID, owner, region
- **Server Age**: Creation date and age
- **Member Statistics**: Total members, online/idle/dnd/offline counts, humans vs bots
- **Channel Statistics**: Text, voice, forum, stage channels, categories, threads
- **Server Statistics**: Roles, emojis, stickers, boost level
- **Server Settings**: Verification level, NSFW level, 2FA requirement, AFK settings
- **System Channels**: AFK, system, rules, and updates channels
- **Server Features**: All enabled server features
- **Server Banner**: Displays server banner if available

## Notes

- This command can only be used in a server (not in DMs)
- Member presence data may be limited if the bot doesn't have the `GUILD_PRESENCES` intent
- Some information may require additional bot permissions to access

## Dependencies

- Discord.js
- Theme configuration for colors and styling
- Permission validation utilities
