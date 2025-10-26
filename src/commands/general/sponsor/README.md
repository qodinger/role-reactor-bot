# Sponsor Command

## Overview

The Sponsor command provides information about supporting the bot's development to help keep it free and running for everyone.

## File Structure

```
sponsor/
├── index.js              # Command definition and entry point
├── handlers.js           # Main command handlers and response processing
├── embeds.js             # Discord embed creation for sponsor information
├── components.js         # Interactive components (button for sponsor link)
├── utils.js              # Utility functions and helper methods
└── README.md             # This documentation
```

## Architecture

Following the modular pattern established by other commands:

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core business logic and interaction processing
- **`embeds.js`**: Discord embed creation and formatting with simple, official styling
- **`components.js`**: Interactive UI components (button for external sponsor link)
- **`utils.js`**: Helper functions and utility methods

## Usage Examples

```
/sponsor
```

## Permissions Required

- None (public command)
- All users can access

## Key Features

- Development support information explaining why support is needed
- Clear information about donation options and contribution methods
- Interactive button for direct access to sponsor page
- Simple and official design with clean, professional presentation
- User attribution and timestamp

## Why Support?

- **Development** - Support new features and improvements
- **Maintenance** - Keep servers running and updated
- **Bug Fixes** - Ensure the bot stays reliable
- **Keep It Free** - Help maintain the bot's free services
- **Innovation** - Enable new ideas and capabilities

## How to Support

- **Any Amount** - Give what you can afford
- **One-Time or Regular** - Donate once or set up recurring
- **No Pressure** - Support only if you want to
- **Every Bit Helps** - Even small donations make a difference
- **No Commitment** - Cancel anytime

## Dependencies

- Discord.js
- Theme configuration for colors and styling
- External links configuration
- UI components for consistent design
