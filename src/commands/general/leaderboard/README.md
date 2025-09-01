# Leaderboard Command

A command to display server experience leaderboards with interactive time filters.

## Structure

- `index.js` - Main command definition and exports
- `handlers.js` - Core command logic and experience data handling
- `embeds.js` - Discord embed creation and leaderboard display
- `components.js` - Interactive button components for time filters
- `utils.js` - Helper functions for formatting and validation
- `README.md` - This documentation file

## Features

- **Experience Leaderboard**: Shows top 10 most active members
- **Time Filters**: All Time, Daily, Weekly, and Monthly views
- **Interactive Buttons**: Easy switching between time periods
- **Medal System**: Gold, Silver, Bronze medals for top 3
- **XP Display**: Formatted experience points with proper localization

## Usage

```
/leaderboard [timeframe]
```

- `timeframe` (optional): Choose between "all", "daily", "weekly", or "monthly"
- Defaults to "all time" if no timeframe specified

## Timeframe Options

- **🏆 All Time**: Complete server experience history
- **📅 Daily**: Today's experience gains
- **📊 Weekly**: This week's experience gains
- **📈 Monthly**: This month's experience gains

## Leaderboard Display

- **Top 10 Members**: Shows the most active users
- **Medal System**: 🥇🥈🥉 for top 3, numbers for others
- **XP Formatting**: Large numbers properly formatted with commas
- **User Mentions**: Clickable user references
- **Server Context**: Shows guild name in footer

## Interactive Elements

- **Time Filter Buttons**: Switch between different time periods
- **Active State**: Current timeframe button highlighted
- **User-Specific**: Each user gets their own button set

## Technical Details

- Uses Discord.js SlashCommandBuilder
- Integrates with ExperienceManager for data
- Implements proper error handling
- Follows the modular command structure pattern
- Supports dynamic timeframe switching
