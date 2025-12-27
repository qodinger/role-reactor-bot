# Support Command

## Overview

The Support command provides comprehensive support information and guidance for users who need help with the bot.

## File Structure

```
support/
├── index.js              # Command definition and entry point
├── handlers.js           # Main command handlers and response processing
├── embeds.js             # Discord embed creation for support information
├── components.js         # Interactive components (buttons for external links)
├── utils.js              # Utility functions and helper methods
└── README.md             # This documentation
```

## Architecture

Following the modular pattern established by other general commands:

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core business logic and interaction processing
- **`embeds.js`**: Discord embed creation and formatting with simple, official styling
- **`components.js`**: Interactive UI components (buttons for external links)
- **`utils.js`**: Helper functions and utility methods

## Usage Examples

```
/support
```

## Permissions Required

- None (public command)
- All users can access

## Key Features

- Comprehensive help information and guidance
- Clear instructions for reporting bugs and requesting features
- Interactive buttons for Discord support server and GitHub repository
- Simple and official design with clean, professional presentation
- User attribution and timestamp

## Support Options

- **Help Command** - Use `/help` for command information
- **Specific Help** - Use `/help command:command_name` for detailed help
- **Community** - Join our support server for assistance
- **Documentation** - Check our comprehensive guides

## Issue Reporting

- **Bug Reports** - Report bugs with detailed information
- **Feature Requests** - Suggest new features and improvements
- **Performance Issues** - Report slow responses or errors
- **Compatibility** - Report issues with different platforms

## Dependencies

- Discord.js
- Theme configuration for colors and styling
- External links configuration
- UI components for consistent design
