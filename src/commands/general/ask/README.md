# Ask Command

## Overview

The Ask command allows users to interact with an AI assistant to get help with the bot, server, or commands. It provides intelligent responses about bot features, usage instructions, and troubleshooting.

## File Structure

```
ask/
├── index.js              # Command definition and entry point
├── handlers.js           # Core command logic and AI interaction handling
└── README.md             # This documentation
```

## Architecture

Following the modular pattern established by other general commands:

- **`index.js`**: Command definition and main execution flow
- **`handlers.js`**: Core business logic, AI service integration, and credit management

## Usage Examples

```
/ask question:How do I set up role reactions?
/ask question:What commands are available?
/ask question:How do I generate an avatar?
```

## Permissions Required

- `Send Messages` permission
- All users can access

## Key Features

- **AI-Powered Assistance**: Intelligent responses about bot features and usage
- **Credit System Integration**: Uses 0.05 Core per request
- **Streaming Responses**: Real-time response streaming when enabled
- **Context Awareness**: AI understands bot commands and server context
- **Credit Checking**: Validates user credits before processing requests
- **Error Handling**: Graceful handling of AI service unavailability
- **Simple and Official Design**: Clean embed design with professional presentation

## Dependencies

- Discord.js
- AI chat service integration
- Core credit system
- Theme configuration for colors and styling
