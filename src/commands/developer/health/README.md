# Health Command

## Overview

The `/health` command provides comprehensive bot health monitoring and system status information. This command is restricted to developers only and provides real-time insights into the bot's operational status.

## Structure

- **`index.js`**: Main command definition and execution flow
- **`handlers.js`**: Core health check logic and permission validation
- **`embeds.js`**: Discord embed creation for health status display
- **`utils.js`**: Utility functions for formatting and health evaluation
- **`README.md`**: This documentation file

## Features

- **System Health Monitoring**: Bot status, WebSocket connection, uptime
- **Performance Metrics**: Response time, memory usage, CPU usage
- **Process Information**: Node.js version, platform, architecture
- **Real-time Status**: Live health indicators with color coding
- **Developer Only Access**: Restricted to authorized developers

## Usage

```bash
/health
```

## Response

The command returns a comprehensive embed showing:

- Overall health status (Healthy/Warning/Error)
- System health indicators
- Performance metrics
- Process information
- Real-time memory and CPU usage

## Permissions

- **Required**: Developer role (configured in bot settings)
- **Default**: No permissions (restricted access)

## Technical Details

- Uses Discord.js EmbedBuilder for rich formatting
- Implements permission checking via `isDeveloper()` utility
- Provides real-time system metrics via Node.js process API
- Includes WebSocket ping monitoring for connection quality
- Features automatic status color coding based on health indicators

## Error Handling

- Graceful fallback for failed health checks
- Permission validation with clear error messages
- Comprehensive logging for debugging and monitoring
- User-friendly error responses for non-developers
