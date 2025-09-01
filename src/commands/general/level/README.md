# Level Command

A command to display user level profiles with detailed experience information and progress tracking.

## Structure

- `index.js` - Main command definition and exports
- `handlers.js` - Core command logic and experience data handling
- `embeds.js` - Discord embed creation and level profile display
- `utils.js` - Helper functions for calculations and rank determination
- `README.md` - This documentation file

## Features

- **Level Profile**: Comprehensive user level information
- **Progress Tracking**: Visual progress bar and XP breakdown
- **Rank System**: Dynamic rank titles based on level
- **Server Ranking**: Position in server experience leaderboard
- **Activity Statistics**: Messages, commands, and roles earned
- **XP Breakdown**: Detailed explanation of XP sources

## Usage

```
/level [user]
```

- `user` (optional): The user whose level to check
- If no user specified, shows your own level profile

## Rank System

- **🥇 Legend** (Level 50+): Crown emoji, Gold color
- **⭐ Veteran** (Level 30+): Star emoji, Orange color
- **🚀 Experienced** (Level 20+): Rocket emoji, Purple color
- **🎭 Regular** (Level 10+): Roles emoji, Blue color
- **🚀 Active** (Level 5+): Rocket emoji, Red color
- **⭐ Newcomer** (Level 1-4): Star emoji, Green color

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
- 20-character bar with filled and empty blocks
- Percentage completion display

### Activity Statistics

- **Messages Sent**: Total messages in server
- **Commands Used**: Commands executed
- **Roles Earned**: Roles obtained through reactions
- **Server Rank**: Position in experience leaderboard

### XP Breakdown

- **Message XP**: 15-25 XP per message (60s cooldown)
- **Command XP**: 3-15 XP per command (30s cooldown)
- **Role XP**: 50 XP per role assignment

## Technical Details

- Uses Discord.js SlashCommandBuilder
- Integrates with ExperienceManager for data
- Implements proper error handling
- Follows the modular command structure pattern
- Supports preAwardXP for real-time XP updates
- Dynamic color and emoji selection based on level
