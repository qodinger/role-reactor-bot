# Interaction Management System

This directory contains the refactored interaction management system for the Discord bot. The system provides a clean, modular, and maintainable way to handle all Discord interactions.

## Architecture Overview

The interaction system is organized into several key components:

### Core Components

- **`InteractionManager.js`** - Main interaction manager that handles routing and coordination
- **`errorHandler.js`** - Standardized error handling utilities
- **`index.js`** - Main entry point with all exports

### Handlers Directory

Contains specialized handlers for different types of interactions:

- **`welcomeHandlers.js`** - Welcome system button interactions
- **`xpHandlers.js`** - XP system button interactions
- **`leaderboardHandlers.js`** - Leaderboard button interactions
- **`helpHandlers.js`** - Help system button interactions

### Routers Directory

Contains routing logic for different interaction types:

- **`buttonRouter.js`** - Routes button interactions to appropriate handlers

## Key Features

### 1. Modular Design

- Each interaction type has its own dedicated handler module
- Easy to add new interaction types without modifying existing code
- Clear separation of concerns

### 2. Centralized Error Handling

- Standardized error responses across all interaction types
- Proper error logging and user feedback
- Graceful degradation when errors occur

### 3. Dynamic Imports

- Handlers are loaded on-demand to reduce initial bundle size
- Better performance and memory usage
- Easier to maintain and debug

### 4. Interaction Tracking

- Prevents duplicate processing of the same interaction
- Automatic cleanup to prevent memory leaks
- Built-in rate limiting protection

### 5. Type Safety

- Comprehensive JSDoc comments for better IDE support
- Clear parameter and return type documentation
- Better error detection during development

## Usage

### Basic Usage

The system is automatically used by the main `interactionCreate.js` event handler:

```javascript
import { InteractionManager } from "../utils/interactions/InteractionManager.js";

const interactionManager = new InteractionManager();

export async function execute(interaction, client) {
  await interactionManager.handleInteraction(interaction, client);
}
```

### Adding New Handlers

1. Create a new handler file in the `handlers/` directory
2. Export your handler functions with proper JSDoc comments
3. Add routing logic to the appropriate router
4. Update the main index.js exports if needed

Example handler:

```javascript
import { getLogger } from "../../logger.js";

/**
 * Handle my custom button interaction
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleMyCustomButton = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // Your logic here
    await interaction.editReply({ content: "Success!" });
  } catch (error) {
    logger.error("Error handling my custom button", error);
    await handleButtonError(interaction, error, "processing your request");
  }
};
```

### Error Handling

Use the standardized error handling utilities:

```javascript
import {
  handleButtonError,
  handleInteractionError,
} from "../utils/interactions/errorHandler.js";

// For button interactions
await handleButtonError(interaction, error, "processing your request");

// For general interactions
await handleInteractionError(interaction, error, "executing command", {
  deferred: true,
  customMessage: "Something went wrong with your command",
});
```

## Migration from Old System

The old `interactionCreate.js` file has been completely refactored:

### Before (1554 lines)

- Single monolithic file with all handlers
- Inconsistent error handling
- Hard to maintain and extend
- No type safety or documentation

### After (17 lines main file + modular handlers)

- Clean, focused main file
- Modular handler system
- Standardized error handling
- Comprehensive documentation
- Better performance with dynamic imports

## Performance Benefits

1. **Reduced Bundle Size**: Dynamic imports mean handlers are only loaded when needed
2. **Better Memory Usage**: Automatic cleanup prevents memory leaks
3. **Faster Startup**: Less code loaded initially
4. **Easier Debugging**: Isolated handlers are easier to test and debug

## Best Practices

1. **Always use try-catch blocks** in your handlers
2. **Use the standardized error handling utilities** instead of custom error responses
3. **Add proper JSDoc comments** for better IDE support
4. **Test handlers individually** before integrating them
5. **Keep handlers focused** on a single responsibility
6. **Use dynamic imports** for better performance

## Future Enhancements

- Add interaction rate limiting per user
- Implement interaction analytics and monitoring
- Add support for modal interactions
- Create interaction testing utilities
- Add interaction caching for better performance
