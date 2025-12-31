# Prompt Configuration

This directory contains all AI-related prompts organized by purpose for better maintainability and scalability.

## Structure

```
prompts/
├── index.js              # Main export file (re-exports everything)
├── promptLoader.js       # Dynamic prompt loading with caching
├── promptVersion.js      # Prompt version metadata
├── promptAnalytics.js    # Usage and performance tracking
├── imagePrompts.js       # Image generation prompts
├── chat/                 # Chat prompts (organized by category)
│   ├── index.js          # Chat prompts index
│   ├── system.js         # System-level prompts (rules, guidelines)
│   ├── commands.js       # Command-related prompts
│   └── responses.js      # Response templates
└── README.md             # This file
```

## Files

### `index.js`

- **Purpose**: Central export point for all prompts
- **Exports**: All image and chat prompts, plus dynamic loader functions, versioning, and analytics
- **Usage**: Import from here for backward compatibility

### `promptLoader.js`

- **Purpose**: Dynamic prompt loading with caching and template substitution
- **Features**:
  - Runtime loading with configurable cache TTL
  - Template variable substitution (`{variableName}`)
  - Hot-reload support via `clearPromptCache()`
  - Cache statistics and monitoring
  - Automatic performance tracking
- **Functions**:
  - `loadImagePrompts(forceReload)` - Load image prompts
  - `loadChatPrompts(forceReload)` - Load chat prompts
  - `loadAllPrompts(forceReload)` - Load all prompts
  - `getPrompt(type, key, variables, forceReload)` - Get prompt with variable substitution
  - `clearPromptCache()` - Clear cache for hot-reloading
  - `getCacheStats()` - Get cache statistics

### `promptVersion.js`

- **Purpose**: Track version information for all prompt modules
- **Features**:
  - Version metadata for each prompt category
  - Sub-category versioning support
  - Last updated timestamps
- **Functions**:
  - `getPromptVersion(promptType)` - Get version for a specific prompt type
  - `getAllPromptVersions()` - Get all version information

### `promptAnalytics.js`

- **Purpose**: Track prompt usage, performance, and errors
- **Features**:
  - Usage statistics (how often each prompt is used)
  - Performance metrics (load times)
  - Error tracking
- **Functions**:
  - `trackPromptUsage(type, key)` - Track prompt usage
  - `trackPromptPerformance(type, loadTime)` - Track load performance
  - `trackPromptError(type, key, error)` - Track errors
  - `getUsageStats(type)` - Get usage statistics
  - `getPerformanceStats(type)` - Get performance statistics
  - `getErrorStats(type)` - Get error statistics
  - `getAllAnalytics()` - Get all analytics data
  - `resetAnalytics()` - Reset analytics (for testing)

### `imagePrompts.js`

- **Purpose**: Image generation prompts and templates
- **Exports**:
  - `PROVIDER_PROMPTS` - Provider-specific prompt templates (Stability, OpenRouter, OpenAI)
  - `STYLE_MODIFIERS` - Color, mood, and art style modifiers
  - `CHARACTER_TYPE_ENHANCEMENTS` - Character type descriptions
  - `DEFAULT_CHARACTER` - Default character description
  - `BASE_PROMPT_TEMPLATE` - Legacy compatibility (defaults to Stability)
  - `PROMPT_SUFFIX` - Legacy compatibility
  - `NEGATIVE_PROMPT` - Legacy compatibility

### `chat/` Directory

Chat prompts are now organized into sub-categories for better maintainability:

#### `chat/system.js`

- **Purpose**: System-level prompts (core identity, rules, guidelines)
- **Exports**:
  - `criticalRules` - Critical rules for AI behavior
  - `generalGuidelinesBase` - General conversation guidelines

#### `chat/commands.js`

- **Purpose**: Command-related prompts
- **Exports**:
  - `capabilitiesBase` - Base capabilities description
  - `commandExecutionRestriction` - Command execution restrictions

#### `chat/responses.js`

- **Purpose**: Response templates
- **Exports**:
  - `followUpTemplate` - Template for follow-up messages after data fetches

#### `chat/index.js`

- **Purpose**: Central export for all chat prompts
- **Exports**: All prompts from sub-categories, plus combined `CHAT_PROMPTS` object for backward compatibility

## Usage

### Static Imports (Simple Cases)

```javascript
// Import from index (recommended for static usage)
import { PROVIDER_PROMPTS, CHAT_PROMPTS } from "../../config/prompts/index.js";

// Or import specific files
import { PROVIDER_PROMPTS } from "../../config/prompts/imagePrompts.js";
import { CHAT_PROMPTS } from "../../config/prompts/chat/index.js";

// Or use config/index.js (also works)
import { PROVIDER_PROMPTS, CHAT_PROMPTS } from "../../config/index.js";
```

### Dynamic Prompt Loading (Recommended)

For runtime loading with caching and template variable substitution:

```javascript
import {
  loadImagePrompts,
  loadChatPrompts,
  loadAllPrompts,
  getPrompt,
  clearPromptCache,
  getCacheStats,
} from "../../config/prompts/index.js";

// Load prompts dynamically (with caching)
const imagePrompts = await loadImagePrompts();
const chatPrompts = await loadChatPrompts();
const allPrompts = await loadAllPrompts();

// Get specific prompt with variable substitution
const followUpPrompt = await getPrompt("chat", "followUpTemplate", {
  userName: "John",
  serverName: "My Server",
});

// Force reload (bypass cache)
const freshPrompts = await loadChatPrompts(true);

// Clear cache (useful for hot-reloading)
clearPromptCache();

// Check cache statistics
const stats = getCacheStats();
console.log("Cache age:", stats.cacheAge, "ms");
```

### Template Variable Substitution

Prompts support template variables using `{variableName}` syntax:

```javascript
// In your prompt file (chat/responses.js):
followUpTemplate: dedent`
  Hello {userName}, welcome to {serverName}!
  Your current level is {userLevel}.
`;

// Usage:
const prompt = await getPrompt("chat", "followUpTemplate", {
  userName: "John",
  serverName: "My Server",
  userLevel: 5,
});
// Result: "Hello John, welcome to My Server! Your current level is 5."
```

### Version Information

```javascript
import {
  getAllPromptVersions,
  getPromptVersion,
} from "../../config/prompts/index.js";

// Get all versions
const versions = getAllPromptVersions();
console.log("Image version:", versions.image.version);
console.log("Chat version:", versions.chat.version);

// Get specific version
const chatVersion = getPromptVersion("chat");
console.log("Chat last updated:", chatVersion.lastUpdated);
```

### Analytics

```javascript
import {
  getUsageStats,
  getPerformanceStats,
  getAllAnalytics,
} from "../../config/prompts/index.js";

// Get usage statistics
const usage = getUsageStats("chat");
console.log("Chat prompt usage:", usage);

// Get performance statistics
const perf = getPerformanceStats();
console.log("Load times:", perf);

// Get all analytics
const analytics = getAllAnalytics();
console.log("Complete analytics:", analytics);
```

### Cache Configuration

The prompt cache has a configurable TTL (Time To Live):

```bash
# Set cache TTL in milliseconds (default: 5 minutes)
export PROMPT_CACHE_TTL=300000

# Enable strict mode (warns about unsubstituted variables)
export PROMPT_STRICT_MODE=true
```

## Benefits of This Structure

1. **Separation of Concerns**: Image prompts separate from chat prompts, chat prompts organized by category
2. **Scalability**: Easy to add new prompt categories (e.g., `moderationPrompts.js`)
3. **Maintainability**: Clear file names indicate purpose
4. **Backward Compatibility**: `index.js` maintains existing import paths
5. **Future Expansion**: Can split further if files grow too large
6. **Dynamic Loading**: Runtime loading with caching for performance
7. **Template Variables**: Support for runtime variable substitution
8. **Hot Reloading**: Clear cache to reload prompts without restarting bot
9. **Versioning**: Track prompt versions and changes
10. **Analytics**: Monitor usage, performance, and errors

## Adding New Prompt Categories

To add a new prompt category (e.g., moderation prompts):

1. Create new file: `moderationPrompts.js` or `chat/moderation.js`
2. Export your prompts from the file
3. Re-export from `index.js`:
   ```javascript
   export { MODERATION_PROMPTS } from "./moderationPrompts.js";
   ```
4. Update version information in `promptVersion.js`
5. Update this README

## File Size Guidelines

- **Current**:
  - Image: ~193 lines
  - Chat System: ~50 lines
  - Chat Commands: ~50 lines
  - Chat Responses: ~30 lines
- **Recommended max**: 500 lines per file
- **If exceeded**: Consider splitting into subdirectories (e.g., `image/providers.js`, `image/styles.js`)

## Testing

Basic tests are available in `__tests__/promptLoader.test.js`:

```bash
# Run tests (if using vitest)
npm test prompts
```

## Migration Notes

- Old `chatPrompts.js` file has been replaced with `chat/` directory structure
- All imports have been updated to use `chat/index.js`
- Backward compatibility maintained through `index.js` re-exports
- Version tracking added for better change management
- Analytics tracking added for monitoring and optimization
