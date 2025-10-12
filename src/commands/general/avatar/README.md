# AI Avatar Generator

Generate unique anime-style avatars using AI with a consistent fixed template! This command creates personalized anime avatars with a beautiful, consistent art style.

## Features

- **AI-Powered Generation**: Uses Google Gemini 2.5 Flash Image for high-quality anime avatar generation
- **Fixed Template**: Consistent anime art style with 80s/lofi aesthetic and cloud backgrounds
- **High Quality**: 1024x1024 pixel resolution with professional anime art quality
- **Unique Results**: Each generation creates a completely unique avatar
- **Multiple Generations**: Users can run the command multiple times to generate different variations
- **Credit System**: Integrated with the bot's credit system for monetization
- **Simple Interface**: Just describe your character - no complex options needed

## Command Usage

### Basic Command

```
/avatar prompt: "cyberpunk hacker with neon glasses"
```

### Character Examples

```
/avatar prompt: "cool boy with spiky hair"
/avatar prompt: "cute girl in red dress"
/avatar prompt: "kawaii girl with pink hair"
/avatar prompt: "handsome man with glasses"
```

### Available Options

- **prompt** (required): Describe the avatar you want to generate
  - Be specific about character appearance, clothing, accessories
  - Include colors, hair style, personality traits
  - Examples: "cool boy with spiky hair", "cute girl in red dress"

## File Structure

```
src/commands/general/avatar/
├── index.js                 # Command definition
├── handlers.js              # Main command and button handlers
├── aiService.js             # Re-exports from AI service
├── README.md               # This documentation
└── utils/                  # Utility modules
    ├── index.js            # Utility exports
    ├── embeds.js           # Discord embed creation
    ├── creditManager.js    # Credit system management
    ├── imageUtils.js       # Image generation utilities
    └── interactionHandler.js # Interaction handling utilities
```

## Architecture

### Main Components

1. **handlers.js**: Main command execution and button interaction handling
2. **utils/embeds.js**: Centralized embed creation for consistent UI
3. **utils/creditManager.js**: Credit checking and deduction logic
4. **utils/imageUtils.js**: Loading skeleton and image utilities
5. **utils/interactionHandler.js**: Safe interaction handling with error recovery

### Key Features

- **Modular Design**: Separated concerns into focused utility modules
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Credit System**: Integrated credit management with Core member discounts
- **Simple Usage**: Just run the command again to generate new variations
- **Security**: Proper user validation and access control
- **Performance**: Efficient caching and interaction handling

## Technical Details

### Credit System

- **Regular Users**: 2 credits per avatar ($0.10)
- **Core Members**: 1 credit per avatar ($0.05)
- **API Cost**: $0.01 per generation
- **Storage**: Centralized credit data in `core_credit.json`

### Usage Pattern

- **Simple Command**: Users run `/avatar` with their desired prompt
- **Fixed Template**: All avatars use the same consistent art style
- **Multiple Variations**: Each run generates a unique avatar with different character descriptions
- **No Persistence**: No need to store previous generation data

### Error Handling

- **Interaction Timeouts**: Graceful handling of expired interactions
- **API Errors**: Specific error messages for different failure types
- **Credit Validation**: Clear feedback for insufficient credits
- **Rate Limiting**: Protection against abuse

## Dependencies

- **Discord.js**: Discord API interaction
- **Canvas**: Loading skeleton generation
- **AI Service**: Google Gemini 2.5 Flash Image integration
- **Storage Manager**: Credit and data persistence
- **Theme System**: Consistent UI styling

## Maintenance

### Modifying the Template

1. Update `src/config/aiPrompts.js` with new template
2. Test with various prompts to ensure consistency
3. Update documentation if needed

### Modifying Credit System

1. Update `utils/creditManager.js` for new pricing
2. Update help text in `utils/embeds.js`
3. Update Ko-fi webhook integration if needed

## Security Considerations

- **User Validation**: Proper user authentication and validation
- **No Data Storage**: No persistent data storage needed
- **Rate Limiting**: Prevents abuse of AI generation
- **Credit Protection**: Users cannot generate avatars without sufficient credits
- **Error Sanitization**: User-friendly error messages without sensitive details

## Performance Optimizations

- **Efficient Processing**: Streamlined generation without caching overhead
- **Safe Interactions**: Proper interaction state management
- **Error Recovery**: Graceful handling of API failures
- **Resource Management**: Proper cleanup of temporary data

This refactored architecture provides a clean, maintainable, and extensible foundation for the AI avatar generation system.
