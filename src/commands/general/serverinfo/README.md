# Serverinfo Command

Display detailed information about the Discord server, including member counts, channel statistics, server settings, and features.

## Usage

```
/serverinfo
```

## Features

- **Server Information**: Name, ID, owner, region
- **Server Age**: Creation date and age
- **Member Statistics**: Total members, online/idle/dnd/offline counts, humans vs bots
- **Channel Statistics**: Text, voice, forum, stage channels, categories, threads
- **Server Statistics**: Roles, emojis, stickers, boost level
- **Server Settings**: Verification level, NSFW level, 2FA requirement, AFK settings
- **System Channels**: AFK, system, rules, and updates channels
- **Server Features**: All enabled server features
- **Server Banner**: Displays server banner if available

## Permissions Required

- `ViewChannel` - Basic permission to view channels

## Notes

- This command can only be used in a server (not in DMs)
- Member presence data may be limited if the bot doesn't have the `GUILD_PRESENCES` intent
- Some information may require additional bot permissions to access
