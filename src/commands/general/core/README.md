# Core Command

The `/core` command allows users to check their Core balance and view pricing information for the Core credit system.

## File Structure

```
src/commands/general/core/
├── index.js          # Command definition and structure
├── handlers.js       # Main command execution logic
├── embeds.js         # Embed creation functions
├── utils.js          # Utility functions for data management
├── validation.js     # Input validation functions
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by other commands:

- **`index.js`**: Command definition, subcommands, and main execution flow
- **`handlers.js`**: Core business logic, balance checking, and pricing display
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, data management, and pricing calculations
- **`validation.js`**: Input validation and user data verification

## Usage Examples

```
/core balance
/core pricing
```

## Permissions Required

- `Send Messages` permission
- `Embed Links` permission

## Available Options

- **balance** (subcommand): Check current Core balance and tier status
- **pricing** (subcommand): View Core pricing, membership benefits, and donation options

## Key Features

- Real-time balance checking
- Tier status with proper badge emojis
- Total avatar generation count
- Clear pricing structure for donations
- Core membership tier benefits
- Monthly credit allocations
- Professional presentation
- Ephemeral responses for privacy
- Simple and official design

## Dependencies

- Discord.js
- Storage manager for data persistence
- Theme configuration for colors and styling
- Ko-fi integration for donation links
