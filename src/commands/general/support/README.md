# Support Command

## Overview
The `/support` command provides comprehensive support information and guidance for users who need help with the bot.

## Structure
- **`index.js`**: Main command definition and execution flow
- **`handlers.js`**: Core command logic and response handling
- **`embeds.js`**: Discord embed creation for support information
- **`utils.js`**: Utility functions and helper methods
- **`README.md`**: This documentation file

## Features
- **Help Information**: Comprehensive guide on how to get help
- **Issue Reporting**: Clear instructions for reporting bugs and requesting features
- **Contact Details**: Multiple ways to reach support team
- **Professional Presentation**: Clean, organized support information

## Usage
```bash
/support
```

## Response
The command returns a comprehensive embed showing:
- How to get help with the bot
- How to report issues and request features
- Contact information and support channels
- Professional support guidance

## Permissions
- **Required**: None (public command)
- **Default**: All users can access

## Technical Details
- Uses Discord.js EmbedBuilder for rich formatting
- Implements proper error handling and logging
- Follows consistent embed design patterns
- Includes user attribution and timestamp
