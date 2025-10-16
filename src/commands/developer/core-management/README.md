# Core Management Command

A developer-only command for managing user bonus credits (donation credits) in the Role Reactor Discord Bot.

## Overview

The Core Management command allows developers to add, remove, set, and view user bonus credits, as well as verify Ko-fi donations with proper logging and validation. **Note**: This command only manages bonus credits (donation credits) and cannot modify subscription credits or tiers, which are automatically managed by the Ko-fi subscription system.

## Credit System

The bot uses a dual-credit system:

- **Subscription Credits**: Automatically managed by monthly Ko-fi subscriptions, reset each month
- **Bonus Credits**: Donation credits that never expire, managed by this command
- **Subscription Tiers**: Automatically managed by Ko-fi webhooks, cannot be manually modified

When users spend credits, the system uses subscription credits first (FIFO), then bonus credits. This ensures subscription credits are used before they reset monthly.

**Important**: Tier management has been removed from this command to prevent conflicts with the automatic Ko-fi subscription system.

## Command Structure

```
/core-management <subcommand> [options]
```

## Subcommands

### Add Bonus Credits

```
/core-management add user:<User> amount:<Integer> [reason:<String>]
```

- **user**: The user to add bonus credits to (required)
- **amount**: Amount of bonus credits to add (1-10000) (required)
- **reason**: Reason for adding bonus credits (optional, max 200 chars)

### Remove Bonus Credits

```
/core-management remove user:<User> amount:<Integer> [reason:<String>]
```

- **user**: The user to remove bonus credits from (required)
- **amount**: Amount of bonus credits to remove (1-10000) (required)
- **reason**: Reason for removing bonus credits (optional, max 200 chars)

### Set Bonus Credits

```
/core-management set user:<User> amount:<Integer> [reason:<String>]
```

- **user**: The user to set bonus credits for (required)
- **amount**: Amount of bonus credits to set (0-10000) (required)
- **reason**: Reason for setting bonus credits (optional, max 200 chars)

### View Credits

```
/core-management view user:<User>
```

- **user**: The user to view credits for (required)

### Verify Ko-fi Donation

```
/core-management add-donation user:<User> amount:<Number> [ko-fi-url:<String>] [reason:<String>]
```

- **user**: The user to grant bonus credits to (required)
- **amount**: Donation amount in USD (0.01 - 10,000) (required)
- **ko-fi-url**: Ko-fi donation URL (optional)
- **reason**: Reason for verification (optional, max 200 chars)

**Credit Calculation:**

- Credits are calculated at $0.10 per credit (10 credits per $1) - matches Ko-fi donation rate
- Example: $5 donation = 50 bonus credits
- Credits are added as bonus credits (donation credits) that never expire

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

### Adding Bonus Credits

```
/core-management add user:@username amount:100 reason:Compensation for bug report
```

### Removing Bonus Credits

```
/core-management remove user:@username amount:50 reason:Refund for failed generation
```

### Setting Bonus Credits

```
/core-management set user:@username amount:500 reason:Account migration
```

### Viewing Credits

```
/core-management view user:@username
```

### Verifying Ko-fi Donation

```
/core-management add-donation user:@username amount:5.00 ko-fi-url:https://ko-fi.com/s/abc123 reason:Monthly supporter
```

## Response Format

All operations return a detailed embed showing:

- Operation type and result
- Target user information
- Balance changes (before/after)
- Reason (if provided)
- Operator information
- Timestamp
- **Donation verification**: Additional details including donation amount, Ko-fi URL, and credit calculation

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
