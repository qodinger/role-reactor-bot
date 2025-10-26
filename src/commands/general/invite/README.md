# Invite Command

## Overview

The Invite command provides users with the bot's invite link and information about its features to help them add the bot to their servers.

## File Structure

```
invite/
├── index.js              # Command definition and entry point
├── handlers.js           # Main command handlers and invite link generation
├── embeds.js             # Discord embed creation and bot information display
├── components.js         # Interactive button components for invite and support
├── utils.js              # Helper functions for invite link generation and validation
└── README.md             # This documentation
```

## Architecture

Following the modular pattern established by other commands:

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core business logic and invite link generation
- **`embeds.js`**: Discord embed creation and formatting with simple, official styling
- **`components.js`**: Interactive UI components (buttons for invite and support links)
- **`utils.js`**: Helper functions for invite link generation and validation

## Usage Examples

```
/invite
```

No parameters required - simply displays the bot's invite information.

## Permissions Required

- None (public command)
- All users can access

## Key Features

- Bot invite link generation and display
- Interactive buttons for invite and support access
- Simple and official design with clean presentation

## Information Displayed

### Bot Introduction

- Friendly greeting and concise bot description

### Interactive Elements

- **Invite Button** - Direct link to add bot to user's server
- **Support Button** - Link to support server for assistance

## Dependencies

- Discord.js
- Theme configuration for colors and styling
- External links configuration
- UI components for consistent design
