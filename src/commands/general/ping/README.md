# Ping Command

A command to check the bot's latency, connection status, and performance metrics.

## Structure

- `index.js` - Main command definition and exports
- `handlers.js` - Core command logic and latency measurement
- `embeds.js` - Discord embed creation and status display
- `utils.js` - Helper functions for calculations and formatting
- `README.md` - This documentation file

## Features

- **Latency Measurement**: Discord API and response time measurement
- **Status Assessment**: Automatic connection quality evaluation
- **Performance Tips**: Contextual advice based on connection status
- **Uptime Display**: Bot running time in human-readable format
- **Server Statistics**: Bot's server, user, and channel counts
- **Visual Indicators**: Color-coded status and latency indicators

## Usage

```
/ping
```

No parameters required - simply checks the bot's connection status.

## Status Categories

### 🟢 Excellent (0-99ms)

- **Status**: Excellent
- **Color**: Green
- **Description**: Your connection is running smoothly! 🚀
- **Tips**: Great performance! Everything should be working smoothly.

### 🟡 Good (100-199ms)

- **Status**: Good
- **Color**: Blue
- **Description**: Connection is working well. ✅
- **Tips**: Your connection is working fine. Consider using a wired connection for better performance.

### 🟠 Fair (200-399ms)

- **Status**: Fair
- **Color**: Orange
- **Description**: Connection is a bit slow but still functional. ⚠️
- **Tips**: Consider using a wired connection and closing unnecessary applications.

### 🔴 Poor (400ms+)

- **Status**: Poor
- **Color**: Red
- **Description**: Connection is experiencing issues. 🔴
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

## Technical Details

- Uses Discord.js SlashCommandBuilder
- Implements deferred replies for accurate timing
- Real-time latency calculation
- Dynamic status assessment and tips
- Comprehensive error handling
- Follows the modular command structure pattern
- Logs performance metrics for monitoring
