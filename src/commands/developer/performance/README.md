# Performance Command

## Overview

The `/performance` command provides comprehensive bot performance monitoring and metrics analysis. This command is restricted to developers only and offers detailed insights into the bot's operational performance, including event processing, command execution, and system resource usage.

## File Structure

```
performance/
├── index.js              # Command definition and entry point
├── handlers.js           # Core performance check logic and permission validation
├── embeds.js             # Discord embed creation for performance metrics display
├── utils.js              # Utility functions for metrics analysis and formatting
└── README.md             # This documentation
```

## Architecture

Following the modular pattern established by other developer commands:

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core performance check logic and permission validation
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions for metrics analysis and formatting

## Usage Examples

```
/performance
```

## Permissions Required

- Developer role (configured in bot settings)
- Default: No permissions (restricted access)

## Key Features

- **Performance Metrics**: Event and command execution statistics
- **Slow Operation Detection**: Identifies operations exceeding performance thresholds
- **Memory Usage Monitoring**: Real-time memory consumption tracking
- **Performance Scoring**: Automated performance evaluation and scoring
- **Bottleneck Identification**: Automatic detection of performance issues
- **Recommendations**: Actionable suggestions for performance improvement

## Response Details

The command returns a comprehensive embed showing:

- Overall performance summary (uptime, total events/commands)
- Performance metrics (average durations, event rates)
- Slow operations analysis
- Memory usage breakdown
- Performance recommendations
- System information fallback

## Performance Thresholds

- **Slow Commands**: > 200ms average execution time
- **Slow Events**: > 100ms average processing time
- **High Error Rate**: > 5% error rate in event processing
- **Memory Warning**: Based on system memory usage patterns

## Technical Details

- Integrates with the bot's performance monitoring system
- Implements configurable performance thresholds (default: 500ms for slow operations)
- Provides fallback information if performance monitor is unavailable
- Features automatic performance scoring and status evaluation
- Includes comprehensive error handling and logging

## Error Handling

- Graceful fallback for unavailable performance data
- Permission validation with clear error messages
- Comprehensive logging for debugging and monitoring
- User-friendly error responses for non-developers
- Automatic detection and reporting of monitoring system issues

## Dependencies

- Discord.js
- Theme configuration for colors and styling
- Permission validation utilities
- Performance monitoring system integration
