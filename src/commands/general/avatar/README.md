# AI Avatar Generator

Generate unique anime-style avatars using AI with advanced style customization! This command creates personalized anime avatars with professional quality and customizable artistic styles.

## File Structure

```
src/commands/general/avatar/
├── index.js                 # Command definition and main execution
├── handlers.js              # Avatar generation handler
├── embeds.js                # Discord embed creation
├── utils.js                 # Utility functions
├── README.md               # This documentation
└── utils/                  # Specialized utility modules
    ├── creditManager.js    # Credit system management
    ├── imageUtils.js       # Image generation utilities
    └── interactionHandler.js # Interaction handling utilities
```

## Architecture

Following the modular pattern established by other commands:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, avatar generation, and interaction processing
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, validation, and prompt enhancement
- **`utils/creditManager.js`**: Credit checking and deduction logic
- **`utils/imageUtils.js`**: Loading skeleton and image utilities
- **`utils/interactionHandler.js`**: Safe interaction handling with error recovery

## Usage Examples

```
/avatar prompt:cyberpunk hacker with neon glasses
/avatar prompt:cool boy with spiky hair art_style:manga
/avatar prompt:cute girl in red dress
/avatar prompt:kawaii girl with pink hair art_style:chibi
/avatar prompt:handsome man with glasses
```

## Permissions Required

- `Send Messages` permission
- `Embed Links` permission
- `Attach Files` permission

## Available Options

- **prompt** (required): Describe the avatar you want to generate
- **art_style** (optional): Choose the artistic style (manga, modern, retro, realistic, chibi, lofi)

## Key Features

- AI-powered anime avatar generation
- Art style customization
- Credit system integration (1 Core per generation)
- Advanced prompt enhancement
- Multiple AI provider fallback
- Loading experience with static gradient
- Public results for easy downloading
- Simple and official design

## Dependencies

- Discord.js
- AI service integration (Google Gemini 2.5 Flash)
- Storage manager for credit persistence
- Theme configuration for colors and styling
