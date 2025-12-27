# Leaderboard Command

## Overview

The Leaderboard command displays server experience leaderboards with different ranking types to help users see who are the most active members in the server.

## File Structure

```
leaderboard/
├── index.js              # Command definition and entry point
├── handlers.js           # Main command handlers and experience data handling
├── embeds.js             # Discord embed creation and leaderboard display
├── components.js         # Interactive button components for time filters
├── utils.js              # Helper functions for formatting and validation
└── README.md             # This documentation
```

## Architecture

Following the modular pattern established by other general commands:

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core business logic and experience data handling
- **`embeds.js`**: Discord embed creation and formatting with simple, official styling
- **`components.js`**: Interactive UI components (buttons for time filters)
- **`utils.js`**: Helper functions for formatting and validation

## Usage Examples

```
/leaderboard [limit] [type]
```

- `limit` (optional): Number of users to show (1-25, default: 10)
- `type` (optional): Choose from xp, level, messages, voice (default: xp)

## Permissions Required

- None (public command)
- All users can access

## Key Features

- Multiple leaderboard types (XP, Level, Messages, Voice Time)
- Configurable display limit (1-25 users)
- Clean ranking display with position indicators
- Simple and official design with professional presentation
- Interactive time filter buttons for different periods

## Leaderboard Types

### XP Leaderboard (Default)

- Shows users ranked by total experience points
- Displays XP amount and calculated level
- Most comprehensive ranking system

### Level Leaderboard

- Shows users ranked by their current level
- Focuses on level achievement rather than raw XP
- Clean level-based ranking

### Messages Leaderboard

- Shows users ranked by total messages sent
- Displays message count with proper formatting
- Activity-based ranking

### Voice Time Leaderboard

- Shows users ranked by voice channel time
- Displays time in hours and minutes format
- Voice activity tracking

## Interactive Elements

- **Time Filter Buttons**: Switch between different time periods
- **Active State**: Current timeframe button highlighted
- **User-Specific**: Each user gets their own button set

## Dependencies

- Discord.js
- Theme configuration for colors and styling
- ExperienceManager for data handling
- Utility functions for calculations and formatting
