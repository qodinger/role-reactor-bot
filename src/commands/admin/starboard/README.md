# Starboard Command

## Overview

The Starboard command lets administrators configure a community-driven hall of fame for their server. Messages that receive a certain number of specific reactions (default ⭐) are automatically posted to a designated starboard channel.

## File Structure

```
starboard/
├── index.js              # Command definition, subcommands, entry point, and metadata
├── handlers.js           # Main command handlers (setup/enable/disable)
└── README.md             # This documentation
```

## Architecture

Following the modular pattern established by other admin commands:

- **`index.js`**: Command definition using SlashCommandBuilder, permission validation, metadata, and main execution flow.
- **`handlers.js`**: Core business logic, database operations, and interaction processing for configuring the starboard settings.

*(Note: The actual background event listening and embed building logic resides in `src/features/starboard/StarboardManager.js` and `src/events/messageReactionAdd.js`)*

## Subcommands

- **`/starboard setup`**: Initial configuration of the starboard system
  - Options: `channel` (required), `emoji` (optional, default ⭐), `threshold` (optional, default 3)
- **`/starboard enable`**: Enable the starboard feature (automatically done during setup)
- **`/starboard disable`**: Disable the starboard feature without clearing settings

## Usage Examples

```
/starboard setup channel:#starboard emoji:⭐ threshold:3
/starboard enable
/starboard disable
```

## Permissions Required

- `ManageGuild` (Manage Server) permission required to configure settings

## Key Features

- **Customizable Channels:** Route starred messages to any designated channel.
- **Customizable Emojis:** Use standard emojis or custom server emojis (e.g., `<:custom_star:123456789>`).
- **Adjustable Thresholds:** Determine how many reactions are required for a message to hit the starboard.
- **Rich Embeds:** Posts starred messages as beautiful embeds, featuring a dynamic heat-map color based on star count (gold → orange → red).
- **Reply Context:** Seamlessly displays the original replied-to message context if applicable.
- **Media Support:** Displays images natively and provides rich, clickable links for videos, audio files, and documents.

## Dependencies

- Discord.js
- Database manager for guild settings (`StarboardSettingsRepository`)
- Response message utilities (`successEmbed`, `errorEmbed`, `infoEmbed`)
- Theme configuration for colors
