# Assign Temporary Role Command

## Overview

The Assign Temporary Role command allows administrators to assign temporary roles to multiple users that automatically expire after a set time.

## File Structure

```
assign-temp-role/
├── index.js          # Main command definition and entry point
├── handlers.js       # Core logic and interaction handling
├── embeds.js         # Discord embed creation
├── utils.js          # Utility functions and helpers
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by the `schedule-role` command:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, role assignment, and error handling
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, validation, and logging utilities

## Key Features

- Assign temporary roles to multiple users simultaneously
- Automatic role expiration after specified duration
- Rate-limited role assignment to prevent API limits
- Direct message notifications to users
- Comprehensive validation and error handling
- Support for various duration formats

## Usage

```
/assign-temp-role users:"123456789,987654321" role:@Moderator duration:"2d" reason:"Event moderation"
```

## Permissions Required

- `ManageRoles` permission
- Administrator role or equivalent

## Parameters

- **users**: Comma-separated list of user IDs or mentions
- **role**: The role to assign temporarily
- **duration**: How long the role should last (e.g., 1h, 2d, 1w, 30m)
- **reason**: Optional reason for the assignment

## Duration Formats

- **Minutes**: `30m`, `60m`
- **Hours**: `1h`, `2h`, `12h`
- **Days**: `1d`, `2d`, `7d`
- **Weeks**: `1w`, `2w`
- **Range**: 1 minute to 1 year

## Process

1. Validates user permissions and bot permissions
2. Validates role and duration parameters
3. Processes user list and removes duplicates
4. Assigns roles with rate limiting (3 concurrent operations)
5. Sends DM notifications to users
6. Stores temporary role data for automatic expiration
7. Provides detailed results summary

## Dependencies

- Discord.js
- Temporary roles utility for storage and expiration
- Permission validation utilities
- Rate limiting with p-limit
- Response message utilities for embeds

## Error Handling

- Invalid role selection (managed/bot roles)
- Invalid duration format or range
- Missing bot permissions
- User not found or inaccessible
- Role assignment failures
- DM delivery failures

## Rate Limiting

- Maximum 3 concurrent role assignments
- Automatic retry logic for failed assignments
- 1-second delays between retries
