# Setup Roles Command

## Overview

The Setup Roles command allows administrators to create role-reaction messages for self-assignable roles in their server.

## File Structure

```
setup-roles/
├── index.js          # Main command definition and entry point
├── handlers.js       # Core logic and interaction handling
├── embeds.js         # Discord embed creation
├── utils.js          # Utility functions and helpers
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by the `schedule-role` command:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, role processing, and error handling
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, validation, and logging utilities

## Key Features

- Create role-reaction messages with custom titles and descriptions
- Support for multiple roles with emoji reactions
- User limit support for roles
- Comprehensive error handling and validation
- Permission checking for both users and bot
- Role mapping storage for reaction handling

## Usage

```
/setup-roles title:"Gaming Roles" description:"Choose your gaming preferences" roles:"🎮:Gamer,🎨:Artist,💻:Developer" color:"#FF6B6B"
```

## Permissions Required

- `ManageRoles` permission
- Administrator role or equivalent

## Role Format

- Basic: `emoji:role` (e.g., `🎮:Gamer`)
- With mention: `emoji:@role` (e.g., `🎮:@Gamer`)
- With limit: `emoji:role:limit` (e.g., `🎮:Gamer:10`)

## Dependencies

- Discord.js
- Role management utilities
- Database manager for role mapping
- Permission validation utilities
- Input sanitization and validation
