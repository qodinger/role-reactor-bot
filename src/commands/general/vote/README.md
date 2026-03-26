# Vote Command

## Overview

A reward-driven engagement command that encourages users to vote for the bot on top.gg in exchange for platform currency (Core Credits). It provides real-time tracking of a user's cooldown status and displays their historical vote counts.

## File Structure

```
vote/
├── index.js              # Command definition, embed building, and execution logic
└── README.md             # This documentation file
```

## Architecture

Following the streamlined pattern established for singular-function general commands:

- **`index.js`**: Contains the command definition (`/vote`), the `public` toggle option, interactions handling, and embed compilation.

### Command Structure

- **Main Command**: `/vote`
- **Optional Parameter**: `public` (boolean) to determine if the response should be visible to everyone or ephemeral.

### Data Flow

1. **Command Execution**: User triggers the `/vote` slash command.
2. **API Request**: The system dynamically fetches the user's vote status via the `topgg.js` webhook integration.
3. **Data Compilation**:
   - If the user has voted recently, the bot calculates the remaining cooldown time out of 12 hours.
   - If they haven't voted, it prompts them that they are ready.
   - Historical votes are tallied and included dynamically in the interaction text.
4. **Display**: Information is formatted into a clean embed with an interactive URL button linking directly to the bot's voting page.

## Usage Examples

### Keep it Private (Default)

```text
/vote
```

### Display the Vote URL Publicly

```text
/vote public:true
```

## Permissions Required

- None (Slash Command interactions inherently grant the ability to reply with embeds)

## Key Features

- **Real-Time Cooldowns**: Uses Discord's dynamic timestamp tag `<t:TIMESTAMP:R>` to show users exactly when their vote cooldown expires.
- **Vote Tracking**: Actively displays the total number of times a user has voted.
- **Reward Transparency**: Clear breakdowns indicating what users receive (e.g., 1 Core Credit per vote).
- **Public / Private Toggles**: Users can decide to broadcast the link or keep the prompt to themselves.
- **Direct Interactive Buttons**: Direct 'Vote on Top.gg' button to maintain a low-friction user experience.
- **WebHooks Integration**: Taps into the `webhooks/topgg.js` system for live data.

## Dependencies

- Discord.js
- `webhooks/topgg.js` (for validating Top.gg cooldowns)
- Theme Configuration (Colors and Custom Emojis)
- Core Bot Configuration Defaults
