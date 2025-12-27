# Ping Command

## Overview

The Ping command checks the bot's latency, connection status, and performance metrics to help users understand the bot's current state.

## File Structure

```
ping/
├── index.js              # Command definition and entry point
├── handlers.js           # Main command handlers and latency measurement
├── embeds.js             # Discord embed creation and status display
├── utils.js              # Helper functions for calculations and formatting
└── README.md             # This documentation
```

## Architecture

Following the modular pattern established by other general commands:

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core business logic and latency measurement
- **`embeds.js`**: Discord embed creation and formatting with simple, official styling
- **`utils.js`**: Helper functions for calculations and formatting

## Usage Examples

```
/ping
```

## Permissions Required

- None (public command)
- All users can access

## Key Features

- Real-time latency measurement for Discord API and response time
- Automatic connection quality evaluation with status assessment
- Contextual performance tips based on connection status
- Bot uptime display in human-readable format
- Server statistics showing bot's reach and activity
- Simple and official design with clean, professional presentation

## Status Categories

### Excellent (0-99ms)

- **Status**: Excellent
- **Color**: Green
- **Description**: Your connection is running smoothly!
- **Tips**: Great performance! Everything should be working smoothly.

### Good (100-199ms)

- **Status**: Good
- **Color**: Blue
- **Description**: Connection is working well.
- **Tips**: Your connection is working fine. Consider using a wired connection for better performance.

### Fair (200-399ms)

- **Status**: Fair
- **Color**: Orange
- **Description**: Connection is a bit slow but still functional.
- **Tips**: Consider using a wired connection and closing unnecessary applications.

### Poor (400ms+)

- **Status**: Poor
- **Color**: Red
- **Description**: Connection is experiencing issues.
- **Tips**: Check internet connection, use wired connection, close other applications.

## Metrics Displayed

### Connection Information

- **Discord API Latency**: WebSocket ping to Discord servers
- **Response Time**: Time to process and respond to command
- **Bot Uptime**: How long the bot has been running

### Server Statistics

- **Servers**: Number of Discord servers the bot is in
- **Users**: Total users across all servers
- **Channels**: Total channels across all servers

## Dependencies

- Discord.js
- Theme configuration for colors and styling
- UI components for consistent design
- Utility functions for latency calculations
