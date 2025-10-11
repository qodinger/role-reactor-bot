# Native Poll Command

## Overview

The Poll command uses Discord's native polling system to create interactive polls with the exact same UI and functionality as Discord's built-in polls. This provides a seamless, native Discord experience for all users with a modern modal-based creation process.

## Features

- **100% Native Discord UI**: Uses Discord's built-in poll interface (exactly like manual polls)
- **Real-time Results**: Animated progress bars and live vote counts
- **Multiple Options**: Support for 2-10 poll options (up to 55 characters each)
- **Time Limits**: Set poll duration from 1 hour to 7 days (Discord's maximum)
- **Single/Multiple Choice**: Choose between single or multiple vote options
- **Custom Emojis**: Add emojis to poll options for visual appeal
- **Modal Creation**: Modern two-step modal interface for poll creation
- **Poll Management**: List, delete, and end polls
- **No Custom UI**: No buttons, embeds, or custom components - pure Discord native
- **Simplified Codebase**: Removed complex voting logic and custom UI components

## File Structure

```
poll/
├── index.js              # Main command definition and routing
├── handlers.js           # Command handlers (create, list, delete, end)
├── modals.js             # Modal and select menu components for poll creation
├── modalHandler.js       # Modal submission handlers
├── buttonHandler.js      # Button interaction handlers (pagination)
└── README.md             # This documentation
```

## Command Usage

### Create Poll

```
/poll create
```

Opens a modern modal interface with:

- **Step 1**: Select duration (1 hour to 7 days) and vote type (single/multiple choice)
- **Step 2**: Enter poll question and options with optional emojis

### List Polls

```
/poll list [--show-ended]
```

- Shows active polls by default
- Use `--show-ended` to include completed polls
- Paginated display with 6 polls per page

### Delete Poll

```
/poll delete poll-id:1234567890123456789
```

- Deletes both the Discord message and database record
- Only poll creator or admins can delete polls

### End Poll

```
/poll end poll-id:1234567890123456789
```

- Immediately ends an active poll
- Only poll creator or admins can end polls

## Poll Creation Process

### Step 1: Duration and Type Selection

- **Duration Options**: 1 hour, 2 hours, 6 hours, 12 hours, 1 day, 2 days, 3 days, 5 days, 7 days
- **Vote Type**: Single choice or Multiple choice
- **Visual Selection**: Emoji-enhanced dropdown menus

### Step 2: Question and Options

- **Question**: Poll question (max 300 characters)
- **Options**: Up to 10 options, separated by `|` or newlines (max 55 chars each)
- **Emojis**: Optional emojis can be added to options (e.g., "🍎 Apple|🍌 Banana")
- **Placeholder**: Helpful examples provided in the input fields

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

Polls are stored using the existing storage system with MongoDB integration:

- **Primary Storage**: MongoDB database (if configured)
- **Fallback Storage**: File-based storage in `data/polls.json`
- **Automatic Sync**: Data syncs between file and database storage
- **Message ID Tracking**: Uses Discord message ID as poll identifier
- **Automatic Cleanup**: Expired polls are cleaned up after 24 hours

## Permissions

### Required Bot Permissions

- `SendMessages`: Send poll messages
- `EmbedLinks`: Create rich embeds
- `AddReactions`: Add emoji reactions
- `ReadMessageHistory`: Read message history

### User Permissions

- **Create Polls**: Any user can create polls (general command)
- **Vote**: Any user can vote on polls
- **Delete Polls**: Only poll creator or users with `Administrator` permission
- **End Polls**: Only poll creator or users with `Administrator` permission
- **View Polls**: Any user can view poll list and results

## Error Handling

- **Invalid Options**: Validates poll options and emojis
- **Permission Errors**: Checks user permissions before allowing actions
- **Rate Limiting**: Handles Discord API rate limits gracefully
- **Storage Errors**: Graceful fallback if storage operations fail

## Examples

### Simple Poll Creation

1. Run `/poll create`
2. Select duration (e.g., "1 day") and vote type (e.g., "Single choice")
3. Enter question: "What should we have for lunch?"
4. Enter options: "Pizza|Burger|Salad|Sushi"
5. Submit to create the poll

### Poll with Emojis

1. Run `/poll create`
2. Select duration and vote type
3. Enter question: "Which feature should we prioritize?"
4. Enter options: "🚀 Feature A|💡 Feature B|🔧 Feature C"
5. Submit to create the poll

### Multiple Choice Poll

1. Run `/poll create`
2. Select duration (e.g., "3 days") and vote type "Multiple choice"
3. Enter question: "What are your favorite colors?"
4. Enter options: "Red|Blue|Green|Yellow|Purple|Orange"
5. Submit to create the poll

## Integration

The poll system integrates with:

- **Storage System**: Uses the existing storage manager with MongoDB support
- **Permission System**: Uses the existing permission validation
- **Logging System**: Uses the existing logger for debugging
- **Theme System**: Uses centralized emojis and colors from `theme.js`
- **Database System**: Full MongoDB integration with automatic sync

## Technical Details

### Poll Data Structure

```javascript
{
  id: "message_id",           // Discord message ID
  question: "Poll question",   // Poll question text
  options: [...],             // Array of poll options
  duration: 24,               // Duration in hours
  allowMultiple: false,       // Single or multiple choice
  creatorId: "user_id",       // Creator's Discord ID
  guildId: "guild_id",        // Guild ID
  channelId: "channel_id",    // Channel ID
  isActive: true,             // Poll status
  createdAt: "timestamp",     // Creation timestamp
  endsAt: "timestamp"         // Expiration timestamp
}
```

### Rate Limiting

- **Per User**: 5 polls per user per hour
- **Per Server**: 50 active polls per server maximum
- **API Limits**: Respects Discord's rate limits

## Maintenance

- **Automatic Cleanup**: Expired polls are cleaned up after 24 hours
- **Message Deletion**: Poll data is automatically removed when Discord message is deleted
- **Database Sync**: Automatic sync between file and database storage
- **Error Recovery**: Graceful handling of API errors and timeouts
- **Performance**: Optimized for large numbers of polls and votes
