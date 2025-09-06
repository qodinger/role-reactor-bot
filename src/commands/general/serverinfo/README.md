# Server Info Command

A command to display comprehensive information about the Discord server.

## Structure

- `index.js` - Main command definition and exports
- `handlers.js` - Core command logic and data collection
- `embeds.js` - Discord embed creation and server information display
- `utils.js` - Helper functions for statistics calculation
- `README.md` - This documentation file

## Features

- **Server Statistics**: Member counts, online status, bot vs human ratio
- **Channel Information**: Text, voice, and category channel counts
- **Server Details**: Creation date, owner, role count
- **Boost Information**: Current boost level and associated perks
- **Rich Display**: Server icon, formatted timestamps, organized fields

## Usage

```
/serverinfo
```

No parameters required - displays comprehensive server information.

## Information Displayed

### Basic Server Info

- **Server Name**: Current server name
- **Server Icon**: Thumbnail display
- **Owner**: Server owner with mention

### Member Statistics

- **Total Members**: Complete member count
- **Online Members**: Currently online users
- **Human Count**: Non-bot users
- **Bot Count**: Bot users

### Channel Breakdown

- **Text Channels**: Number of text channels
- **Voice Channels**: Number of voice channels
- **Categories**: Number of channel categories

### Server Details

- **Roles**: Total number of roles
- **Created**: Server creation date and age
- **Boost Level**: Current boost tier and perks

## Boost Levels

- **Level 0**: No boosts
- **Level 1**: Basic boost perks
- **Level 2**: Enhanced perks + 15 extra emoji slots
- **Level 3**: Maximum perks + 30 extra emoji slots + animated server icon

## Technical Details

- Uses Discord.js SlashCommandBuilder
- Implements deferred replies for data collection
- Real-time member and channel counting
- Dynamic boost level assessment
- Comprehensive error handling
- Follows the modular command structure pattern
- Logs command usage for analytics
