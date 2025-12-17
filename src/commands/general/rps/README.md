# Rock Paper Scissors Command

## Overview

The `/rps` command allows users to play Rock Paper Scissors against the bot with a simple, interactive command.

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

- **`index.js`**: Command definition with choice options
- **`handlers.js`**: Core command logic and game execution
- **`embeds.js`**: Discord embed creation with result display
- **`utils.js`**: Game logic, winner determination, and utilities

## Usage Examples

### Play Against Bot

```
/rps play choice:Rock
/rps play choice:Paper
/rps play choice:Scissors
```

### Challenge Another User

```
/rps challenge user:@username choice:Rock
/rps challenge user:@username choice:Paper
/rps challenge user:@username choice:Scissors
```

When you challenge another user:

1. You select your choice (hidden from opponent)
2. Bot sends a message with buttons for the challenged user
3. Challenged user clicks their choice
4. Results are displayed immediately

## Permissions Required

- `Send Messages` permission
- `Embed Links` permission

## Key Features

- **Play Against Bot**: Quick games with instant results
- **Challenge Friends**: Challenge other users to multiplayer games
- **Interactive Buttons**: Challenged users respond with button clicks
- **Instant Results**: Immediate winner determination
- **Visual Feedback**: Color-coded embeds (green for win, red for loss, blue for tie)
- **Emoji Display**: Visual representation of choices
- **Challenge Expiration**: Challenges expire after 5 minutes
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
