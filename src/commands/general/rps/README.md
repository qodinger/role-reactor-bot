# Rock Paper Scissors Command

## Overview

The `/rps` command allows users to challenge anyone (including the bot) to Rock Paper Scissors. Challenge the bot for instant results, or challenge other users for interactive multiplayer games.

## File Structure

```
rps/
├── index.js      # Command definition
├── handlers.js   # Command execution logic
├── embeds.js     # Discord embed creation
├── utils.js      # Game logic and utilities
└── README.md     # This documentation
```

## Architecture

Following the modular pattern established by other general commands:

- **`index.js`**: Command definition with user and choice options (no subcommands)
- **`handlers.js`**: Core command logic and game execution
- **`embeds.js`**: Discord embed creation with result display
- **`utils.js`**: Game logic, winner determination, and utilities

## Usage Examples

### Challenge Another User

```
/rps user:@username choice:Rock
/rps user:@username choice:Paper
/rps user:@username choice:Scissors
```

### Play Against Bot

```
/rps user:@RoleReactorBot choice:Rock
/rps user:@RoleReactorBot choice:Paper
/rps user:@RoleReactorBot choice:Scissors
```

**Note:** To play against the bot, simply challenge the bot itself. The result will be shown immediately (no buttons needed).

When you challenge another user:

1. You select your choice (hidden from opponent)
2. Bot sends a message with buttons for the challenged user
3. Challenged user clicks their choice
4. Results are displayed immediately

## Permissions Required

- `Send Messages` permission
- `Embed Links` permission

## Key Features

- **Unified Challenge System**: One command for all games - challenge users or bots
- **Play Against Bot**: Challenge the bot for instant results (no buttons needed)
- **Challenge Friends**: Challenge other users to multiplayer games with interactive buttons
- **Interactive Buttons**: Challenged users respond with button clicks (for human players)
- **Instant Results**: Immediate winner determination
- **Visual Feedback**: Color-coded embeds (green for win, red for loss, blue for tie)
- **Emoji Display**: Visual representation of choices
- **Challenge Expiration**: Challenges expire after 10 minutes (reasonable time for users to respond)
- **No Setup Required**: Works immediately in any server

## Game Rules

- **Rock** beats **Scissors**
- **Paper** beats **Rock**
- **Scissors** beats **Paper**
- Same choice results in a tie

## Result Display

The embed shows:

- Your choice with emoji
- Bot's choice with emoji
- Winner announcement
- Color-coded result (Success/Error/Info theme colors)
