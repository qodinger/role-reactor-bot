# Core Command

The `/core` command allows users to check their Core balance and view pricing information for the Core credit system.

## Overview

This command provides two subcommands for different types of information:

- **`balance`** - Check current Core balance and tier status
- **`pricing`** - View Core pricing, membership benefits, and donation options

## Command Structure

### Main Command

```
/core
```

### Subcommands

#### Balance Check

```
/core balance
```

**Description:** Check your current Core balance and tier status

**Features:**

- Shows current Core credit balance
- Displays Core tier status with proper badges
- Shows total avatar generations
- Provides links to get more Cores

#### Pricing Information

```
/core pricing
```

**Description:** View Core pricing, membership benefits, and donation options

**Features:**

- One-time donation pricing
- Core membership tiers and benefits
- Monthly credit allocations
- Ko-fi donation links

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

## Key Features

### 💰 Core Balance Display

- Real-time balance checking
- Tier status with proper badge emojis
- Total avatar generation count
- Quick access to donation links

### 📊 Pricing Information

- Clear pricing structure for donations
- Core membership tier benefits
- Monthly credit allocations
- Professional presentation

### 🎨 Rich Embeds

- Consistent styling and branding
- Tier badges for Core memberships
- Professional layout and formatting
- Timestamps and footers

### 🔒 User-Friendly

- No special permissions required
- Ephemeral responses for privacy
- Clear error messages
- Fast response times

## Usage Examples

### Check Balance

```
/core balance
```

**Response:** Shows user's current Core balance, tier status, and generation count.

### View Pricing

```
/core pricing
```

**Response:** Displays comprehensive pricing information for donations and memberships.

## Data Structure

### User Data Format

```javascript
{
  credits: 150,                    // Current Core credit balance
  isCore: true,                    // Core membership status
  coreTier: "Core Basic",          // Core tier level
  totalGenerated: 25,              // Total avatar generations
  lastUpdated: "2025-01-15T10:30:00.000Z",
  verifications: []                // Verification history
}
```

### Core Tiers

- **Regular** - Standard users without Core membership
- **Core Basic** - $10/month, 150 monthly credits
- **Core Premium** - $25/month, 400 monthly credits
- **Core Elite** - $50/month, 850 monthly credits

### Pricing Structure

- **$10 Donation** → 100 Core credits
- **$25 Donation** → 250 Core credits
- **$50 Donation** → 500 Core credits

## Error Handling

The command includes comprehensive error handling:

- **Validation Errors** - Clear messages for invalid inputs
- **Permission Errors** - Proper access control messaging
- **Database Errors** - Graceful handling of storage issues
- **Network Errors** - Retry logic and fallback mechanisms

## Data Storage

### Storage Integration

- Uses centralized storage manager
- MongoDB integration with local fallback
- Automatic data synchronization
- Proper error handling and recovery

### Data Access

- Global user data (not guild-specific)
- Real-time balance updates
- Secure data retrieval
- Performance optimized queries

## Security Considerations

- **Input Validation** - All inputs validated before processing
- **Permission Checks** - Proper access control
- **Data Privacy** - Ephemeral responses for sensitive information
- **Error Handling** - Secure error responses without data leaks

## Integration Points

### Storage Manager

- Uses `getStorageManager()` for data persistence
- Integrates with MongoDB and local JSON fallback
- Automatic synchronization between storage systems

### Theme System

- Uses centralized theme for colors and emojis
- Consistent branding across all embeds
- Proper emoji configuration

### Logging System

- Uses centralized logger for all operations
- Structured logging with context information
- Performance tracking and monitoring

## Performance Features

### Optimization

- Fast data retrieval with caching
- Minimal database queries
- Efficient embed creation
- Performance monitoring and logging

### Response Times

- Typical response time: <200ms
- Deferred responses to prevent timeouts
- Error handling for slow operations
- Performance context tracking

## Maintenance

### Adding New Features

1. Add new subcommand to `index.js`
2. Create handler function in `handlers.js`
3. Add validation function in `validation.js`
4. Create embed function in `embeds.js`
5. Update utility functions in `utils.js` if needed

### Modifying Pricing

- Update `getCorePricing()` in `utils.js`
- Modify tier credit amounts in `getMonthlyCreditsForTier()`
- Update documentation and examples

### Changing Data Structure

- Update `getUserData()` in `utils.js`
- Modify validation functions in `validation.js`
- Update embed creation functions in `embeds.js`

## Testing

The command should be tested with:

- Valid and invalid input combinations
- Permission boundary testing
- Database connectivity scenarios
- Error handling edge cases
- Embed rendering and formatting
- Performance under load

## Related Commands

- `/verify` - Developer command for manual verification
- `/core-management` - Developer command for managing Core credits
- `/avatar` - Use Core credits for avatar generation

## Dependencies

### Internal Dependencies

- `../../../config/theme.js` - Theme and emoji configuration
- `../../../config/emojis.js` - Emoji configuration
- `../../../utils/logger.js` - Logging system
- `../../../utils/storage/storageManager.js` - Data storage
- `../../../utils/discord/responseMessages.js` - Error responses

### External Dependencies

- `discord.js` - Discord API integration
- Node.js built-in modules

## Configuration

### Environment Variables

- No specific environment variables required
- Uses global bot configuration

### Bot Permissions

- `SendMessages` - Required for command execution
- No special permissions needed

## Monitoring

### Logging

- Command execution tracking
- Performance monitoring
- Error tracking and debugging
- User activity logging

### Metrics

- Response times
- Error rates
- Usage statistics
- Performance benchmarks

## Future Enhancements

### Potential Features

- Core credit history tracking
- Spending analytics
- Tier upgrade notifications
- Automated tier management
- Integration with external payment systems

### Scalability

- Caching improvements
- Database optimization
- Load balancing support
- Performance monitoring
- Error recovery mechanisms
