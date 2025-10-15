# AI Avatar Generator

Generate unique anime-style avatars using AI with advanced style customization! This command creates personalized anime avatars with professional quality and customizable artistic styles.

## Features

- **AI-Powered Generation**: Uses multiple AI providers (OpenRouter, OpenAI, Stability AI) for high-quality anime avatar generation
- **Style Customization**: Choose from color palettes, moods, and art styles
- **High Quality**: Professional anime art quality with detailed character design
- **Unique Results**: Each generation creates a completely unique avatar
- **Credit System**: Integrated with the bot's credit system for monetization
- **Advanced Prompts**: Sophisticated prompt enhancement with keyword detection
- **Multiple Providers**: Fallback system ensures reliable generation
- **Loading Experience**: Beautiful static gradient loading image during generation
- **Public Results**: Generated avatars are visible to everyone in the channel for easy downloading

## Command Usage

### Basic Command

```
/avatar prompt: "cyberpunk hacker with neon glasses"
```

### With Style Options

```
/avatar prompt: "cool boy with spiky hair" color_style:neon mood:mysterious art_style:studio
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

- **color_style** (optional): Choose a color palette
  - `vibrant` - Bright and colorful
  - `pastel` - Soft and dreamy
  - `monochrome` - Black and white
  - `neon` - Cyberpunk and futuristic
  - `warm` - Golden and cozy
  - `cool` - Blue tones and calm

- **mood** (optional): Choose the character's mood and expression
  - `happy` - Cheerful and joyful
  - `serious` - Focused and professional
  - `mysterious` - Enigmatic and secretive
  - `cute` - Adorable and kawaii
  - `cool` - Confident and stylish
  - `elegant` - Refined and graceful

- **art_style** (optional): Choose the artistic style
  - `studio` - Studio Ghibli inspired
  - `manga` - Traditional Japanese comics
  - `modern` - Contemporary anime style
  - `retro` - 80s/90s vintage anime
  - `realistic` - Semi-realistic anime
  - `chibi` - Super cute and deformed
  - `lofi` - Chill and nostalgic aesthetic

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

### Main Components

1. **index.js**: Command definition and main execution with error handling
2. **handlers.js**: Avatar generation logic and processing
3. **embeds.js**: Centralized embed creation for consistent UI
4. **utils.js**: Core utility functions for validation and formatting
5. **utils/creditManager.js**: Credit checking and deduction logic
6. **utils/imageUtils.js**: Loading skeleton and image utilities
7. **utils/interactionHandler.js**: Safe interaction handling with error recovery

### Key Features

- **Standard Format**: Follows project-wide command structure patterns
- **Modular Design**: Separated concerns into focused utility modules
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Style Customization**: Advanced prompt enhancement with style options
- **Credit System**: Integrated credit management with Core member discounts
- **Security**: Proper user validation and content filtering
- **Performance**: Efficient processing and interaction handling

## Technical Details

### Credit System

- **All Users**: 1 Core per avatar ($0.10)
- **Core Members**: Get rate limiting benefits (higher limits, priority processing)
- **API Cost**: $0.01 per generation
- **Storage**: Centralized credit data in `core_credit.json`

### Usage Pattern

- **Simple Command**: Users run `/avatar` with their desired prompt
- **Style Options**: Optional color, mood, and art style customization
- **Smart Enhancement**: Automatic prompt enhancement with keyword detection
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

1. Update `src/config/prompts.js` with new template
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
