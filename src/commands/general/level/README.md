# Level Command

## Overview

The Level command displays user level profiles with detailed experience information and progress tracking to help users understand their XP status and activity.

## File Structure

```
level/
├── index.js              # Command definition and entry point
├── handlers.js           # Main command handlers and experience data handling
├── embeds.js             # Discord embed creation and level profile display
├── utils.js              # Helper functions for calculations and rank determination
└── README.md             # This documentation
```

## Architecture

Following the modular pattern established by other general commands:

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core business logic and experience data handling
- **`embeds.js`**: Discord embed creation and formatting with simple, official styling
- **`utils.js`**: Helper functions for calculations and rank determination

## Usage Examples

```
/level [user]
```

- `user` (optional): The user whose level to check
- If no user specified, shows your own level profile

## Permissions Required

- None (public command)
- All users can access

## Key Features

- Comprehensive user level information and progress tracking
- Visual progress bar and XP breakdown display
- Dynamic rank titles based on level achievement
- Server ranking position in experience leaderboard
- Simple and official design with clean, professional presentation

## Rank System

### Legend (Level 50+)

- **Color**: Gold
- **Description**: Highest achievement level

### Veteran (Level 30+)

- **Color**: Orange
- **Description**: Experienced community member

### Experienced (Level 20+)

- **Color**: Purple
- **Description**: Active community participant

### Regular (Level 10+)

- **Color**: Blue
- **Description**: Regular server member

### Active (Level 5+)

- **Color**: Red
- **Description**: Active newcomer

### Newcomer (Level 1-4)

- **Color**: Green
- **Description**: New to the server

## Profile Information

### Basic Stats

- **User**: Discord tag and avatar
- **Rank**: Current rank title
- **Level**: Current experience level
- **Total XP**: Accumulated experience points
- **Progress**: XP in current level vs. needed for next
- **Next Level**: Target level to achieve

### Progress Bar

- Visual representation of level progress
- 15-character bar with filled and empty blocks
- Percentage completion display
- Configurable width for different display preferences

### XP Breakdown

- **Message XP**: 15-25 XP per message (60s cooldown) - Configurable
- **Command XP**: 8 XP per command (30s cooldown) - Configurable, applies to all commands
- **Role XP**: 50 XP per role assignment - Configurable

XP amounts are dynamically pulled from the server's XP settings configuration.

## Dependencies

- Discord.js
- Theme configuration for colors and styling
- ExperienceManager for data handling
- Utility functions for calculations and formatting
