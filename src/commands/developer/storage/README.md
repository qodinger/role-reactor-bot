# Storage Command

## Overview

The `/storage` command provides comprehensive storage system monitoring and configuration status. This command is restricted to developers only and offers detailed insights into the bot's storage infrastructure, including database health, file storage status, and data retention policies.

## Structure

- **`index.js`**: Main command definition and execution flow
- **`handlers.js`**: Core storage check logic and permission validation
- **`embeds.js`**: Discord embed creation for storage status display
- **`utils.js`**: Utility functions for storage analysis and validation
- **`README.md`**: This documentation file

## Features

- **Storage Type Detection**: Automatically identifies database vs. file storage
- **Database Health Monitoring**: Real-time database connection status
- **Data Statistics**: Role mappings and temporary roles count
- **Data Retention Policies**: Information about data lifecycle management
- **Storage Recommendations**: Actionable suggestions for optimization
- **Performance Metrics**: Storage operation performance indicators
- **Fallback Information**: Basic system info when storage systems unavailable

## Usage

```bash
/storage
```

## Response

The command returns a comprehensive embed showing:

- Storage type and database connection status
- Active role mappings and temporary roles count
- Data retention policies and schedules
- Storage recommendations and optimization tips
- Database details and performance metrics
- System information fallback

## Permissions

- **Required**: Developer role (configured in bot settings)
- **Default**: No permissions (restricted access)

## Technical Details

- Integrates with storage and database management systems
- Provides real-time health monitoring and status reporting
- Implements comprehensive error handling and fallback mechanisms
- Features automatic recommendation generation based on system state
- Includes detailed logging for debugging and monitoring

## Storage Types Supported

- **Database Storage**: PostgreSQL, MySQL, SQLite with health checks
- **File Storage**: Local file system with backup recommendations
- **Hybrid Storage**: Combination of database and file storage

## Data Retention Policies

- **Role Mappings**: Permanent until manually removed
- **Temporary Roles**: Automatic expiration based on time settings
- **System Logs**: 30-day retention with automatic cleanup
- **Cache Data**: 5-minute TTL with automatic refresh

## Error Handling

- Graceful fallback for unavailable storage systems
- Permission validation with clear error messages
- Comprehensive logging for debugging and monitoring
- User-friendly error responses for non-developers
- Automatic detection and reporting of storage issues

## Monitoring Capabilities

- Connection health and response time monitoring
- Data corruption detection and reporting
- Performance bottleneck identification
- Storage efficiency metrics calculation
- Automatic alert generation for critical issues
