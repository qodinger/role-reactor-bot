# Invite Command

A command that provides users with the bot's invite link and information about its features.

## Structure

- `index.js` - Main command definition and exports
- `handlers.js` - Core command logic and invite link generation
- `embeds.js` - Discord embed creation and bot information display
- `components.js` - Interactive button components for invite and support
- `utils.js` - Helper functions for invite link generation and validation
- `README.md` - This documentation file

## Features

- **Bot Invite Link**: Generates and displays the bot's invite link
- **Feature Showcase**: Highlights key bot capabilities and benefits
- **Interactive Buttons**: Direct links to invite bot and support server
- **Dynamic Content**: Adapts to bot name and avatar
- **Privacy-Focused**: Emphasizes data privacy and security

## Usage

```
/invite
```

No parameters required - simply displays the bot's invite information.

## Information Displayed

- **Bot Introduction**: Friendly greeting and bot description
- **Key Features**:
  - One-click role assignment
  - Event role management
  - Security and privacy
  - Reliability and monitoring
- **Invite Link**: Direct link to add bot to server
- **Support Server**: Link to get help and support

## Interactive Elements

- **Invite Button**: Direct link to add bot to user's server
- **Support Button**: Link to support server for assistance

## Technical Details

- Uses Discord.js SlashCommandBuilder
- Dynamically generates invite links
- Implements proper error handling
- Follows the modular command structure pattern
- Supports both cached and generated invite links
