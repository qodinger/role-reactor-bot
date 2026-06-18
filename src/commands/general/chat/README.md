# Chat Command

## Overview

The Chat command allows users to interact with an AI assistant to get help with the bot, server, or commands. Conversations are **shared across the entire channel** — all members can see and build on the discussion, just like a normal chat. Each channel has its own separate AI session.

## File Structure

```
chat/
├── index.js              # Command definition and entry point
├── handlers.js           # Core command logic and AI interaction handling
└── README.md             # This documentation
```

## Architecture

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core business logic, AI service integration, and credit management

## Usage Examples

```
/chat message:How do I set up role reactions?
/chat message:What commands are available?
/chat message:How do I generate an avatar?

@Role Reactor How do I set up role reactions?
```

Both `/chat` and `@mention` share the same channel conversation history.

## Resetting the Conversation

Admins can clear the AI history for a channel using:

```
/chat-reset
```

Requires **Manage Messages** permission.

## Permissions Required

- **`/chat`** — None (available to all users)
- **`/chat-reset`** — Manage Messages

## Key Features

- **Channel-Scoped Sessions**: Conversation history is shared by everyone in the channel. Different channels have separate sessions.
- **Mention Support**: Users can trigger the AI by mentioning `@Role Reactor` instead of using the slash command.
- **AI-Powered Assistance**: Intelligent responses about bot features, server context, and general questions.
- **Credit System Integration**: Uses `0.05 Core` per request (minimum charge).
- **Streaming Responses**: Real-time response streaming when `AI_STREAMING_ENABLED=true`.
- **Author Prefixes**: In channel sessions, each message is prefixed with the sender's display name so the AI knows who said what.
- **Jailbreak Detection**: Prompt-injection attempts are blocked before any credits are consumed.
- **Error Handling**: Graceful handling of AI service unavailability and timeouts (90s).

## Dependencies

- Discord.js
- AI chat service (`src/utils/ai/chatService.js`)
- Core credit system (`src/utils/ai/aiCreditManager.js`)
- Conversation manager (`src/utils/ai/conversationManager.js`)
- Theme configuration for colors and styling
