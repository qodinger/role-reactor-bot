# Sponsor Command

## Overview

The `/sponsor` command provides information about supporting the bot's development to help keep it free and running for everyone.

## Structure

- **`index.js`**: Main command definition and execution flow
- **`handlers.js`**: Core command logic and response handling
- **`embeds.js`**: Discord embed creation for sponsor information
- **`components.js`**: Interactive button component for sponsor link
- **`utils.js`**: Utility functions and helper methods
- **`README.md`**: This documentation file

## Features

- **Development Support Information**: Explains why support is needed to keep the bot free
- **Support Options**: Shows how to contribute to bot development
- **Interactive Button**: Direct link to sponsor page
- **Professional Presentation**: Clean, informative embed design
- **User Attribution**: Shows who requested the sponsor information

## Usage

```bash
/sponsor
```

## Response

The command returns a comprehensive embed showing:

- Why support is needed to keep the bot free
- How to support the bot development
- Information about donation options
- Interactive button for sponsor page
- Professional presentation with clear development goals

## Permissions

- **Required**: None (public command)
- **Default**: All users can access

## Technical Details

- Uses Discord.js EmbedBuilder for rich formatting
- Implements proper error handling and logging
- Follows consistent embed design patterns
- Includes user attribution and timestamp
- Interactive button for external link (sponsor page)
- Dynamic button generation based on available external links
