# Native Poll Command

## Overview

The Poll command uses Discord's native polling system to create interactive polls with the exact same UI and functionality as Discord's built-in polls. This provides a seamless, native Discord experience for all users.

## Features

- **100% Native Discord UI**: Uses Discord's built-in poll interface (exactly like manual polls)
- **Real-time Results**: Animated progress bars and live vote counts
- **Multiple Options**: Support for 2-10 poll options (up to 55 characters each)
- **Time Limits**: Set poll duration from 1 hour to 1 week (default: 24 hours)
- **Single/Multiple Choice**: Choose between single or multiple vote options
- **Detailed Results**: Click on vote counts to see who voted for what
- **Immediate End**: Can end polls immediately if needed
- **Poll Management**: List, delete, and view results of polls
- **No Custom UI**: No buttons, embeds, or custom components - pure Discord native
- **Simplified Codebase**: Removed complex voting logic, role limits, and custom UI components

## File Structure

```
poll/
├── index.js              # Main command definition and routing
├── handlers.js           # Command handlers (create, list, delete, results)
├── utils.js              # Utility functions
├── validation.js         # Poll validation functions
├── buttonHandler.js      # Button interaction handlers
└── README.md             # This documentation
```

## Command Usage

### Create Poll

```
/poll create question:"What's your favorite color?" options:"Red|Blue|Green|Yellow" duration:24 allow-multiple:true
```

### List Polls

```
/poll list page:1
```

### Delete Poll

```
/poll delete poll-id:1234567890123456789
```

### View Results

```
/poll results poll-id:1234567890123456789
```

## Parameters

### Create Poll Parameters

- **question** (required): The poll question (max 256 characters)
- **options** (required): Poll options separated by `|` (max 10 options, 55 chars each)
- **duration** (optional): Poll duration in hours (1-168, default: 24)
- **allow-multiple** (optional): Allow users to vote for multiple options (default: false)

## Native Poll System

### How Native Polls Work

1. Users click on their desired option(s) in the poll
2. Discord handles all voting logic and UI updates automatically
3. Real-time results are shown with animated progress bars
4. Users can change their votes by clicking different options
5. Click on vote counts to see detailed participant lists

### Native Poll Features

- **Automatic UI**: Discord handles all visual elements and interactions
- **Real-time Updates**: Results update instantly as users vote
- **Animated Progress**: Smooth progress bars show vote percentages
- **Detailed Results**: Click vote counts to see who voted for what
- **No Bot Dependencies**: Polls work even if the bot is offline

## Poll Lifecycle

1. **Creation**: Poll is created with specified options and settings
2. **Active**: Users can vote on the poll
3. **Expiration**: Poll automatically expires after the specified duration
4. **Cleanup**: Expired polls are cleaned up automatically

## Storage

Polls are stored using the existing storage system:

- **File Storage**: Stored in `data/polls.json`
- **Database Storage**: Stored in database if configured
- **Automatic Cleanup**: Expired polls are cleaned up every hour

## Permissions

### Required Bot Permissions

- `SendMessages`: Send poll messages
- `EmbedLinks`: Create rich embeds
- `AddReactions`: Add emoji reactions
- `ReadMessageHistory`: Read message history

### User Permissions

- **Create Polls**: Any user can create polls
- **Vote**: Any user can vote (subject to role limits)
- **Delete Polls**: Only poll creator or users with `ManageMessages` permission
- **View Results**: Any user can view poll results

## Error Handling

- **Invalid Options**: Validates poll options and emojis
- **Permission Errors**: Checks user permissions before allowing actions
- **Rate Limiting**: Handles Discord API rate limits gracefully
- **Storage Errors**: Graceful fallback if storage operations fail

## Examples

### Simple Poll

```
/poll create question:"What should we have for lunch?" options:"Pizza|Burger|Salad|Sushi"
```

### Advanced Poll with Role Limits

```
/poll create question:"Which feature should we prioritize?" options:"Feature A|Feature B|Feature C" emojis:"🚀|💡|🔧" duration:48 role-limits:"VIP:3|Moderator:2|Member:1" allow-multiple:true
```

### Anonymous Poll

```
/poll create question:"Rate our service" options:"Excellent|Good|Average|Poor" anonymous:true duration:72
```

## Integration

The poll system integrates with:

- **Existing Reaction System**: Uses the same reaction handlers as role reactions
- **Storage System**: Uses the existing storage manager
- **Permission System**: Uses the existing permission validation
- **Logging System**: Uses the existing logger for debugging

## Maintenance

- **Automatic Cleanup**: Expired polls are cleaned up every hour
- **Memory Management**: Poll data is stored efficiently
- **Error Recovery**: Graceful handling of API errors and timeouts
- **Performance**: Optimized for large numbers of polls and votes
