# Core Command

## Overview

The `/core` command allows users to check their Core balance and view pricing information for the Core credit system.

## File Structure

```
core/
├── index.js              # Command definition and entry point
├── handlers.js           # Core command logic and interaction handling
├── embeds.js             # Discord embed creation and formatting
├── utils.js              # Helper functions, data management, and pricing calculations
├── validation.js         # Input validation and user data verification
├── payment.js             # Payment processing and cryptocurrency integration
├── paymentEmbeds.js       # Payment-related embed creation
└── README.md             # This documentation
```

## Architecture

Following the modular pattern established by other general commands:

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
- **pricing** (subcommand): View Core pricing and purchase options

## Key Features

- Real-time balance checking
- Tier status with proper badge emojis
- Total avatar generation count
- Clear pricing structure for one-time crypto payments
- Credit breakdown (subscription vs bonus credits)
- Professional presentation
- Ephemeral responses for privacy
- Simple and official design

## Dependencies

- Discord.js
- Storage manager for data persistence
- Theme configuration for colors and styling
- Cryptocurrency payment integration (Plisio)
- Website sponsor page for purchases
