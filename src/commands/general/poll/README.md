# Poll Command

## Overview

The Poll command uses Discord's native polling system to create interactive polls with the exact same UI and functionality as Discord's built-in polls. This provides a seamless, native Discord experience for all users with a modern modal-based creation process.

## File Structure

```
poll/
├── index.js              # Main command definition and routing
├── handlers.js           # Command handlers (create, list, delete, end)
├── modals.js             # Modal and select menu components for poll creation
├── modalHandler.js       # Modal submission handlers
├── buttonHandler.js      # Button interaction handlers (pagination)
├── utils.js              # Utility functions for poll processing
└── README.md             # This documentation
```

## Architecture

### Command Structure

- **Main Command**: `/poll` with subcommands for different operations
- **Subcommands**: `create`, `list`, `end`, `delete`
- **Modal System**: Two-step creation process with configuration and details
- **Native Integration**: Uses Discord's built-in poll API for maximum compatibility

### Data Flow

1. **Creation**: User selects duration and vote type → Modal for details → Native poll creation
2. **Management**: Poll data stored in database with Discord message references
3. **Voting**: Handled entirely by Discord's native system
4. **Results**: Real-time updates through Discord's poll interface

## Usage Examples

### Creating a Poll

```
/poll create
```

- Opens interactive modal for poll configuration
- Select duration (1 hour to 7 days)
- Choose single or multiple choice voting
- Enter poll question and options
- Creates native Discord poll

### Listing Polls

```
/poll list
/poll list page:2
/poll list show-ended:true
```

- Shows all polls in the server
- Paginated display with navigation
- Optional inclusion of ended polls
- Click to view original poll messages

### Managing Polls

```
/poll end poll-id:abc123
/poll delete poll-id:abc123
```

- End polls early (creator or admin only)
- Delete polls completely (creator or admin only)
- Automatic cleanup of expired polls

## Permissions Required

### User Permissions

- **Create**: Send Messages permission
- **List**: Send Messages permission (public)
- **End/Delete**: Poll creator or Manage Messages permission

### Bot Permissions

- **Send Messages**: Required for all operations
- **Embed Links**: Required for poll display
- **Manage Messages**: Required for poll deletion

## Key Features

### Native Discord Integration

- Uses Discord's built-in poll system
- Identical UI to manual polls
- Real-time vote counting and animations
- Automatic expiration handling

### Modern Creation Interface

- Two-step modal process
- Duration selection (1 hour to 7 days)
- Vote type configuration (single/multiple)
- Option management with emojis

### Poll Management

- List all server polls with pagination
- End polls early for immediate results
- Delete polls with proper cleanup
- Automatic expiration processing

### Simple and Official Design

- Clean, professional styling
- Minimal emoji usage for better readability
- Consistent with other bot commands
- Focus on functionality over decoration

## Poll Configuration

### Duration Options

- **1 hour**: Standard quick polls
- **2-12 hours**: Extended engagement
- **1-3 days**: Community decisions
- **5-7 days**: Long-term voting (Discord maximum)

### Vote Types

- **Single Choice**: Users select one option
- **Multiple Choice**: Users can select multiple options
- **Custom Emojis**: Add visual appeal to options

### Poll Limits

- **Options**: 2-10 options maximum
- **Characters**: 55 characters per option
- **Duration**: 1 hour to 7 days maximum
- **Votes**: Unlimited (Discord native limits)

## Dependencies

- Discord.js
- Theme configuration for colors and styling
- Storage manager for poll data persistence
- Logger for operation tracking
