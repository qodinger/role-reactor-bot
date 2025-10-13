# AI Configuration System

This directory contains configuration files for AI services, including prompt templates and settings.

## Files

### `prompts.js`

- **Purpose**: AI prompt configuration with environment variable support
- **Status**: Safe to commit to public repositories
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
