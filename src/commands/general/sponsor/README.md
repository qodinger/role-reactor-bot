# Sponsor Command

## Overview

The `/sponsor` command provides information about supporting the bot's development and the benefits available to supporters.

## Structure

- **`index.js`**: Main command definition and execution flow
- **`handlers.js`**: Core command logic and response handling
- **`embeds.js`**: Discord embed creation for sponsor information
- **`utils.js`**: Utility functions and helper methods
- **`README.md`**: This documentation file

## Features

- **Supporter Benefits Display**: Shows exclusive benefits for supporters
- **Support Information**: Explains how to contribute to bot development
- **Professional Presentation**: Clean, informative embed design
- **User Attribution**: Shows who requested the sponsor information

## Usage

```bash
/sponsor
```

## Response

The command returns a comprehensive embed showing:

- Supporter benefits and perks
- How to support the bot development
- Information about donation options
- Professional presentation with clear benefits

## Permissions

- **Required**: None (public command)
- **Default**: All users can access

## Technical Details

- Uses Discord.js EmbedBuilder for rich formatting
- Implements proper error handling and logging
- Follows consistent embed design patterns
- Includes user attribution and timestamp
