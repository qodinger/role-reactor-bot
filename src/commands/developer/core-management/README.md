# Core Management Command

A developer-only command for managing user Core credits in the Role Reactor Discord Bot.

## Overview

The Core Management command allows developers to add, remove, set, and view user Core credits with proper logging and validation.

## Command Structure

```
/core-management <subcommand> [options]
```

## Subcommands

### Add Cores

```
/core-management add user:<User> amount:<Integer> [reason:<String>]
```

- **user**: The user to add Core credits to (required)
- **amount**: Amount of Core credits to add (1-10000) (required)
- **reason**: Reason for adding Core credits (optional, max 200 chars)

### Remove Cores

```
/core-management remove user:<User> amount:<Integer> [reason:<String>]
```

- **user**: The user to remove Core credits from (required)
- **amount**: Amount of Core credits to remove (1-10000) (required)
- **reason**: Reason for removing Core credits (optional, max 200 chars)

### Set Cores

```
/core-management set user:<User> amount:<Integer> [reason:<String>]
```

- **user**: The user to set Core credits for (required)
- **amount**: Amount of Core credits to set (0-10000) (required)
- **reason**: Reason for setting Core credits (optional, max 200 chars)

### View Cores

```
/core-management view user:<User>
```

- **user**: The user to view Core credits for (required)

## Features

### Security

- **Developer Only**: Requires developer permissions to use
- **Input Validation**: All inputs are validated with proper limits
- **Audit Logging**: All operations are logged with full context

### Data Management

- **Atomic Operations**: All Core credit changes are atomic
- **Storage Integration**: Uses the centralized storage manager
- **Error Handling**: Comprehensive error handling and user feedback

### User Experience

- **Rich Embeds**: Detailed embeds showing operation results
- **Color Coding**: Different colors for different operation types
- **Comprehensive Info**: Shows before/after balances and change amounts

## Permission Requirements

- **Developer Role**: Must have developer permissions in the bot's permission system
- **Server Only**: Command only works in Discord servers (not DMs)

## Usage Examples

### Adding Cores

```
/core-management add user:@username amount:100 reason:Compensation for bug report
```

### Removing Cores

```
/core-management remove user:@username amount:50 reason:Refund for failed generation
```

### Setting Cores

```
/core-management set user:@username amount:500 reason:Account migration
```

### Viewing Cores

```
/core-management view user:@username
```

## Response Format

All operations return a detailed embed showing:

- Operation type and result
- Target user information
- Balance changes (before/after)
- Reason (if provided)
- Operator information
- Timestamp

## Error Handling

The command handles various error scenarios:

- Invalid user references
- Permission denials
- Storage errors
- Network timeouts
- Invalid input values

## Logging

All operations are logged with:

- Target user ID
- Operation type and amount
- Before/after balances
- Operator ID
- Reason
- Timestamp

## Technical Details

### Files

- `index.js`: Command definition and main execution
- `handlers.js`: Core operation handlers and business logic
- `embeds.js`: Embed creation and formatting
- `README.md`: This documentation

### Dependencies

- Discord.js for interaction handling
- Storage manager for data persistence
- Permission system for access control
- Logger for audit trails
- Theme system for consistent styling

## Maintenance

### Adding New Operations

1. Add subcommand to `index.js`
2. Implement handler in `handlers.js`
3. Add embed support in `embeds.js`
4. Update this documentation

### Modifying Validation

- Update validation in `index.js` command options
- Add business logic validation in `handlers.js`
- Ensure error handling covers new validation rules

### Styling Changes

- Modify embed creation in `embeds.js`
- Update theme usage for consistency
- Test with different operation types
