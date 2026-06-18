# Configuration System

This directory contains configuration files for the bot, including AI prompts, theme settings, and emoji configuration.

## Files

### `config.js`

- **Purpose**: Main bot configuration (Discord, database, Core pricing, etc.)
- **Status**: Environment-based configuration with validation

### `ai.js`

- **Purpose**: AI configuration (models, feature credits, content filters)
- **Status**: AI provider and pricing configuration

### `theme.js`

- **Purpose**: Theme configuration (colors, UI components, button styles)
- **Status**: Visual theme settings for embeds and components

### `emojis.js`

- **Purpose**: Emoji configuration for bot reactions and responses
- **Status**: Custom emoji IDs and mappings

### `prompts/`

- **Purpose**: AI prompt configuration organized by purpose
- **Status**: Safe to commit to public repositories
- **Structure**: Contains `imagePrompts.js`, `index.js`, and `chat/` subdirectory
- **Usage**: Contains prompts that work out of the box, customizable via environment variables

## Setup Instructions

1. **Customize via Environment Variables** (recommended for production):

   ```bash
   export AI_BASE_PROMPT_TEMPLATE="your custom template here"
   export AI_STYLE_MODERN="your modern style here"
   export AI_MOOD_HAPPY="your happy mood here"
   # ... etc
   ```

2. **Direct File Editing** (for development):
   - Edit `BASE_PROMPT_TEMPLATE` for your main prompt structure
   - Modify `STYLE_MODIFIERS` for different art styles
   - Update `MOOD_MODIFIERS` for character expressions
   - Set `PROMPT_SUFFIX` for model-specific instructions
   - Change `DEFAULT_CHARACTER` for fallback character descriptions

## Security

- ✅ `prompts.js` - Safe to share publicly (uses environment variables for sensitive data)
- ✅ Environment variables - Keep private (not committed to repository)

## Template Variables

The base prompt template supports these placeholders:

- `{characterDescription}` - User's character description
- `{styleModifiers}` - Selected style modifiers
- `{moodModifiers}` - Selected mood modifiers

## Example

```javascript
// Environment variables (recommended)
export AI_BASE_PROMPT_TEMPLATE="your custom template with {characterDescription}, {styleModifiers}, {moodModifiers}";
export AI_STYLE_MODERN="your custom modern style";
export AI_MOOD_HAPPY="your custom happy mood";
```

This system allows you to keep your AI prompts private while maintaining an open-source codebase.
