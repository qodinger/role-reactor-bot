# Verify Command

The `/verify` command is a developer-only tool for manually verifying Ko-fi donations and subscriptions, and granting Core credits to users.

## Overview

This command provides three subcommands for different types of verification:

- **`donation`** - Verify Ko-fi donations and grant Core credits
- **`subscription`** - Verify Ko-fi subscriptions and grant Core membership
- **`manual`** - Manually add Core credits without Ko-fi verification

## Command Structure

### Main Command

```
/verify
```

### Subcommands

#### Donation Verification

```
/verify donation user:<User> amount:<Number> [ko-fi-url:<String>] [notes:<String>]
```

**Parameters:**

- `user` (required) - User to grant Core credits to
- `amount` (required) - Donation amount in USD (0.01 - 10,000)
- `ko-fi-url` (optional) - Ko-fi donation URL
- `notes` (optional) - Additional notes (max 200 characters)

**Credit Calculation:**

- Credits are calculated at $0.05 per credit (20 credits per $1)
- Example: $5 donation = 100 Core credits

#### Subscription Verification

```
/verify subscription user:<User> [ko-fi-url:<String>] [notes:<String>]
```

**Parameters:**

- `user` (required) - User to grant Core membership to
- `ko-fi-url` (optional) - Ko-fi subscription URL
- `notes` (optional) - Additional notes (max 200 characters)

**Core Membership:**

- Grants Core Basic tier by default
- Adds monthly credits based on tier (50 for Basic)
- Sets `isCore: true` and `coreTier: "Core Basic"`

#### Manual Credits

```
/verify manual user:<User> credits:<Integer> [notes:<String>]
```

**Parameters:**

- `user` (required) - User to grant Core credits to
- `credits` (required) - Number of Core credits to add (1 - 1,000)
- `notes` (optional) - Reason for manual credit addition (max 200 characters)

## File Structure

```
src/commands/developer/verify/
├── index.js          # Command definition and structure
├── handlers.js       # Main command execution logic
├── embeds.js         # Embed creation functions
├── utils.js          # Utility functions for data management
├── validation.js     # Input validation functions
└── README.md         # This documentation
```

## Key Features

### 🔒 Developer Only

- Restricted to users with developer permissions
- Uses `isDeveloper()` function for permission checking
- All subcommands include "🔒 [DEVELOPER ONLY]" in descriptions

### 📊 Comprehensive Validation

- Input validation for all parameters
- Range checking for amounts and credits
- URL format validation for Ko-fi links
- String length validation for notes

### 🎨 Rich Embeds

- Success embeds with detailed information
- Error embeds with clear error messages
- Consistent styling and branding
- Tier badges for Core memberships

### 📝 Verification Tracking

- All verifications are logged with timestamps
- Tracks who performed the verification
- Stores verification type and details
- Maintains audit trail for accountability

### 💾 Data Management

- Uses centralized storage manager
- MongoDB integration with local fallback
- Automatic data synchronization
- Proper error handling and recovery

## Usage Examples

### Verify a $10 Donation

```
/verify donation user:@john_doe amount:10 ko-fi-url:https://ko-fi.com/s/abc123 notes:Monthly supporter
```

### Grant Core Membership

```
/verify subscription user:@jane_smith ko-fi-url:https://ko-fi.com/s/def456 notes:Premium subscriber
```

### Add Manual Credits

```
/verify manual user:@bob_wilson credits:50 notes:Compensation for service issue
```

## Error Handling

The command includes comprehensive error handling:

- **Validation Errors** - Clear messages for invalid inputs
- **Permission Errors** - Proper access control messaging
- **Database Errors** - Graceful handling of storage issues
- **Network Errors** - Retry logic and fallback mechanisms

## Data Storage

### User Data Structure

```javascript
{
  credits: 150,                    // Current Core credit balance
  isCore: true,                    // Core membership status
  coreTier: "Core Basic",          // Core tier level
  totalGenerated: 25,              // Total avatar generations
  lastUpdated: "2025-01-15T10:30:00.000Z",
  verifications: [                 // Verification history
    {
      type: "donation",
      amount: 10,
      credits: 200,
      koFiUrl: "https://ko-fi.com/s/abc123",
      notes: "Monthly supporter",
      verifiedBy: "developer_name",
      verifiedAt: "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

### Verification Types

- `donation` - Ko-fi donation verification
- `subscription` - Ko-fi subscription verification
- `manual` - Manual credit addition

## Security Considerations

- **Developer Only Access** - Command restricted to authorized developers
- **Input Validation** - All inputs validated before processing
- **Audit Trail** - All actions logged with timestamps and user info
- **Rate Limiting** - Built-in protection against abuse
- **Data Integrity** - Proper error handling and data validation

## Integration Points

### Storage Manager

- Uses `getStorageManager()` for data persistence
- Integrates with MongoDB and local JSON fallback
- Automatic synchronization between storage systems

### Permission System

- Uses `isDeveloper()` for access control
- Integrates with Discord permission system
- Proper error handling for permission failures

### Logging System

- Uses centralized logger for all operations
- Structured logging with context information
- Error tracking and debugging support

## Maintenance

### Adding New Verification Types

1. Add new subcommand to `index.js`
2. Create handler function in `handlers.js`
3. Add validation function in `validation.js`
4. Create embed function in `embeds.js`
5. Update utility functions in `utils.js` if needed

### Modifying Credit Calculations

- Update `calculateCreditsFromDonation()` in `utils.js`
- Modify tier credit amounts in `getMonthlyCreditsForTier()`
- Update documentation and examples

### Changing Data Structure

- Update `getUserData()` and `saveUserData()` in `utils.js`
- Modify validation functions in `validation.js`
- Update embed creation functions in `embeds.js`

## Testing

The command should be tested with:

- Valid and invalid input combinations
- Permission boundary testing
- Database connectivity scenarios
- Error handling edge cases
- Embed rendering and formatting

## Related Commands

- `/core-management` - Manage Core credits and tiers
- `/core` - View Core account information
- `/avatar` - Use Core credits for avatar generation
